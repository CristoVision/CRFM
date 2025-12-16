import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, CreditCard, Sparkles, Receipt, AlertTriangle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

const ACTIVE_SUB_STATUSES = new Set(['active', 'trialing']);

const safeString = (value) => (value == null ? '' : String(value));

const CreatorBillingPanel = () => {
  const { user, profile, refreshUserProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const autoCheckoutStartedRef = useRef(false);

  const [loadingCredits, setLoadingCredits] = useState(false);
  const [credits, setCredits] = useState({ track: 0, album: 0 });

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutClientSecret, setCheckoutClientSecret] = useState('');
  const [checkoutLabel, setCheckoutLabel] = useState('');

  const subscriptionStatus = safeString(profile?.stripe_subscription_status || '').toLowerCase();
  const hasActiveSubscription = useMemo(() => ACTIVE_SUB_STATUSES.has(subscriptionStatus), [subscriptionStatus]);

  const canUseStripe = !!STRIPE_PUBLISHABLE_KEY;

  const loadCredits = useCallback(async () => {
    if (!user?.id) return;
    setLoadingCredits(true);
    try {
      const { data, error } = await supabase
        .from('creator_upload_fee_credits')
        .select('fee_type, credits')
        .eq('user_id', user.id);
      if (error && error.code !== 'PGRST116') throw error;

      const next = { track: 0, album: 0 };
      (data || []).forEach((row) => {
        if (row.fee_type === 'track') next.track = Number(row.credits) || 0;
        if (row.fee_type === 'album') next.album = Number(row.credits) || 0;
      });
      setCredits(next);
      try {
        window.dispatchEvent(new CustomEvent('crfm:creator_credits_updated', { detail: next }));
      } catch {
        // ignore
      }
    } catch {
      setCredits({ track: 0, album: 0 });
    } finally {
      setLoadingCredits(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadCredits();
  }, [loadCredits]);

  const startEmbeddedCheckout = useCallback(
    async ({ kind, payload, label }) => {
      if (!user?.id) {
        toast({ title: 'Login required', description: 'Please sign in to continue.', variant: 'destructive' });
        return;
      }
      if (!canUseStripe) {
        toast({
          title: 'Stripe not configured',
          description: 'Missing VITE_STRIPE_PUBLISHABLE_KEY on this deployment.',
          variant: 'destructive',
        });
        return;
      }

      setCheckoutLoading(true);
      setCheckoutClientSecret('');
      setCheckoutLabel(label);
      setCheckoutOpen(true);

      try {
        const fn =
          kind === 'creator_subscription'
            ? 'stripe-create-subscription-checkout-session'
            : 'stripe-create-upload-fee-checkout-session';

        const { data, error } = await supabase.functions.invoke(fn, {
          body: { ...payload, ui_mode: 'embedded' },
        });

        if (error) throw error;
        const secret = data?.clientSecret;
        if (!secret) throw new Error('Stripe session missing client secret.');

        setCheckoutClientSecret(secret);
      } catch (err) {
        setCheckoutOpen(false);
        toast({
          title: 'Could not start checkout',
          description: err?.message || 'Please try again.',
          variant: 'destructive',
        });
      } finally {
        setCheckoutLoading(false);
      }
    },
    [user?.id, canUseStripe]
  );

  useEffect(() => {
    if (!user?.id) return;
    if (autoCheckoutStartedRef.current) return;

    const params = new URLSearchParams(location.search || '');
    const billingAction = params.get('billing_action');
    const feeType = params.get('fee_type');

    if (billingAction !== 'upload_fee') return;
    if (feeType !== 'track' && feeType !== 'album') return;

    autoCheckoutStartedRef.current = true;

    params.delete('billing_action');
    params.delete('fee_type');

    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : '',
      },
      { replace: true }
    );

    startEmbeddedCheckout({
      kind: 'upload_fee',
      payload: { fee_type: feeType },
      label: feeType === 'track' ? 'Track Upload Fee' : 'Album Upload Fee',
    });
  }, [location.pathname, location.search, navigate, startEmbeddedCheckout, user?.id]);

  const handleCloseCheckout = () => {
    if (checkoutLoading) return;
    setCheckoutOpen(false);
    setCheckoutClientSecret('');
    setCheckoutLabel('');
  };

  // When coming back from Stripe (return_url), the webhook may take a moment to apply credits/status.
  // Do a short refresh/poll so the user sees the update without manual reload.
  useEffect(() => {
    let shouldPoll = false;

    try {
      const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
      if (params.get('stripe_return') === '1') shouldPoll = true;
    } catch {
      // ignore
    }

    try {
      const stored = window.sessionStorage.getItem('crfm:stripe_return');
      if (stored) shouldPoll = true;
    } catch {
      // ignore
    }

    if (!shouldPoll) return;

    const attempts = 5;
    let cancelled = false;

    const run = async () => {
      for (let i = 0; i < attempts; i += 1) {
        if (cancelled) return;
        await refreshUserProfile?.();
        await loadCredits();
        // Small delay between attempts to allow webhook processing
        await new Promise((r) => setTimeout(r, 1200));
      }
    };

    run().finally(() => {
      if (cancelled) return;
      try {
        window.sessionStorage.removeItem('crfm:stripe_return');
      } catch {
        // ignore
      }
      toast({
        title: 'Payment processing',
        description: 'If your credits/subscription do not update within ~30 seconds, refresh and try again.',
      });
    });

    return () => {
      cancelled = true;
    };
  }, [refreshUserProfile, loadCredits]);

  return (
    <div className="glass-effect rounded-xl p-4 sm:p-6 border border-yellow-400/10 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-yellow-300 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Billing (Stripe)
          </h3>
          <p className="text-sm text-gray-300">
            Payments are processed securely by Stripe. Upload credits and subscriptions are applied via webhook.
          </p>
        </div>
        {hasActiveSubscription ? (
          <Badge className="bg-green-600 text-white border-green-700">Subscription: {subscriptionStatus}</Badge>
        ) : subscriptionStatus ? (
          <Badge variant="outline" className="border-yellow-400/40 text-yellow-200">
            Subscription: {subscriptionStatus}
          </Badge>
        ) : (
          <Badge variant="outline" className="border-white/15 text-gray-300">
            No subscription
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-white/10 bg-black/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-medium text-gray-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-300" />
              Unlimited Uploads
            </p>
          </div>
          <p className="text-xs text-gray-400">
            Unlock unlimited uploads while your subscription is active. Status is enforced server-side.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="golden-gradient text-black font-semibold"
              disabled={checkoutLoading || hasActiveSubscription}
              onClick={() => startEmbeddedCheckout({ kind: 'creator_subscription', payload: { plan: 'monthly' }, label: 'Unlimited Uploads — Monthly' })}
            >
              {checkoutLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Monthly
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-yellow-400/40 text-yellow-200 hover:bg-yellow-400/10"
              disabled={checkoutLoading || hasActiveSubscription}
              onClick={() => startEmbeddedCheckout({ kind: 'creator_subscription', payload: { plan: 'six_months' }, label: 'Unlimited Uploads — 6 Months' })}
            >
              6 Months
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-yellow-400/40 text-yellow-200 hover:bg-yellow-400/10"
              disabled={checkoutLoading || hasActiveSubscription}
              onClick={() => startEmbeddedCheckout({ kind: 'creator_subscription', payload: { plan: 'yearly' }, label: 'Unlimited Uploads — Yearly' })}
            >
              Yearly
            </Button>
          </div>
          {hasActiveSubscription ? (
            <p className="text-xs text-green-300">Active subscription detected. If you need changes, manage it in Stripe customer portal (coming soon).</p>
          ) : (
            <p className="text-xs text-gray-400">Tip: If checkout fails, try again—your content form stays intact in this tab.</p>
          )}
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-medium text-gray-100 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-yellow-300" />
              Pay Per Upload Credits
            </p>
            <div className="text-xs text-gray-300">
              Track: <span className="text-yellow-200 font-semibold">{loadingCredits ? '…' : credits.track}</span> · Album:{' '}
              <span className="text-yellow-200 font-semibold">{loadingCredits ? '…' : credits.album}</span>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Buy credits for one track/album upload. Credits increment after payment and are consumed during upload (server-side enforcement recommended).
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-yellow-400/40 text-yellow-200 hover:bg-yellow-400/10"
              disabled={checkoutLoading}
              onClick={() => startEmbeddedCheckout({ kind: 'upload_fee', payload: { fee_type: 'track' }, label: 'Track Upload Fee' })}
            >
              Buy Track Credit
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-yellow-400/40 text-yellow-200 hover:bg-yellow-400/10"
              disabled={checkoutLoading}
              onClick={() => startEmbeddedCheckout({ kind: 'upload_fee', payload: { fee_type: 'album' }, label: 'Album Upload Fee' })}
            >
              Buy Album Credit
            </Button>
            <Button type="button" variant="ghost" className="text-gray-300 hover:text-yellow-200" disabled={loadingCredits || checkoutLoading} onClick={loadCredits}>
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/10 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-300 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm text-gray-200 font-medium">ATH Móvil</p>
            <p className="text-xs text-gray-400">
              ATH Móvil support is pending approval. For now, use Stripe for instant processing. When ATH is enabled, failed or pending payments will be handled
              gracefully with a “Try again” action without wiping your form state.
            </p>
          </div>
        </div>
      </div>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-2xl w-[95vw] h-[85vh] glass-effect-light text-white flex flex-col p-4">
          <DialogHeader className="space-y-2">
            <DialogTitle className="golden-text text-xl">Checkout</DialogTitle>
            <DialogDescription className="text-gray-300">{checkoutLabel || 'Secure payment powered by Stripe.'}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto rounded-lg border border-white/10 bg-black/20 p-3">
            {checkoutClientSecret ? (
              stripePromise ? (
                <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret: checkoutClientSecret }}>
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-300">
                  Stripe is not configured on this deployment.
                </div>
              )
            ) : (
              <div className="h-full flex items-center justify-center text-gray-300">
                <Loader2 className="w-6 h-6 animate-spin mr-3 text-yellow-300" />
                Preparing checkout…
              </div>
            )}
          </div>

          <div className="pt-3 flex justify-end gap-2">
            <Button type="button" variant="outline" className="bg-white/5 border-white/15 text-gray-200 hover:bg-white/10" onClick={handleCloseCheckout}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreatorBillingPanel;
