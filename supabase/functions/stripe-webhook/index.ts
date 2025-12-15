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

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!stripeSecretKey || !webhookSecret) {
    return json({ error: 'Missing STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET' }, { status: 500 });
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return json({ error: 'Missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
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

  if (event.type !== 'checkout.session.completed') {
    return json({ received: true, ignored: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== 'paid') {
    return json({ received: true, ignored: true, reason: 'payment_status_not_paid' });
  }

  const userId = session.metadata?.user_id;
  const amountCcRaw = session.metadata?.amount_cc;
  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;

  const amountCc = Number(amountCcRaw);
  if (!userId || !Number.isFinite(amountCc) || amountCc <= 0 || !paymentIntentId) {
    return json({ error: 'Missing metadata for top-up' }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase.rpc('rpc_apply_stripe_topup', {
    p_user_id: userId,
    p_amount_cc: Number(amountCc.toFixed(2)),
    p_stripe_event_id: event.id,
    p_payment_intent_id: paymentIntentId,
    p_checkout_session_id: session.id
  });

  if (error) {
    // Make webhook retries safe by treating idempotency conflicts as success.
    if (error.code === '23505') return json({ received: true, deduped: true });
    return json({ error: error.message }, { status: 500 });
  }

  return json({ received: true, applied: true, data });
});

