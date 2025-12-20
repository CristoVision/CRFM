import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { requestWalletAction } from '@/lib/walletActions';
import { redeemCode } from '@/lib/billingActions';
import { AlertCircle, CheckCircle, Loader2, ShieldCheck, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { CROSSCOIN_ICON_URL } from '@/lib/brandAssets';
import { useLanguage } from '@/contexts/LanguageContext';

// --- Stripe Imports ---
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import CheckoutForm from './CheckoutForm';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

const defaultState = {
  amount: '',
  method: 'card',
  details: '',
  notes: '',
  code: '',
};

const WalletActionModal = ({ actionType, open, onOpenChange, balance = 0, userId, onSuccess, returnUrl }) => {
  const { t } = useLanguage();
  const [formState, setFormState] = useState(defaultState);
  const [submitting, setSubmitting] = useState(false);
  const [addFundsUnit, setAddFundsUnit] = useState('cc'); // 'cc' | 'usd'
  
  // --- New state for Stripe payment flow ---
  const [step, setStep] = useState('amount'); // 'amount' | 'payment'
  const [clientSecret, setClientSecret] = useState('');

  useEffect(() => {
    if (open) {
      setFormState(defaultState);
      setSubmitting(false);
      setStep('amount');
      setClientSecret('');
      setAddFundsUnit('cc');
    }
  }, [open, actionType]);

  const actionCopy = useMemo(
    () => ({
      add_funds: {
        title: t('wallet.actions.addFundsTitle'),
        description: t('wallet.actions.addFundsDesc'),
        successTitle: t('wallet.actions.successTitleAdd'),
        successDescription: t('wallet.actions.successDescAdd'),
      },
      withdraw: {
        title: t('wallet.actions.withdrawTitle'),
        description: t('wallet.actions.withdrawDesc'),
        successTitle: t('wallet.actions.successTitleWithdraw'),
        successDescription: t('wallet.actions.successDescWithdraw'),
      },
      redeem_code: {
        title: t('wallet.actions.redeemCodeTitle'),
        description: t('wallet.actions.redeemCodeDesc'),
        successTitle: t('wallet.actions.successTitleRedeem'),
        successDescription: t('wallet.actions.successDescRedeem'),
      },
    }),
    [t]
  );
  const copy = actionCopy[actionType] || {};

  if (!actionType) return null;

  const ccToUsd = 0.01; // must match Edge Function default CC_TO_USD
  const parsedInput = Number(formState.amount);
  const inputIsValid = Number.isFinite(parsedInput) && parsedInput > 0;
  const amountCcDerived =
    actionType === 'add_funds'
      ? addFundsUnit === 'usd'
        ? (inputIsValid ? parsedInput / ccToUsd : NaN)
        : parsedInput
      : parsedInput;
  const amountUsdDerived =
    actionType === 'add_funds'
      ? addFundsUnit === 'usd'
        ? parsedInput
        : (Number.isFinite(amountCcDerived) ? amountCcDerived * ccToUsd : NaN)
      : NaN;

  const handleContinueToAddFunds = async () => {
    if (!userId) {
      toast({ title: t('wallet.actions.loginRequired'), description: t('wallet.actions.loginRequiredBody'), variant: 'destructive' });
      return;
    }
    if (!STRIPE_PUBLISHABLE_KEY || !stripePromise) {
      toast({
        title: t('wallet.actions.stripeNotConfigured'),
        description: t('wallet.actions.stripeMissingKey'),
        variant: 'destructive',
      });
      return;
    }
    const amountCc = amountCcDerived;
    if (!Number.isFinite(amountCc) || amountCc <= 0) {
      toast({ title: t('wallet.actions.invalidAmount'), description: t('wallet.actions.invalidAmountBody'), variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-create-payment-intent', {
        body: { amount_cc: Number(amountCc.toFixed(2)) },
      });
      if (error) throw error;
      if (!data?.clientSecret) throw new Error('Missing client secret.');

      setClientSecret(data.clientSecret);
      setStep('payment');
    } catch (err) {
      toast({
        title: t('wallet.actions.paymentStartFailed'),
        description: err.message || t('wallet.actions.paymentStartFailedBody'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleLegacySubmit = async (event) => {
    event.preventDefault();
    // This function now only handles 'withdraw' and 'redeem_code'
    if (actionType === 'add_funds') return;

    setSubmitting(true);
    const result = actionType === 'redeem_code'
      ? await redeemCode({ code: formState.code, metadata: {} })
      : await requestWalletAction({
        userId,
        actionType,
        amount: formState.amount,
        metadata: { method: formState.method, details: formState.details?.trim() || undefined, notes: formState.notes?.trim() || undefined },
        maxDebit: actionType === 'withdraw' ? balance : undefined,
      });
    setSubmitting(false);

    if (result.success) {
      toast({
        title: actionCopy[actionType].successTitle,
        description: result?.data?.type === 'membership_grant' ? t('wallet.actions.membershipGranted') : actionCopy[actionType].successDescription,
        className: 'bg-green-600 text-white',
      });
      onSuccess?.(result);
      onOpenChange(false);
    } else {
      toast({
        title: t('wallet.actions.requestFailed'),
        description: result.error || t('wallet.actions.requestFailedBody'),
        variant: 'destructive',
      });
    }
  };

  const renderAddFundsContent = () => {
    if (step === 'payment' && clientSecret) {
      if (!stripePromise) {
        return (
          <>
            <DialogHeader className="space-y-2">
              <DialogTitle className="golden-text text-2xl flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-400" />
                {t('wallet.actions.stripeNotConfigured')}
              </DialogTitle>
              <DialogDescription className="text-gray-300 leading-relaxed">
                {t('wallet.actions.stripeMissingKey')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="pt-5">
              <Button type="button" variant="outline" onClick={() => setStep('amount')} className="text-gray-300 border-gray-500 hover:border-yellow-400 hover:text-yellow-300">
                {t('wallet.actions.back')}
              </Button>
            </DialogFooter>
          </>
        );
      }
      const options = { clientSecret };
      return (
        <>
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setStep('amount')} className="h-7 w-7">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <DialogTitle className="golden-text text-2xl">{t('wallet.actions.completePayment')}</DialogTitle>
            </div>
            <DialogDescription className="text-gray-300 leading-relaxed pl-10">
              {t('wallet.actions.stripePaymentNote')}
            </DialogDescription>
          </DialogHeader>
          <div className="px-1 py-4">
            <Elements options={options} stripe={stripePromise}>
              <CheckoutForm onSuccess={() => onOpenChange(false)} onCancel={() => setStep('amount')} returnUrl={returnUrl} />
            </Elements>
          </div>
        </>
      );
    }

    // Step 'amount'
    return (
      <>
        <DialogHeader className="space-y-2">
          <DialogTitle className="golden-text text-2xl flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-yellow-400" />
            {copy.title}
          </DialogTitle>
          <DialogDescription className="text-gray-300 leading-relaxed">
            {copy.description}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 pt-4">
          <div className="space-y-2">
            <div className="flex items-end justify-between gap-3">
              <Label htmlFor="wallet-amount" className="text-gray-200">
                {t('wallet.actions.amountLabel', { unit: addFundsUnit === 'usd' ? t('wallet.actions.unitUsd') : t('wallet.actions.unitCc') })}
              </Label>
              <div className="flex items-center gap-2 text-xs text-gray-300">
                <button
                  type="button"
                  onClick={() => setAddFundsUnit('cc')}
                  className={`px-2 py-1 rounded-md border ${addFundsUnit === 'cc' ? 'border-yellow-400/60 text-yellow-200 bg-yellow-400/10' : 'border-white/10 hover:border-white/20'}`}
                >
                  {t('wallet.actions.unitCc')}
                </button>
                <button
                  type="button"
                  onClick={() => setAddFundsUnit('usd')}
                  className={`px-2 py-1 rounded-md border ${addFundsUnit === 'usd' ? 'border-yellow-400/60 text-yellow-200 bg-yellow-400/10' : 'border-white/10 hover:border-white/20'}`}
                >
                  {t('wallet.actions.unitUsd')}
                </button>
              </div>
            </div>
            <Input
              id="wallet-amount"
              type="number"
              min={addFundsUnit === 'usd' ? '0.50' : '1'}
              step={addFundsUnit === 'usd' ? '0.01' : 'any'}
              value={formState.amount}
              onChange={(e) => setFormState((prev) => ({ ...prev, amount: e.target.value }))}
              placeholder={addFundsUnit === 'usd' ? t('wallet.actions.amountPlaceholderUsd') : t('wallet.actions.amountPlaceholderCc')}
              className="bg-black/20 border-white/10 text-white placeholder-gray-500 focus:border-yellow-400"
              required
            />
            <div className="text-xs text-gray-400 space-y-1">
              <p className="flex items-center gap-2">
                <img
                  src={CROSSCOIN_ICON_URL}
                  alt="CrossCoin"
                  className="w-4 h-4"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/favicon-32x32.png';
                  }}
                />
                <span>{t('wallet.actions.rateLabel', { rate: ccToUsd.toFixed(2) })}</span>
              </p>
              <p>{t('wallet.actions.typicalLimits')}</p>
              {Number.isFinite(amountCcDerived) && amountCcDerived > 0 && (
                <p>
                  {t('wallet.actions.youPay', {
                    amount: `$${Number(amountUsdDerived).toFixed(2)}`,
                    cc: Number(amountCcDerived).toFixed(2),
                  })}
                </p>
              )}
              {Number.isFinite(amountCcDerived) && amountCcDerived > 0 && (
                <p>
                  {t('wallet.actions.afterTopUp', {
                    cc: Number((Number(balance) || 0) + amountCcDerived).toFixed(2),
                    usd: `$${Number(((Number(balance) || 0) + amountCcDerived) * ccToUsd).toFixed(2)}`,
                  })}
                </p>
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="pt-5">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-gray-300 border-gray-500 hover:border-yellow-400 hover:text-yellow-300"
          >
            {t('wallet.actions.cancel')}
          </Button>
          <Button type="button" onClick={handleContinueToAddFunds} className="golden-gradient text-black font-semibold" disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {t('wallet.actions.continue')}
          </Button>
        </DialogFooter>
      </>
    );
  };

  const renderLegacyContent = () => (
    <form className="space-y-5" onSubmit={handleLegacySubmit}>
      <DialogHeader className="space-y-2">
        <DialogTitle className="golden-text text-2xl flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-yellow-400" />
          {copy.title}
        </DialogTitle>
        <DialogDescription className="text-gray-300 leading-relaxed">
          {copy.description}
        </DialogDescription>
      </DialogHeader>
      
      {actionType !== 'redeem_code' && (
        <div className="space-y-2">
          <Label htmlFor="wallet-amount-legacy" className="text-gray-200">
            {actionType === 'withdraw' ? t('wallet.actions.amountWithdrawable') : t('wallet.actions.amountCrossCoins')}
          </Label>
          <Input id="wallet-amount-legacy" type="number" min="0" step="any" value={formState.amount} onChange={(e) => setFormState((prev) => ({ ...prev, amount: e.target.value }))} placeholder={t('wallet.actions.amountLegacyPlaceholder')} className="bg-black/20 border-white/10 text-white placeholder-gray-500 focus:border-yellow-400" required/>
          {actionType === 'withdraw' && (<p className="text-xs text-gray-400">{t('wallet.actions.available', { amount: balance?.toLocaleString?.() || balance })}</p>)}
        </div>
      )}
      {actionType === 'redeem_code' && (
         <div className="space-y-2">
            <Label htmlFor="wallet-code" className="text-gray-200">{t('wallet.actions.codeLabel')}</Label>
            <Input id="wallet-code" type="text" value={formState.code} onChange={(e) => setFormState((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))} placeholder={t('wallet.actions.codePlaceholder')} className="bg-black/20 border-white/10 text-white placeholder-gray-500 focus:border-yellow-400 uppercase" required />
         </div>
      )}
      {actionType === 'withdraw' && (
        <>
          <div className="space-y-2">
            <Label>{t('wallet.actions.payoutMethod')}</Label>
            <Select value={formState.method} onValueChange={(value) => setFormState((prev) => ({ ...prev, method: value }))}>
              <SelectTrigger className="w-full bg-black/20 border-white/10 text-white focus:border-yellow-400"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-neutral-900 border-neutral-700 text-white">
                <SelectItem value="paypal">{t('wallet.actions.payoutOptions.paypal')}</SelectItem>
                <SelectItem value="bank_transfer">{t('wallet.actions.payoutOptions.bankTransfer')}</SelectItem>
                <SelectItem value="wise">{t('wallet.actions.payoutOptions.wise')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('wallet.actions.payoutDetails')}</Label>
            <Input type="text" value={formState.details} onChange={(e) => setFormState((prev) => ({ ...prev, details: e.target.value }))} placeholder={t('wallet.actions.payoutDetailsPlaceholder')} className="bg-black/20 border-white/10 text-white placeholder-gray-500 focus:border-yellow-400" />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-200">{t('wallet.actions.notesOptional')}</Label>
            <Textarea value={formState.notes} onChange={(e) => setFormState((prev) => ({ ...prev, notes: e.target.value }))} placeholder={t('wallet.actions.notesPlaceholder')} className="bg-black/20 border-white/10 text-white placeholder-gray-500 focus:border-yellow-400 min-h-[90px]" />
          </div>
        </>
      )}

      <DialogFooter className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-4">
        <div className="flex items-center text-green-300 text-xs gap-2">
          <CheckCircle className="w-4 h-4" />
          <span>{t('wallet.actions.secureHandling')}</span>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none text-gray-300 border-gray-500 hover:border-yellow-400 hover:text-yellow-300">{t('wallet.actions.cancel')}</Button>
          <Button type="submit" className="flex-1 sm:flex-none golden-gradient text-black font-semibold" disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {t('wallet.actions.submitRequest')}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg glass-effect text-white font-montserrat max-h-[85vh] overflow-y-auto">
        {actionType === 'add_funds' ? renderAddFundsContent() : renderLegacyContent()}
      </DialogContent>
    </Dialog>
  );
};

export default WalletActionModal;
