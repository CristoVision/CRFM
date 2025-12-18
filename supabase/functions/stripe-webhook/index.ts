import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0?target=deno';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...init.headers
    }
  });
}

function receivedIgnored(details: Record<string, unknown>) {
  return json({ received: true, ignored: true, ...details });
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SB_PROJECT_URL') || Deno.env.get('SUPABASE_PROJECT_URL') || Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey =
    Deno.env.get('SB_SERVICE_ROLE_KEY') ||
    Deno.env.get('SUPABASE_PROJECT_SERVICE_ROLE_KEY') ||
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!stripeSecretKey || !webhookSecret) {
    return json({ error: 'Missing STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET' }, { status: 500 });
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return json({ error: 'Missing SB_PROJECT_URL/SB_SERVICE_ROLE_KEY' }, { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) return json({ error: 'Missing Stripe signature' }, { status: 400 });

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (err) {
    return json({ error: `Invalid signature: ${err?.message || String(err)}` }, { status: 400 });
  }

  console.log(`stripe-webhook received: ${event.type} (${event.id})`);

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;
    const subscriptionId = subscription.id;
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : null;
    const status = subscription.status || 'canceled';

    if (!customerId) return json({ error: 'Missing subscription customer' }, { status: 400 });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: subRow, error: subLookupError } = await supabase
      .from('stripe_creator_subscriptions')
      .select('user_id')
      .eq('subscription_id', subscriptionId)
      .single();

    if (subLookupError || !subRow?.user_id) {
      return receivedIgnored({ type: event.type, reason: 'unknown_subscription', subscription_id: subscriptionId });
    }

    const { data, error } = await supabase.rpc('rpc_apply_stripe_creator_subscription', {
      p_user_id: subRow.user_id,
      p_stripe_event_id: event.id,
      p_subscription_id: subscriptionId,
      p_customer_id: customerId,
      p_price_id: null,
      p_status: status
    });

    if (error) {
      if (error.code === '23505') return json({ received: true, deduped: true });
      return json({ error: error.message }, { status: 500 });
    }

    return json({ received: true, applied: true, kind: 'subscription_status', data });
  }

  // Wallet top-ups via PaymentIntent (WalletActionModal uses `stripe-create-payment-intent` + PaymentElement).
  // Handle these so balances update without requiring Checkout Sessions.
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const kind = paymentIntent.metadata?.kind || null;
    const userId = paymentIntent.metadata?.user_id || null;
    const amountCcRaw = paymentIntent.metadata?.amount_cc || null;

    if (kind !== 'topup') return receivedIgnored({ type: event.type, kind, reason: 'not_topup' });
    if (!userId) return json({ error: 'Missing user_id metadata' }, { status: 400 });

    const amountCc = Number(amountCcRaw);
    if (!Number.isFinite(amountCc) || amountCc <= 0) {
      return json(
        {
          error: 'Missing metadata for top-up',
          details: { amount_cc: amountCcRaw, kind, user_id: userId, payment_intent_id: paymentIntent.id }
        },
        { status: 400 }
      );
    }

    // For transparency, fetch balance transaction to log gross/fee/net.
    let currency: string | null = paymentIntent.currency || null;
    let amountUsdCents: number | null = Number.isFinite(paymentIntent.amount_received) ? paymentIntent.amount_received : null;
    let feeUsdCents: number | null = null;
    let netUsdCents: number | null = null;
    let chargeId: string | null = null;
    let balanceTransactionId: string | null = null;
    let feeDetails: unknown = null;
    try {
      const expanded = await stripe.paymentIntents.retrieve(paymentIntent.id, {
        expand: ['latest_charge.balance_transaction']
      });
      const latestCharge = expanded.latest_charge as unknown;
      if (latestCharge && typeof latestCharge === 'object') {
        const charge = latestCharge as Stripe.Charge;
        chargeId = charge.id || null;
        currency = charge.currency || currency;
        const btAny = (charge as any).balance_transaction;
        if (btAny && typeof btAny === 'object') {
          const bt = btAny as Stripe.BalanceTransaction;
          balanceTransactionId = bt.id || null;
          amountUsdCents = typeof bt.amount === 'number' ? bt.amount : amountUsdCents;
          feeUsdCents = typeof bt.fee === 'number' ? bt.fee : null;
          netUsdCents = typeof bt.net === 'number' ? bt.net : null;
          feeDetails = (bt as any).fee_details ?? null;
        }
      }
    } catch (err) {
      console.warn('stripe-webhook: failed to expand balance_transaction', err?.message || String(err));
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabase.rpc('rpc_apply_stripe_topup', {
      p_user_id: userId,
      p_amount_cc: Number(amountCc.toFixed(2)),
      p_stripe_event_id: event.id,
      p_payment_intent_id: paymentIntent.id,
      // The table expects a non-null checkout_session_id; for PaymentIntents we store the PI id.
      p_checkout_session_id: paymentIntent.id,
      p_event_type: event.type,
      p_currency: currency,
      p_amount_usd_cents: amountUsdCents,
      p_fee_usd_cents: feeUsdCents,
      p_net_usd_cents: netUsdCents,
      p_charge_id: chargeId,
      p_balance_transaction_id: balanceTransactionId,
      p_fee_details: feeDetails
    });

    if (error) {
      if (error.code === '23505') return json({ received: true, deduped: true });
      return json({ error: error.message }, { status: 500 });
    }

    return json({ received: true, applied: true, kind: 'topup_payment_intent', data });
  }

  if (event.type !== 'checkout.session.completed') {
    return receivedIgnored({ type: event.type, reason: 'unhandled_event' });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== 'paid') {
    return receivedIgnored({ type: event.type, reason: 'payment_status_not_paid' });
  }

  const kind = session.metadata?.kind || 'topup';
  const userId = session.metadata?.user_id;

  if (!userId) return json({ error: 'Missing user_id metadata' }, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  if (kind === 'topup') {
    const amountCcRaw = session.metadata?.amount_cc;
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;
    const amountCc = Number(amountCcRaw);
    if (!Number.isFinite(amountCc) || amountCc <= 0 || !paymentIntentId) {
      return json(
        {
          error: 'Missing metadata for top-up',
          details: {
            amount_cc: amountCcRaw,
            kind,
            user_id: userId,
            checkout_session_id: session.id,
            payment_intent_id: paymentIntentId
          }
        },
        { status: 400 }
      );
    }

    // For transparency, fetch balance transaction to log gross/fee/net.
    let currency: string | null = session.currency || null;
    let amountUsdCents: number | null = null;
    let feeUsdCents: number | null = null;
    let netUsdCents: number | null = null;
    let chargeId: string | null = null;
    let balanceTransactionId: string | null = null;
    let feeDetails: unknown = null;
    try {
      const expanded = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['latest_charge.balance_transaction']
      });
      const latestCharge = expanded.latest_charge as unknown;
      if (latestCharge && typeof latestCharge === 'object') {
        const charge = latestCharge as Stripe.Charge;
        chargeId = charge.id || null;
        currency = charge.currency || currency;
        const btAny = (charge as any).balance_transaction;
        if (btAny && typeof btAny === 'object') {
          const bt = btAny as Stripe.BalanceTransaction;
          balanceTransactionId = bt.id || null;
          amountUsdCents = typeof bt.amount === 'number' ? bt.amount : null;
          feeUsdCents = typeof bt.fee === 'number' ? bt.fee : null;
          netUsdCents = typeof bt.net === 'number' ? bt.net : null;
          feeDetails = (bt as any).fee_details ?? null;
        }
      }
    } catch (err) {
      console.warn('stripe-webhook: failed to expand balance_transaction (checkout topup)', err?.message || String(err));
    }

    const { data, error } = await supabase.rpc('rpc_apply_stripe_topup', {
      p_user_id: userId,
      p_amount_cc: Number(amountCc.toFixed(2)),
      p_stripe_event_id: event.id,
      p_payment_intent_id: paymentIntentId,
      p_checkout_session_id: session.id,
      p_event_type: event.type,
      p_currency: currency,
      p_amount_usd_cents: amountUsdCents,
      p_fee_usd_cents: feeUsdCents,
      p_net_usd_cents: netUsdCents,
      p_charge_id: chargeId,
      p_balance_transaction_id: balanceTransactionId,
      p_fee_details: feeDetails
    });

    if (error) {
      if (error.code === '23505') return json({ received: true, deduped: true });
      return json({ error: error.message }, { status: 500 });
    }

    return json({ received: true, applied: true, kind: 'topup', data });
  }

  if (kind === 'creator_subscription') {
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
    const customerId = typeof session.customer === 'string' ? session.customer : null;
    const priceId = session.metadata?.price_id || null;

    if (!subscriptionId || !customerId) {
      return json({ error: 'Missing subscription/customer on session' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('rpc_apply_stripe_creator_subscription', {
      p_user_id: userId,
      p_stripe_event_id: event.id,
      p_subscription_id: subscriptionId,
      p_customer_id: customerId,
      p_price_id: priceId,
      p_status: 'active'
    });

    if (error) {
      if (error.code === '23505') return json({ received: true, deduped: true });
      return json({ error: error.message }, { status: 500 });
    }

    return json({ received: true, applied: true, kind: 'creator_subscription', data });
  }

  if (kind === 'upload_fee') {
    const feeType = session.metadata?.fee_type;
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;
    if (!paymentIntentId || (feeType !== 'track' && feeType !== 'album')) {
      return json({ error: 'Missing fee metadata' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('rpc_apply_stripe_upload_fee', {
      p_user_id: userId,
      p_fee_type: feeType,
      p_stripe_event_id: event.id,
      p_payment_intent_id: paymentIntentId,
      p_checkout_session_id: session.id
    });

    if (error) {
      if (error.code === '23505') return json({ received: true, deduped: true });
      return json({ error: error.message }, { status: 500 });
    }

    return json({ received: true, applied: true, kind: 'upload_fee', data });
  }

  return receivedIgnored({ type: event.type, kind, reason: 'unknown_kind' });
});
