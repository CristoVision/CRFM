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

// --- Stripe Imports ---
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import CheckoutForm from './CheckoutForm';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const ACTION_COPY = {
  add_funds: {
    title: 'Add Funds',
    description: 'Top up your CrossCoins balance. All payments are processed securely by Stripe.',
  },
  withdraw: {
    title: 'Withdraw',
    description: 'Request a payout from your CrossCoins balance. We review withdrawals to prevent fraud and chargebacks.',
  },
  redeem_code: {
    title: 'Redeem Code',
    description: 'Redeem a promo or gift code. Codes are validated server-side.',
  },
};

const defaultState = {
  amount: '',
  method: 'card',
  details: '',
  notes: '',
  code: '',
};

const WalletActionModal = ({ actionType, open, onOpenChange, balance = 0, userId, onSuccess }) => {
  const [formState, setFormState] = useState(defaultState);
  const [submitting, setSubmitting] = useState(false);
  
  // --- New state for Stripe payment flow ---
  const [step, setStep] = useState('amount'); // 'amount' | 'payment'
  const [clientSecret, setClientSecret] = useState('');

  useEffect(() => {
    if (open) {
      setFormState(defaultState);
      setSubmitting(false);
      setStep('amount');
      setClientSecret('');
    }
  }, [open, actionType]);

  const copy = useMemo(() => ACTION_COPY[actionType] || {}, [actionType]);

  if (!actionType) return null;

  const handleContinueToAddFunds = async () => {
    if (!userId) {
      toast({ title: 'Login required', description: 'Please sign in to continue.', variant: 'destructive' });
      return;
    }
    const amountCc = Number(formState.amount);
    if (!Number.isFinite(amountCc) || amountCc <= 0) {
      toast({ title: 'Invalid amount', description: 'Enter a positive amount.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-create-payment-intent', {
        body: { amount_cc: amountCc },
      });
      if (error) throw error;
      if (!data?.clientSecret) throw new Error('Missing client secret.');

      setClientSecret(data.clientSecret);
      setStep('payment');
    } catch (err) {
      toast({
        title: 'Could not start payment',
        description: err.message || 'An unexpected error occurred. Please try again.',
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
        title: ACTION_COPY[actionType].successTitle,
        description: result?.data?.type === 'membership_grant' ? 'Membership granted.' : ACTION_COPY[actionType].successDescription,
        className: 'bg-green-600 text-white',
      });
      onSuccess?.(result);
      onOpenChange(false);
    } else {
      toast({
        title: 'Request failed',
        description: result.error || 'Could not submit your request.',
        variant: 'destructive',
      });
    }
  };

  const renderAddFundsContent = () => {
    if (step === 'payment' && clientSecret) {
      const options = { clientSecret };
      return (
        <>
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setStep('amount')} className="h-7 w-7">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <DialogTitle className="golden-text text-2xl">Complete Your Payment</DialogTitle>
            </div>
            <DialogDescription className="text-gray-300 leading-relaxed pl-10">
              Your payment is processed securely by Stripe. We do not handle your card information.
            </DialogDescription>
          </DialogHeader>
          <div className="px-1 py-4">
            <Elements options={options} stripe={stripePromise}>
              <CheckoutForm onSuccess={() => onOpenChange(false)} onCancel={() => setStep('amount')} />
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
            <Label htmlFor="wallet-amount" className="text-gray-200">Amount (CrossCoins)</Label>
            <Input
              id="wallet-amount"
              type="number"
              min="1"
              step="any"
              value={formState.amount}
              onChange={(e) => setFormState((prev) => ({ ...prev, amount: e.target.value }))}
              placeholder="e.g., 500"
              className="bg-black/20 border-white/10 text-white placeholder-gray-500 focus:border-yellow-400"
              required
            />
          </div>
        </div>
        <DialogFooter className="pt-5">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-gray-300 border-gray-500 hover:border-yellow-400 hover:text-yellow-300"
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleContinueToAddFunds} className="golden-gradient text-black font-semibold" disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Continue
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
          <Label htmlFor="wallet-amount-legacy" className="text-gray-200">Amount (CrossCoins)</Label>
          <Input id="wallet-amount-legacy" type="number" min="0" step="any" value={formState.amount} onChange={(e) => setFormState((prev) => ({ ...prev, amount: e.target.value }))} placeholder="e.g., 250" className="bg-black/20 border-white/10 text-white placeholder-gray-500 focus:border-yellow-400" required/>
          {actionType === 'withdraw' && (<p className="text-xs text-gray-400">Available: {balance?.toLocaleString?.() || balance} CC</p>)}
        </div>
      )}
      {actionType === 'redeem_code' && (
         <div className="space-y-2">
            <Label htmlFor="wallet-code" className="text-gray-200">Code</Label>
            <Input id="wallet-code" type="text" value={formState.code} onChange={(e) => setFormState((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))} placeholder="ENTER-CODE-123" className="bg-black/20 border-white/10 text-white placeholder-gray-500 focus:border-yellow-400 uppercase" required />
         </div>
      )}
      {actionType === 'withdraw' && (
        <>
          <div className="space-y-2">
            <Label>Payout Method</Label>
            <Select value={formState.method} onValueChange={(value) => setFormState((prev) => ({ ...prev, method: value }))}>
              <SelectTrigger className="w-full bg-black/20 border-white/10 text-white focus:border-yellow-400"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-neutral-900 border-neutral-700 text-white">
                <SelectItem value="paypal">PayPal</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer (ACH)</SelectItem>
                <SelectItem value="wise">Wise / International</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Payout Details</Label>
            <Input type="text" value={formState.details} onChange={(e) => setFormState((prev) => ({ ...prev, details: e.target.value }))} placeholder="PayPal email or bank account details" className="bg-black/20 border-white/10 text-white placeholder-gray-500 focus:border-yellow-400" />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-200">Notes (Optional)</Label>
            <Textarea value={formState.notes} onChange={(e) => setFormState((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Timing constraints, compliance details, etc." className="bg-black/20 border-white/10 text-white placeholder-gray-500 focus:border-yellow-400 min-h-[90px]" />
          </div>
        </>
      )}

      <DialogFooter className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-4">
        <div className="flex items-center text-green-300 text-xs gap-2">
          <CheckCircle className="w-4 h-4" />
          <span>Secure handling via admin review.</span>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none text-gray-300 border-gray-500 hover:border-yellow-400 hover:text-yellow-300">Cancel</Button>
          <Button type="submit" className="flex-1 sm:flex-none golden-gradient text-black font-semibold" disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Submit Request
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