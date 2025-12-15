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
import { AlertCircle, CheckCircle, Loader2, ShieldCheck } from 'lucide-react';

const ACTION_COPY = {
  add_funds: {
    title: 'Add Funds',
    description: 'Submit a top-up request. We only credit your wallet after payment is confirmed by our processor.',
    successTitle: 'Top-up submitted',
    successDescription: 'We logged your request. Keep your email open in case we need to verify the payment.',
  },
  withdraw: {
    title: 'Withdraw',
    description: 'Request a payout from your CrossCoins balance. We review withdrawals to prevent fraud and chargebacks.',
    successTitle: 'Withdrawal requested',
    successDescription: 'We will review this payout. Expect status updates in your email and inside Wallet history.',
  },
  redeem_code: {
    title: 'Redeem Code',
    description: 'Redeem a promo or gift code. Codes are validated server-side; invalid or already-used codes are rejected.',
    successTitle: 'Code redeemed',
    successDescription: 'Your code was redeemed successfully.',
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

  useEffect(() => {
    if (open) {
      setFormState(defaultState);
      setSubmitting(false);
    }
  }, [open, actionType]);

  const copy = useMemo(() => ACTION_COPY[actionType] || {}, [actionType]);

  if (!actionType) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!userId) {
      toast({ title: 'Login required', description: 'Please sign in to continue.', variant: 'destructive' });
      return;
    }

    const metadata = {
      method: formState.method,
      details: formState.details?.trim() || undefined,
      notes: formState.notes?.trim() || undefined,
    };

    setSubmitting(true);
    const result = actionType === 'redeem_code'
      ? await redeemCode({ code: formState.code, metadata })
      : await requestWalletAction({
        userId,
        actionType,
        amount: actionType === 'redeem_code' ? null : formState.amount,
        code: actionType === 'redeem_code' ? formState.code : null,
        metadata,
        maxDebit: actionType === 'withdraw' ? balance : undefined,
      });
    setSubmitting(false);

    if (result.success) {
      toast({
        title: copy.successTitle,
        description:
          actionType === 'redeem_code'
            ? (result?.data?.type === 'membership_grant'
              ? 'Membership granted successfully.'
              : 'Code redeemed successfully.')
            : copy.successDescription,
        className: 'bg-green-600 text-white',
      });
      onSuccess?.(result);
      onOpenChange(false);
      return;
    }

    toast({
      title: 'Request failed',
      description: result.error || 'Could not submit your request. Please try again.',
      variant: 'destructive',
    });
  };

  const showAmount = actionType !== 'redeem_code';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg glass-effect text-white font-montserrat max-h-[85vh] overflow-y-auto">
        <DialogHeader className="space-y-2">
          <DialogTitle className="golden-text text-2xl flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-yellow-400" />
            {copy.title}
          </DialogTitle>
          <DialogDescription className="text-gray-300 leading-relaxed">
            {copy.description}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {showAmount && (
            <div className="space-y-2">
              <Label htmlFor="wallet-amount" className="text-gray-200">Amount (CrossCoins)</Label>
              <Input
                id="wallet-amount"
                type="number"
                min="0"
                step="any"
                value={formState.amount}
                onChange={(e) => setFormState((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder="e.g., 250"
                className="bg-black/20 border-white/10 text-white placeholder-gray-500 focus:border-yellow-400"
                required
              />
              {actionType === 'withdraw' && (
                <p className="text-xs text-gray-400">Available to withdraw: {balance?.toLocaleString?.() || balance} CC</p>
              )}
            </div>
          )}

          {actionType === 'redeem_code' && (
            <div className="space-y-2">
              <Label htmlFor="wallet-code" className="text-gray-200">Code</Label>
              <Input
                id="wallet-code"
                type="text"
                value={formState.code}
                onChange={(e) => setFormState((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                placeholder="ENTER-CODE-123"
                className="bg-black/20 border-white/10 text-white placeholder-gray-500 focus:border-yellow-400 uppercase"
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-gray-200">{actionType === 'withdraw' ? 'Payout method' : actionType === 'redeem_code' ? 'Code type' : 'Funding method'}</Label>
            <Select
              value={formState.method}
              onValueChange={(value) => setFormState((prev) => ({ ...prev, method: value }))}
            >
              <SelectTrigger className="w-full bg-black/20 border-white/10 text-white focus:border-yellow-400">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-neutral-900 border-neutral-700 text-white">
                {actionType === 'withdraw' ? (
                  <>
                    <SelectItem value="paypal">PayPal / Email transfer</SelectItem>
                    <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                    <SelectItem value="wise">Wise / International</SelectItem>
                  </>
                ) : actionType === 'redeem_code' ? (
                  <>
                    <SelectItem value="promo">Promo code</SelectItem>
                    <SelectItem value="gift">Gift / reward code</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="card">Card (Stripe)</SelectItem>
                    <SelectItem value="bank_transfer">Bank / ACH</SelectItem>
                    <SelectItem value="mobile_money">Mobile wallet</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-200">
              {actionType === 'withdraw'
                ? 'Where should we send the payout?'
                : actionType === 'redeem_code'
                ? 'Extra details (optional)'
                : 'Reference or receipt (optional)'}
            </Label>
            <Input
              type="text"
              value={formState.details}
              onChange={(e) => setFormState((prev) => ({ ...prev, details: e.target.value }))}
              placeholder={
                actionType === 'withdraw'
                  ? 'e.g., PayPal email or bank account ID'
                  : actionType === 'redeem_code'
                  ? 'Issuer, campaign, or where you received it'
                  : 'Payment reference, last 4 of card, or receipt URL'
              }
              className="bg-black/20 border-white/10 text-white placeholder-gray-500 focus:border-yellow-400"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-200">Notes</Label>
            <Textarea
              value={formState.notes}
              onChange={(e) => setFormState((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder={
                actionType === 'withdraw'
                  ? 'Tell us about timing constraints or compliance details.'
                  : 'Anything else our billing team should know.'
              }
              className="bg-black/20 border-white/10 text-white placeholder-gray-500 focus:border-yellow-400 min-h-[90px]"
            />
            <div className="flex items-center text-xs text-gray-400 gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-400" />
              <span>All requests are verified to prevent fraud and keep creator payouts safe.</span>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div className="flex items-center text-green-300 text-xs gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>Secure handling — no balance changes happen in the browser.</span>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 sm:flex-none text-gray-300 border-gray-500 hover:border-yellow-400 hover:text-yellow-300"
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1 sm:flex-none golden-gradient text-black font-semibold" disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Submit
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default WalletActionModal;
