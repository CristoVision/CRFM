import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0?target=deno';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

type FeeType = 'track' | 'album';
type Body = {
  fee_type: FeeType;
  ui_mode?: 'embedded' | 'redirect';
  return_url?: string;
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

function resolvePriceId(feeType: FeeType) {
  if (feeType === 'track') return Deno.env.get('STRIPE_PRICE_UPLOAD_TRACK');
  return Deno.env.get('STRIPE_PRICE_UPLOAD_ALBUM');
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

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

  const feeType = body.fee_type;
  if (!feeType) return json({ error: 'Missing fee_type' }, { status: 400 });
  const priceId = resolvePriceId(feeType);
  if (!priceId) return json({ error: 'Missing price configuration for fee_type' }, { status: 500 });

  const origin = req.headers.get('origin') || 'https://crfministry.com';
  const uiMode = body.ui_mode || 'embedded';
  const defaultReturnUrl = `${origin}/hub?tab=monetization&stripe_return=1&kind=upload_fee&fee_type=${feeType}&session_id={CHECKOUT_SESSION_ID}`;
  const returnUrl = body.return_url || defaultReturnUrl;
  const successUrl = body.success_url || `${origin}/hub?tab=monetization&uploadfee=success`;
  const cancelUrl = body.cancel_url || `${origin}/hub?tab=monetization&uploadfee=cancel`;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();
  if (userError || !user) return json({ error: 'Unauthorized' }, { status: 401 });

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });

  const sessionBase: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    client_reference_id: user.id,
    metadata: {
      kind: 'upload_fee',
      user_id: user.id,
      fee_type: feeType,
      price_id: priceId
    },
    line_items: [{ price: priceId, quantity: 1 }]
  };

  const session =
    uiMode === 'embedded'
      ? await stripe.checkout.sessions.create({
          ...sessionBase,
          ui_mode: 'embedded',
          return_url: returnUrl,
        })
      : await stripe.checkout.sessions.create({
          ...sessionBase,
          success_url: successUrl,
          cancel_url: cancelUrl,
        });

  return json({
    id: session.id,
    url: session.url,
    clientSecret: session.client_secret,
    uiMode,
  });
});
