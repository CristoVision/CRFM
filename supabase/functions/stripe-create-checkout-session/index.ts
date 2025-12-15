import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0?target=deno';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

type Body = {
  amount_cc: number;
  success_url?: string;
  cancel_url?: string;
};

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

function getBearerToken(req: Request) {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer (.+)$/i);
  return match?.[1] || null;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const ccToUsd = Number(Deno.env.get('CC_TO_USD') || '0.01');

  if (!stripeSecretKey) return json({ error: 'Missing STRIPE_SECRET_KEY' }, { status: 500 });
  if (!supabaseUrl || !supabaseAnonKey) {
    return json({ error: 'Missing SUPABASE_URL/SUPABASE_ANON_KEY' }, { status: 500 });
  }

  const token = getBearerToken(req);
  if (!token) return json({ error: 'Missing auth token' }, { status: 401 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const amountCc = Number(body.amount_cc);
  if (!Number.isFinite(amountCc) || amountCc <= 0) {
    return json({ error: 'amount_cc must be > 0' }, { status: 400 });
  }

  const origin = req.headers.get('origin') || 'https://crfministry.com';
  const successUrl = body.success_url || `${origin}/wallet?checkout=success`;
  const cancelUrl = body.cancel_url || `${origin}/wallet?checkout=cancel`;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();
  if (userError || !user) return json({ error: 'Unauthorized' }, { status: 401 });

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });
  const usd = amountCc * ccToUsd;
  const unitAmount = Math.round(usd * 100);

  if (unitAmount < 50) {
    return json({ error: 'Amount too small for card processing.' }, { status: 400 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: false,
    client_reference_id: user.id,
    metadata: {
      user_id: user.id,
      amount_cc: amountCc.toFixed(2),
      cc_to_usd: ccToUsd.toString()
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: unitAmount,
          product_data: {
            name: 'CrossCoins top-up',
            description: `${amountCc.toFixed(2)} CC`
          }
        }
      }
    ]
  });

  return json({ url: session.url, id: session.id });
});

