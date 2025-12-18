import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import WalletActionModal from '@/components/wallet/WalletActionModal';
import { Coins, CreditCard, DollarSign, ExternalLink } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const formatNumber = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString();
};

const CreatorWalletPanel = () => {
  const { user, profile, refreshUserProfile } = useAuth();
  const [activeAction, setActiveAction] = useState(null); // 'add_funds' | 'withdraw' | null
  const canUseStripe = !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

  const walletBalance = useMemo(() => Number(profile?.wallet_balance || 0), [profile?.wallet_balance]);
  const withdrawableBalance = useMemo(() => {
    const raw = profile?.withdrawable_balance;
    if (raw === undefined || raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }, [profile?.withdrawable_balance]);

  if (!user) return null;

  const returnUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/hub?tab=monetization&wallet_checkout=success`
      : undefined;

  return (
    <>
      <WalletActionModal
        actionType={activeAction}
        open={!!activeAction}
        onOpenChange={(open) => (open ? null : setActiveAction(null))}
        balance={activeAction === 'withdraw' ? (withdrawableBalance ?? 0) : walletBalance}
        userId={user.id}
        returnUrl={activeAction === 'add_funds' ? returnUrl : undefined}
        onSuccess={() => {
          refreshUserProfile?.();
          try {
            window.dispatchEvent(new CustomEvent('crfm:creator_credits_updated'));
          } catch {
            // ignore
          }
        }}
      />

      <div className="glass-effect rounded-xl p-4 sm:p-6 border border-yellow-400/10 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-yellow-300 flex items-center gap-2">
              <Coins className="w-5 h-5" />
              CrossCoins Wallet
            </h3>
            <p className="text-sm text-gray-300">
              Use CC to pay for uploads/subscriptions, or withdraw stream earnings (reviewed).
            </p>
          </div>
          <Button asChild type="button" variant="ghost" className="text-gray-300 hover:text-yellow-200">
            <Link to="/wallet">
              Open Wallet <ExternalLink className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-gray-400">Available Balance</div>
            <div className="text-2xl font-semibold text-white">{formatNumber(walletBalance)} CC</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-gray-400">Withdrawable (Royalties)</div>
            <div className="text-2xl font-semibold text-white">
              {withdrawableBalance == null ? '—' : `${formatNumber(withdrawableBalance)} CC`}
            </div>
            {withdrawableBalance == null ? (
              <div className="text-[11px] text-gray-500 mt-1">Enable `profiles.withdrawable_balance` via `stripe_wallet.sql`.</div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="golden-gradient text-black font-semibold"
            disabled={!canUseStripe}
            onClick={() => {
              if (!canUseStripe) {
                toast({
                  title: 'Stripe not configured',
                  description: 'Missing VITE_STRIPE_PUBLISHABLE_KEY on this deployment (top-ups disabled).',
                  variant: 'destructive',
                });
                return;
              }
              setActiveAction('add_funds');
            }}
          >
            <DollarSign className="w-4 h-4 mr-2" />
            Top Up
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-yellow-400/40 text-yellow-200 hover:bg-yellow-400/10"
            disabled={withdrawableBalance == null || withdrawableBalance <= 0}
            onClick={() => setActiveAction('withdraw')}
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Withdraw
          </Button>
        </div>
      </div>
    </>
  );
};

export default CreatorWalletPanel;
