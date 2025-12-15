import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { purchaseCreatorMembership } from '@/lib/billingActions';
import { Crown, Loader2, Percent } from 'lucide-react';

const DEFAULT_CODE_STATE = { open: false, tier: null, code: '' };

const MembershipPanel = ({ creatorId }) => {
  const { user, refreshUserProfile } = useAuth();
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [membership, setMembership] = useState(null);
  const [purchaseState, setPurchaseState] = useState(DEFAULT_CODE_STATE);
  const [submitting, setSubmitting] = useState(false);

  const canShowMembership = !!user?.id && !!creatorId;

  const load = useCallback(async () => {
    if (!creatorId) return;
    setLoading(true);
    try {
      const [{ data: tierRows, error: tierError }, membershipResult] = await Promise.all([
        supabase
          .from('creator_membership_tiers')
          .select('id, name, description, price_cc, duration_days, is_active')
          .eq('creator_id', creatorId)
          .eq('is_active', true)
          .order('price_cc', { ascending: true }),
        canShowMembership
          ? supabase
            .from('creator_memberships')
            .select('id, status, tier_id, expires_at, started_at')
            .eq('creator_id', creatorId)
            .eq('user_id', user.id)
            .eq('status', 'active')
            .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (tierError && tierError.code !== 'PGRST116') throw tierError;
      setTiers(tierRows || []);

      if (membershipResult?.error && membershipResult.error.code !== 'PGRST116') throw membershipResult.error;
      setMembership(membershipResult?.data || null);
    } catch (error) {
      toast({
        title: 'Membership load failed',
        description: error.message || 'Could not load membership options.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [creatorId, canShowMembership, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const activeTier = useMemo(() => {
    if (!membership?.tier_id) return null;
    return tiers.find((t) => t.id === membership.tier_id) || null;
  }, [membership?.tier_id, tiers]);

  const openPurchase = (tier) => {
    if (!user) {
      toast({ title: 'Login required', description: 'Sign in to join a membership.', variant: 'destructive' });
      return;
    }
    setPurchaseState({ open: true, tier, code: '' });
  };

  const closePurchase = () => {
    if (submitting) return;
    setPurchaseState(DEFAULT_CODE_STATE);
  };

  const handlePurchase = async () => {
    if (!purchaseState.tier?.id) return;
    setSubmitting(true);
    const result = await purchaseCreatorMembership({
      creatorId,
      tierId: purchaseState.tier.id,
      code: purchaseState.code,
      metadata: {},
    });
    setSubmitting(false);

    if (!result.success) {
      toast({ title: 'Purchase failed', description: result.error, variant: 'destructive' });
      return;
    }

    toast({
      title: 'Membership activated',
      description: `Charged ${result.data?.net_cc ?? 0} CC.`,
      className: 'bg-green-600 text-white',
    });

    await refreshUserProfile?.();
    closePurchase();
    load();
  };

  if (loading) {
    return (
      <div className="glass-effect p-4 rounded-xl border border-white/10 flex items-center gap-3 text-gray-300">
        <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
        <span>Loading memberships…</span>
      </div>
    );
  }

  if (!tiers.length) return null;

  return (
    <>
      <div className="glass-effect p-4 sm:p-6 rounded-xl border border-white/10 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-white">Creator Membership</h3>
          </div>
          {membership?.status === 'active' && (
            <Badge className="bg-green-500/20 text-green-200">
              Active{membership.expires_at ? ` until ${new Date(membership.expires_at).toLocaleDateString()}` : ''}
            </Badge>
          )}
        </div>

        {membership?.status === 'active' && (
          <div className="text-sm text-gray-300">
            <div>Tier: <span className="text-white font-semibold">{activeTier?.name || 'Member'}</span></div>
            {membership.expires_at && <div>Renews/ends: {new Date(membership.expires_at).toLocaleString()}</div>}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {tiers.map((tier) => (
            <div key={tier.id} className="p-4 rounded-lg border border-white/10 bg-white/5 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-white font-semibold">{tier.name}</div>
                  {tier.description && <div className="text-sm text-gray-300 mt-1">{tier.description}</div>}
                </div>
                <div className="text-right">
                  <div className="text-yellow-300 font-semibold">{Number(tier.price_cc || 0).toLocaleString()} CC</div>
                  <div className="text-xs text-gray-400">{tier.duration_days} days</div>
                </div>
              </div>
              <div className="pt-2">
                <Button
                  onClick={() => openPurchase(tier)}
                  className="w-full golden-gradient text-black font-semibold"
                  disabled={!user}
                >
                  Join
                </Button>
                {!user && <div className="text-xs text-gray-400 mt-2">Sign in to join.</div>}
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-gray-400 flex items-center gap-2">
          <Percent className="w-4 h-4 text-yellow-400" />
          <span>Have a discount code? Apply it at checkout.</span>
        </div>
      </div>

      <Dialog open={purchaseState.open} onOpenChange={(v) => (v ? null : closePurchase())}>
        <DialogContent className="sm:max-w-lg glass-effect text-white font-montserrat">
          <DialogHeader className="space-y-2">
            <DialogTitle className="golden-text text-2xl">Join {purchaseState.tier?.name}</DialogTitle>
            <DialogDescription className="text-gray-300">
              Optional: enter a discount code. Charges are processed server-side.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="text-sm text-gray-300">
              Price: <span className="text-white font-semibold">{Number(purchaseState.tier?.price_cc || 0).toLocaleString()} CC</span>
              {' '}for {purchaseState.tier?.duration_days} days.
            </div>
            <Input
              value={purchaseState.code}
              onChange={(e) => setPurchaseState((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
              placeholder="DISCOUNT-2025"
              className="bg-black/20 border-white/10 text-white placeholder-gray-500 uppercase"
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={closePurchase}
              disabled={submitting}
              className="flex-1 text-gray-300 border-gray-500 hover:border-yellow-400 hover:text-yellow-300"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handlePurchase}
              disabled={submitting}
              className="flex-1 golden-gradient text-black font-semibold"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MembershipPanel;
