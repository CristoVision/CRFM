import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, CreditCard, Sparkles, Receipt, AlertTriangle, Coins } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

const ACTIVE_SUB_STATUSES = new Set(['active', 'trialing']);

const safeString = (value) => (value == null ? '' : String(value));

const describeEdgeFunctionError = (err) => {
  if (!err) return 'Please try again.';
  if (typeof err === 'string') return err;
  if (err?.error_description) return String(err.error_description);
  if (err?.message) {
    const ctxBody = err?.context?.body;
    if (ctxBody) {
      try {
        const parsed = typeof ctxBody === 'string' ? JSON.parse(ctxBody) : ctxBody;
        if (parsed?.error) return String(parsed.error);
        if (parsed?.message) return String(parsed.message);
      } catch {
        // ignore
      }
    }
    return String(err.message);
  }
  return 'Please try again.';
};

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

  const [purchasePromptOpen, setPurchasePromptOpen] = useState(false);
  const [purchasePromptBusy, setPurchasePromptBusy] = useState(false);
  const [pendingPurchase, setPendingPurchase] = useState(null); // { billingAction: 'upload_fee', feeType: 'track'|'album' }

  const subscriptionStatus = safeString(profile?.stripe_subscription_status || '').toLowerCase();
  const hasStripeUnlimited = useMemo(() => ACTIVE_SUB_STATUSES.has(subscriptionStatus), [subscriptionStatus]);
  const hasPrepaidUnlimited = useMemo(() => {
    const expiresAt = profile?.creator_unlimited_expires_at;
    if (!expiresAt) return false;
    const ts = new Date(expiresAt).getTime();
    return Number.isFinite(ts) && ts > Date.now();
  }, [profile?.creator_unlimited_expires_at]);
  const hasActiveSubscription = hasStripeUnlimited || hasPrepaidUnlimited;

  const canUseStripe = !!STRIPE_PUBLISHABLE_KEY;
  const walletBalance = useMemo(() => Number(profile?.wallet_balance || 0), [profile?.wallet_balance]);

  const [ccPricesLoading, setCcPricesLoading] = useState(false);
  const [ccPrices, setCcPrices] = useState({});
  const [ccPricesSupported, setCcPricesSupported] = useState(true);

  const loadCcPrices = useCallback(async () => {
    if (!user?.id) return;
    setCcPricesLoading(true);
    try {
      const { data, error } = await supabase.from('crfm_creator_billing_prices').select('key, price_cc, is_active');
      if (error) throw error;
      const next = {};
      (data || []).forEach((row) => {
        next[row.key] = { price_cc: Number(row.price_cc || 0), is_active: !!row.is_active };
      });
      setCcPrices(next);
      setCcPricesSupported(true);
    } catch {
      setCcPrices({});
      setCcPricesSupported(false);
    } finally {
      setCcPricesLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadCcPrices();
  }, [loadCcPrices]);

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
          description: describeEdgeFunctionError(err),
          variant: 'destructive',
        });
      } finally {
        setCheckoutLoading(false);
      }
    },
    [user?.id, canUseStripe]
  );

  const purchaseUnlimitedWithCc = useCallback(
    async (plan) => {
      if (!user?.id) return;
      try {
        const { data, error } = await supabase.rpc('rpc_creator_purchase_unlimited_cc', { p_plan: plan });
        if (error) throw error;
        toast({
          title: 'Unlimited activated',
          description: `Charged ${Number(data?.price_cc || 0).toLocaleString()} CC.`,
          className: 'bg-green-600 text-white',
        });
        await refreshUserProfile?.();
      } catch (err) {
        toast({
          title: 'CC purchase failed',
          description: err?.message || 'Please try again.',
          variant: 'destructive',
        });
      }
    },
    [refreshUserProfile, user?.id]
  );

  const purchaseUploadCreditWithCc = useCallback(
    async (feeType) => {
      if (!user?.id) return;
      try {
        const { data, error } = await supabase.rpc('rpc_creator_purchase_upload_credit_cc', { p_fee_type: feeType, p_quantity: 1 });
        if (error) throw error;
        toast({
          title: 'Credit added',
          description: `Charged ${Number(data?.total_cc || 0).toLocaleString()} CC.`,
          className: 'bg-green-600 text-white',
        });
        await refreshUserProfile?.();
        await loadCredits();
      } catch (err) {
        toast({
          title: 'CC purchase failed',
          description: err?.message || 'Please try again.',
          variant: 'destructive',
        });
      }
    },
    [loadCredits, refreshUserProfile, user?.id]
  );

  useEffect(() => {
    if (!user?.id) return;
    if (autoCheckoutStartedRef.current) return;

    const params = new URLSearchParams(location.search || '');
    const billingAction = params.get('billing_action');
    const feeType = params.get('fee_type');
    const paymentMethod = params.get('payment_method');

    if (billingAction !== 'upload_fee') return;
    if (feeType !== 'track' && feeType !== 'album') return;

    autoCheckoutStartedRef.current = true;

    params.delete('billing_action');
    params.delete('fee_type');
    params.delete('payment_method');

    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : '',
      },
      { replace: true }
    );

    if (paymentMethod === 'cc') {
      purchaseUploadCreditWithCc(feeType);
      return;
    }

    if (paymentMethod === 'stripe') {
      startEmbeddedCheckout({
        kind: 'upload_fee',
        payload: { fee_type: feeType },
        label: feeType === 'track' ? 'Track Upload Fee' : 'Album Upload Fee',
      });
      return;
    }

    setPendingPurchase({ billingAction: 'upload_fee', feeType });
    setPurchasePromptOpen(true);
  }, [location.pathname, location.search, navigate, purchaseUploadCreditWithCc, startEmbeddedCheckout, user?.id]);

  const handleCloseCheckout = () => {
    if (checkoutLoading) return;
    setCheckoutOpen(false);
    setCheckoutClientSecret('');
    setCheckoutLabel('');
  };

  const pendingCcPrice = useMemo(() => {
    if (!pendingPurchase?.feeType) return null;
    const key = pendingPurchase.feeType === 'track' ? 'upload_track_credit' : 'upload_album_credit';
    const row = ccPrices?.[key];
    return row?.is_active ? Number(row.price_cc || 0) : null;
  }, [ccPrices, pendingPurchase?.feeType]);

  const pendingCcEnabled = useMemo(() => {
    if (!pendingPurchase?.feeType) return false;
    if (!ccPricesSupported || ccPricesLoading) return false;
    const key = pendingPurchase.feeType === 'track' ? 'upload_track_credit' : 'upload_album_credit';
    return !!ccPrices?.[key]?.is_active;
  }, [ccPrices, ccPricesLoading, ccPricesSupported, pendingPurchase?.feeType]);

  const handlePurchasePromptStripe = useCallback(() => {
    if (!pendingPurchase?.feeType) return;
    setPurchasePromptOpen(false);
    startEmbeddedCheckout({
      kind: 'upload_fee',
      payload: { fee_type: pendingPurchase.feeType },
      label: pendingPurchase.feeType === 'track' ? 'Track Upload Fee' : 'Album Upload Fee',
    });
  }, [pendingPurchase?.feeType, startEmbeddedCheckout]);

  const handlePurchasePromptCc = useCallback(async () => {
    if (!pendingPurchase?.feeType) return;
    setPurchasePromptBusy(true);
    try {
      await purchaseUploadCreditWithCc(pendingPurchase.feeType);
      setPurchasePromptOpen(false);
    } finally {
      setPurchasePromptBusy(false);
    }
  }, [pendingPurchase?.feeType, purchaseUploadCreditWithCc]);

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
            Billing (Stripe / CrossCoins)
          </h3>
          <p className="text-sm text-gray-300">
            Pay with Stripe for instant processing, or use your CrossCoins balance (if configured) for prepaid purchases.
          </p>
        </div>
        {hasStripeUnlimited ? (
          <Badge className="bg-green-600 text-white border-green-700">Subscription: {subscriptionStatus}</Badge>
        ) : hasPrepaidUnlimited ? (
          <Badge className="bg-green-600 text-white border-green-700">Unlimited: prepaid</Badge>
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
              Stripe: Monthly
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-yellow-400/40 text-yellow-200 hover:bg-yellow-400/10"
              disabled={checkoutLoading || hasActiveSubscription}
              onClick={() => startEmbeddedCheckout({ kind: 'creator_subscription', payload: { plan: 'six_months' }, label: 'Unlimited Uploads — 6 Months' })}
            >
              Stripe: 6 Months
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-yellow-400/40 text-yellow-200 hover:bg-yellow-400/10"
              disabled={checkoutLoading || hasActiveSubscription}
              onClick={() => startEmbeddedCheckout({ kind: 'creator_subscription', payload: { plan: 'yearly' }, label: 'Unlimited Uploads — Yearly' })}
            >
              Stripe: Yearly
            </Button>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/10 p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-gray-300 flex items-center gap-2">
                <Coins className="w-4 h-4 text-yellow-300" />
                Pay with CrossCoins
              </div>
              <div className="text-[11px] text-gray-400">Balance: {Number.isFinite(walletBalance) ? walletBalance.toLocaleString() : '0'} CC</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-yellow-400/40 text-yellow-200 hover:bg-yellow-400/10"
                disabled={checkoutLoading || hasActiveSubscription || !ccPricesSupported || ccPricesLoading || !ccPrices?.unlimited_monthly?.is_active}
                onClick={() => purchaseUnlimitedWithCc('monthly')}
              >
                CC: Monthly {ccPrices?.unlimited_monthly?.is_active ? `(${Number(ccPrices.unlimited_monthly.price_cc || 0).toLocaleString()} CC)` : '(setup)'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-yellow-400/40 text-yellow-200 hover:bg-yellow-400/10"
                disabled={checkoutLoading || hasActiveSubscription || !ccPricesSupported || ccPricesLoading || !ccPrices?.unlimited_6mo?.is_active}
                onClick={() => purchaseUnlimitedWithCc('six_months')}
              >
                CC: 6 Months {ccPrices?.unlimited_6mo?.is_active ? `(${Number(ccPrices.unlimited_6mo.price_cc || 0).toLocaleString()} CC)` : '(setup)'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-yellow-400/40 text-yellow-200 hover:bg-yellow-400/10"
                disabled={checkoutLoading || hasActiveSubscription || !ccPricesSupported || ccPricesLoading || !ccPrices?.unlimited_yearly?.is_active}
                onClick={() => purchaseUnlimitedWithCc('yearly')}
              >
                CC: Yearly {ccPrices?.unlimited_yearly?.is_active ? `(${Number(ccPrices.unlimited_yearly.price_cc || 0).toLocaleString()} CC)` : '(setup)'}
              </Button>
            </div>
            {!ccPricesSupported ? (
              <div className="text-[11px] text-gray-500">CC billing not enabled on this deployment yet (run `creator_billing_cc.sql`).</div>
            ) : null}
          </div>
          {hasActiveSubscription ? (
            <p className="text-xs text-green-300">
              Unlimited access detected {hasPrepaidUnlimited && !hasStripeUnlimited ? `(prepaid via CC${profile?.creator_unlimited_expires_at ? ` until ${new Date(profile.creator_unlimited_expires_at).toLocaleDateString()}` : ''})` : ''}. If you need changes, manage it in Stripe customer portal (coming soon).
            </p>
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
              Stripe: Track Credit
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-yellow-400/40 text-yellow-200 hover:bg-yellow-400/10"
              disabled={checkoutLoading}
              onClick={() => startEmbeddedCheckout({ kind: 'upload_fee', payload: { fee_type: 'album' }, label: 'Album Upload Fee' })}
            >
              Stripe: Album Credit
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-yellow-400/40 text-yellow-200 hover:bg-yellow-400/10"
              disabled={checkoutLoading || !ccPricesSupported || ccPricesLoading || !ccPrices?.upload_track_credit?.is_active}
              onClick={() => purchaseUploadCreditWithCc('track')}
            >
              CC: Track {ccPrices?.upload_track_credit?.is_active ? `(${Number(ccPrices.upload_track_credit.price_cc || 0).toLocaleString()} CC)` : '(setup)'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-yellow-400/40 text-yellow-200 hover:bg-yellow-400/10"
              disabled={checkoutLoading || !ccPricesSupported || ccPricesLoading || !ccPrices?.upload_album_credit?.is_active}
              onClick={() => purchaseUploadCreditWithCc('album')}
            >
              CC: Album {ccPrices?.upload_album_credit?.is_active ? `(${Number(ccPrices.upload_album_credit.price_cc || 0).toLocaleString()} CC)` : '(setup)'}
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

      <Dialog
        open={purchasePromptOpen}
        onOpenChange={(open) => {
          if (purchasePromptBusy) return;
          setPurchasePromptOpen(open);
          if (!open) setPendingPurchase(null);
        }}
      >
        <DialogContent className="max-w-lg w-[95vw] glass-effect-light text-white p-4">
          <DialogHeader className="space-y-2">
            <DialogTitle className="golden-text text-xl">Purchase upload credit</DialogTitle>
            <DialogDescription className="text-gray-300">
              Choose a payment method for a {pendingPurchase?.feeType === 'album' ? 'Album' : 'Track'} upload credit.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-gray-300 space-y-2">
            <div className="flex items-center justify-between">
              <span>CrossCoins balance</span>
              <span className="text-yellow-200 font-semibold">{Number.isFinite(walletBalance) ? walletBalance.toLocaleString() : '0'} CC</span>
            </div>
            {pendingCcEnabled ? (
              <div className="text-xs text-gray-400">
                CC price: {Number(pendingCcPrice || 0).toLocaleString()} CC
              </div>
            ) : (
              <div className="text-xs text-gray-500">CC purchase not available for this item on this deployment.</div>
            )}
          </div>

          <div className="pt-2 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="bg-white/5 border-white/15 text-gray-200 hover:bg-white/10"
              disabled={purchasePromptBusy}
              onClick={() => setPurchasePromptOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-yellow-400/40 text-yellow-200 hover:bg-yellow-400/10"
              disabled={purchasePromptBusy || checkoutLoading || !canUseStripe}
              onClick={handlePurchasePromptStripe}
            >
              {checkoutLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Pay with Stripe
            </Button>
            <Button
              type="button"
              className="golden-gradient text-black font-semibold"
              disabled={purchasePromptBusy || checkoutLoading || !pendingCcEnabled}
              onClick={handlePurchasePromptCc}
            >
              {purchasePromptBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Pay with CrossCoins
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreatorBillingPanel;
