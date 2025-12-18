import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Shield, Check, AlertTriangle, RefreshCw } from 'lucide-react';

const formatUsdCents = (cents) => {
  const n = Number(cents);
  if (!Number.isFinite(n)) return '—';
  return `$${(n / 100).toFixed(2)}`;
};

const formatNumber = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString();
};

const defaultMethod = {
  method_type: 'add_funds',
  name: '',
  provider: '',
  instructions: '',
  is_active: true,
};

const defaultCode = {
  code: '',
  amount: '',
  expires_at: '',
  max_uses: '1',
  notes: '',
};

const defaultPromo = {
  code: '',
  code_type: 'membership_discount_percent',
  creator_id: '',
  tier_id: '',
  grant_duration_days: '365',
  discount_percent: '10',
  first_time_only: true,
  expires_at: '',
  max_uses: '100',
  max_uses_per_user: '1',
  notes: '',
};

const WalletAdminTab = () => {
  const { profile } = useAuth();
  const [methods, setMethods] = useState([]);
  const [codes, setCodes] = useState([]);
  const [promoCodes, setPromoCodes] = useState([]);
  const [creators, setCreators] = useState([]);
  const [creatorTiers, setCreatorTiers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [missingTables, setMissingTables] = useState(false);
  const [missingPromoTables, setMissingPromoTables] = useState(false);
  const [financeOverview, setFinanceOverview] = useState(null);
  const [walletHolders, setWalletHolders] = useState([]);
  const [overviewDays, setOverviewDays] = useState('30');
  const [methodForm, setMethodForm] = useState(defaultMethod);
  const [codeForm, setCodeForm] = useState(defaultCode);
  const [promoForm, setPromoForm] = useState(defaultPromo);

  const isAdmin = !!profile?.is_admin;

  const loadData = useMemo(
    () => async () => {
      if (!isAdmin) return;
      setLoading(true);
      setMissingTables(false);
      setMissingPromoTables(false);
      try {
        const daysNum = Math.max(1, Number(overviewDays) || 30);
        const [
          { data: methodRows, error: methodError },
          { data: codeRows, error: codeError },
          { data: promoRows, error: promoError },
          { data: creatorRows, error: creatorError },
          { data: tierRows, error: tierError },
          { data: overviewData, error: overviewError },
          { data: holdersData, error: holdersError },
        ] =
          await Promise.all([
            supabase.from('wallet_methods').select('*').order('created_at', { ascending: false }),
            supabase.from('wallet_redeem_codes').select('*').order('created_at', { ascending: false }),
            supabase.from('promo_codes').select('*').order('created_at', { ascending: false }),
            supabase.from('profiles').select('id, username, full_name, is_verified_creator').eq('is_verified_creator', true).order('username'),
            supabase.from('creator_membership_tiers').select('id, creator_id, name, price_cc, duration_days, is_active').order('created_at', { ascending: false }),
            supabase.rpc('rpc_admin_finance_overview', { p_days: daysNum }),
            supabase.rpc('rpc_admin_wallet_holders', { p_limit: 50 }),
          ]);

        if (methodError?.code === 'PGRST116' || codeError?.code === 'PGRST116') {
          setMissingTables(true);
          setMethods([]);
          setCodes([]);
        }

        if (promoError?.code === 'PGRST116' || creatorError?.code === 'PGRST116' || tierError?.code === 'PGRST116') {
          setMissingPromoTables(true);
          setPromoCodes([]);
          setCreators([]);
          setCreatorTiers([]);
        }

        if (methodError && methodError.code !== 'PGRST116') throw methodError;
        if (codeError && codeError.code !== 'PGRST116') throw codeError;
        if (promoError && promoError.code !== 'PGRST116') throw promoError;
        if (creatorError && creatorError.code !== 'PGRST116') throw creatorError;
        if (tierError && tierError.code !== 'PGRST116') throw tierError;
        if (overviewError && overviewError.code !== 'PGRST116') throw overviewError;
        if (holdersError && holdersError.code !== 'PGRST116') throw holdersError;

        setMethods(methodRows || []);
        setCodes(codeRows || []);
        setPromoCodes(promoRows || []);
        setCreators(creatorRows || []);
        setCreatorTiers(tierRows || []);
        setFinanceOverview(overviewData || null);
        setWalletHolders(holdersData || []);
      } catch (err) {
        toast({
          title: 'Error loading wallet admin data',
          description: err.message,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    },
    [isAdmin, overviewDays]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateMethod = async (event) => {
    event.preventDefault();
    if (!methodForm.name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    try {
      const payload = {
        ...methodForm,
        name: methodForm.name.trim(),
        provider: methodForm.provider.trim() || null,
        instructions: methodForm.instructions.trim() || null,
        config: {},
        created_by: profile?.id || null,
      };
      const { error } = await supabase.from('wallet_methods').insert(payload);
      if (error) throw error;
      toast({ title: 'Method saved', description: payload.name });
      setMethodForm(defaultMethod);
      loadData();
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleToggleMethod = async (id, nextActive) => {
    setMethods((prev) => prev.map((m) => (m.id === id ? { ...m, is_active: nextActive } : m)));
    const { error } = await supabase.from('wallet_methods').update({ is_active: nextActive }).eq('id', id);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      loadData();
    }
  };

  const handleCreateCode = async (event) => {
    event.preventDefault();
    const amountNum = Number(codeForm.amount);
    const maxUsesNum = Number(codeForm.max_uses);

    if (!codeForm.code.trim()) {
      toast({ title: 'Code required', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast({ title: 'Amount invalid', description: 'Enter a positive number of CrossCoins.', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(maxUsesNum) || maxUsesNum <= 0) {
      toast({ title: 'Max uses invalid', description: 'Must be at least 1.', variant: 'destructive' });
      return;
    }

    try {
      const payload = {
        code: codeForm.code.trim().toUpperCase(),
        amount: Number(amountNum.toFixed(2)),
        max_uses: Math.floor(maxUsesNum),
        expires_at: codeForm.expires_at ? new Date(codeForm.expires_at).toISOString() : null,
        metadata: codeForm.notes ? { notes: codeForm.notes.trim() } : {},
        created_by: profile?.id || null,
      };
      const { error } = await supabase.from('wallet_redeem_codes').insert(payload);
      if (error) throw error;
      toast({ title: 'Code created', description: payload.code });
      setCodeForm(defaultCode);
      loadData();
    } catch (err) {
      toast({ title: 'Create failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleCreatePromoCode = async (event) => {
    event.preventDefault();
    const normalizedCode = promoForm.code.trim().toUpperCase();
    if (!normalizedCode) {
      toast({ title: 'Code required', variant: 'destructive' });
      return;
    }

    const maxUsesNum = Number(promoForm.max_uses);
    const maxUsesPerUserNum = Number(promoForm.max_uses_per_user);
    if (!Number.isFinite(maxUsesNum) || maxUsesNum <= 0) {
      toast({ title: 'Max uses invalid', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(maxUsesPerUserNum) || maxUsesPerUserNum <= 0) {
      toast({ title: 'Max uses per user invalid', variant: 'destructive' });
      return;
    }

    const basePayload = {
      code: normalizedCode,
      code_type: promoForm.code_type,
      creator_id: promoForm.creator_id || null,
      tier_id: promoForm.tier_id || null,
      first_time_only: !!promoForm.first_time_only,
      expires_at: promoForm.expires_at ? new Date(promoForm.expires_at).toISOString() : null,
      max_uses: Math.floor(maxUsesNum),
      max_uses_per_user: Math.floor(maxUsesPerUserNum),
      metadata: promoForm.notes ? { notes: promoForm.notes.trim() } : {},
      created_by: profile?.id || null,
    };

    if (promoForm.code_type === 'membership_grant') {
      const durationNum = Number(promoForm.grant_duration_days);
      if (!promoForm.creator_id) {
        toast({ title: 'Creator required', description: 'Membership grant codes must target a creator.', variant: 'destructive' });
        return;
      }
      if (!Number.isFinite(durationNum) || durationNum <= 0) {
        toast({ title: 'Duration invalid', description: 'Grant duration must be > 0 days.', variant: 'destructive' });
        return;
      }
      basePayload.grant_duration_days = Math.floor(durationNum);
      basePayload.discount_percent = null;
    } else {
      const pctNum = Number(promoForm.discount_percent);
      if (!Number.isFinite(pctNum) || pctNum <= 0 || pctNum > 100) {
        toast({ title: 'Discount invalid', description: 'Enter a percent between 1 and 100.', variant: 'destructive' });
        return;
      }
      basePayload.discount_percent = Number(pctNum.toFixed(2));
      basePayload.grant_duration_days = null;
    }

    try {
      const { error } = await supabase.from('promo_codes').insert(basePayload);
      if (error) throw error;
      toast({ title: 'Promo code created', description: basePayload.code });
      setPromoForm(defaultPromo);
      loadData();
    } catch (err) {
      toast({ title: 'Create failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleTogglePromoCode = async (code, nextActive) => {
    setPromoCodes((prev) => prev.map((c) => (c.code === code ? { ...c, is_active: nextActive } : c)));
    const { error } = await supabase.from('promo_codes').update({ is_active: nextActive }).eq('code', code);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      loadData();
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-[30vh] flex flex-col items-center justify-center text-center p-6 text-white">
        <Shield className="w-12 h-12 text-yellow-400 mb-3" />
        <p>Admin access required.</p>
      </div>
    );
  }

  const tiersForSelectedCreator = promoForm.creator_id
    ? creatorTiers.filter((t) => t.creator_id === promoForm.creator_id && t.is_active)
    : [];

  const liabilities = financeOverview?.liabilities || {};
  const topups = financeOverview?.topups || {};
  const streams = financeOverview?.streams || {};
  const memberships = financeOverview?.memberships || {};
  const creatorBilling = financeOverview?.creator_billing || {};
  const topupsByCountry = Array.isArray(topups?.by_country_window) ? topups.by_country_window : [];
  const topupsByCity = Array.isArray(topups?.by_city_window) ? topups.by_city_window : [];

  return (
    <div className="space-y-6">
      <div className="glass-effect rounded-xl border border-white/10 p-5">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-yellow-400" />
              Finance Overview
            </h2>
            <p className="text-sm text-gray-400">
              Totals and liabilities across wallets, royalties, and Stripe top-ups (gross/fee/net).
            </p>
          </div>
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label className="text-gray-200">Window (days)</Label>
              <Input
                type="number"
                min="1"
                value={overviewDays}
                onChange={(e) => setOverviewDays(e.target.value)}
                className="w-32 bg-black/30 border-white/10 text-white"
              />
            </div>
            <Button type="button" variant="outline" className="border-white/10 text-gray-200" onClick={loadData} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-gray-400">Wallet Liabilities (CC)</div>
            <div className="text-2xl font-semibold text-white">{formatNumber(liabilities.wallet_total_cc)} CC</div>
            <div className="text-[11px] text-gray-500">Total spendable balances held by users.</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-gray-400">Royalties Owed (CC)</div>
            <div className="text-2xl font-semibold text-white">{formatNumber(liabilities.withdrawable_total_cc)} CC</div>
            <div className="text-[11px] text-gray-500">
              Pending withdraw requests: {formatNumber(liabilities.withdraw_requests_pending_cc)} CC
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-gray-400">Stripe Top-Ups (Net)</div>
            <div className="text-2xl font-semibold text-white">{formatUsdCents(topups.net_usd_cents_window)}</div>
            <div className="text-[11px] text-gray-500">
              Window: {topups.count_window || 0} payments · Fees {formatUsdCents(topups.fee_usd_cents_window)}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-gray-400">Membership Purchases (CC)</div>
            <div className="text-2xl font-semibold text-white">{formatNumber(memberships.purchases_net_cc_window)} CC</div>
            <div className="text-[11px] text-gray-500">Window: {memberships.purchases_count_window || 0} purchases.</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-gray-400">Platform Fees (Streams)</div>
            <div className="text-2xl font-semibold text-white">{formatNumber(streams.platform_fee_cc_window)} CC</div>
            <div className="text-[11px] text-gray-500">
              Window spend: {formatNumber(streams.spend_cc_window)} CC · {streams.count_window || 0} streams
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-gray-400">Withdraw Approved (CC)</div>
            <div className="text-2xl font-semibold text-white">{formatNumber(liabilities.withdraw_requests_approved_cc)} CC</div>
            <div className="text-[11px] text-gray-500">Approved requests (treat as paid once processed externally).</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-gray-400">Creator Subscriptions</div>
            <div className="text-2xl font-semibold text-white">{creatorBilling.active_subscriptions || 0}</div>
            <div className="text-[11px] text-gray-500">Active + trialing users.</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-gray-400">Upload Fees (window)</div>
            <div className="text-2xl font-semibold text-white">
              {Number(creatorBilling.upload_fee_track_count_window || 0) + Number(creatorBilling.upload_fee_album_count_window || 0)}
            </div>
            <div className="text-[11px] text-gray-500">
              Track: {creatorBilling.upload_fee_track_count_window || 0} · Album: {creatorBilling.upload_fee_album_count_window || 0}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-gray-400">Top-Ups by Country (window)</div>
            <div className="text-sm text-gray-200 mt-1">
              {topupsByCountry.length === 0 ? (
                <span className="text-gray-500">No data yet.</span>
              ) : (
                topupsByCountry.slice(0, 5).map((row, idx) => (
                  <span key={`${row.country}-${idx}`} className="inline-block mr-3">
                    <span className="text-white font-semibold">{row.country}</span> <span className="text-gray-400">({row.count})</span>
                  </span>
                ))
              )}
            </div>
            <div className="text-xs text-gray-300 mt-2">
              Top cities:{' '}
              {topupsByCity.length === 0 ? (
                <span className="text-gray-500">—</span>
              ) : (
                topupsByCity.slice(0, 3).map((row, idx) => (
                  <span key={`${row.city}-${row.country}-${idx}`} className="inline-block mr-3">
                    <span className="text-white">{row.city}</span> <span className="text-gray-500">{row.country}</span>{' '}
                    <span className="text-gray-400">({row.count})</span>
                  </span>
                ))
              )}
            </div>
            <div className="text-[11px] text-gray-500">Country comes from Stripe billing_details when available.</div>
          </div>
        </div>
      </div>

      <div className="glass-effect rounded-xl border border-white/10 p-5">
        <h3 className="text-lg font-semibold text-white mb-2">Top Wallet Holders</h3>
        <p className="text-sm text-gray-400 mb-4">Ordered by wallet balance (CC). Useful for support and auditing.</p>
        <div className="space-y-2">
          {walletHolders.length === 0 ? (
            <p className="text-sm text-gray-500">No data.</p>
          ) : (
            walletHolders.map((row) => (
              <div key={row.user_id} className="p-3 rounded-lg border border-white/10 bg-white/5 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-[220px]">
                  <div className="text-sm text-white font-semibold">
                    {row.username || row.full_name || row.user_id}
                    {row.is_verified_creator ? <Badge className="ml-2 bg-purple-500/20 text-purple-200">Creator</Badge> : null}
                  </div>
                  <div className="text-xs text-gray-500">{row.user_id}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-gray-400">Wallet</div>
                    <div className="text-sm text-white font-semibold">{formatNumber(row.wallet_balance)} CC</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">Withdrawable</div>
                    <div className="text-sm text-white font-semibold">{formatNumber(row.withdrawable_balance)} CC</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {missingTables && (
        <div className="p-4 rounded-xl border border-yellow-500/40 bg-yellow-500/10 text-yellow-100 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5" />
          <div>
            <p className="font-semibold">Wallet tables missing.</p>
            <p>Apply <code>wallet_actions.sql</code> in Supabase to create wallet_action_requests, wallet_methods, and wallet_redeem_codes.</p>
          </div>
        </div>
      )}

      {missingPromoTables && (
        <div className="p-4 rounded-xl border border-yellow-500/40 bg-yellow-500/10 text-yellow-100 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5" />
          <div>
            <p className="font-semibold">Membership / promo tables missing.</p>
            <p>Apply <code>memberships_and_promo_codes.sql</code> in Supabase to enable membership tiers and promo codes.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-effect p-4 sm:p-6 rounded-xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-xl font-semibold text-white">Payment / Payout Methods</h2>
              <p className="text-sm text-gray-400">These are shown to users when they request add funds or withdraw.</p>
            </div>
            <Button variant="ghost" size="icon" onClick={loadData} className="text-yellow-400 hover:text-yellow-300 hover:bg-white/10">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>

          <form onSubmit={handleCreateMethod} className="space-y-3 bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-gray-200">Method type</Label>
                <Select value={methodForm.method_type} onValueChange={(v) => setMethodForm((prev) => ({ ...prev, method_type: v }))}>
                  <SelectTrigger className="bg-black/30 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-neutral-700 text-white">
                    <SelectItem value="add_funds">Add Funds</SelectItem>
                    <SelectItem value="withdraw">Withdraw</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-gray-200">Name</Label>
                <Input
                  value={methodForm.name}
                  onChange={(e) => setMethodForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Stripe Card, PayPal, Bank ACH"
                  className="bg-black/30 border-white/10 text-white placeholder-gray-500"
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-gray-200">Provider / Channel</Label>
              <Input
                value={methodForm.provider}
                onChange={(e) => setMethodForm((prev) => ({ ...prev, provider: e.target.value }))}
                placeholder="Optional: Stripe, PayPal, Wise..."
                className="bg-black/30 border-white/10 text-white placeholder-gray-500"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-gray-200">Instructions / Info</Label>
              <Textarea
                value={methodForm.instructions}
                onChange={(e) => setMethodForm((prev) => ({ ...prev, instructions: e.target.value }))}
                placeholder="What the user should expect (KYC, processing times, fees)."
                className="bg-black/30 border-white/10 text-white placeholder-gray-500 min-h-[80px]"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={methodForm.is_active} onCheckedChange={(v) => setMethodForm((prev) => ({ ...prev, is_active: v }))} />
                <span className="text-sm text-gray-300">Active</span>
              </div>
              <Button type="submit" className="golden-gradient text-black font-semibold">
                Save Method
              </Button>
            </div>
          </form>

          <div className="space-y-2">
            {methods.length === 0 && !loading && (
              <p className="text-sm text-gray-400">No methods yet.</p>
            )}
            {methods.map((m) => (
              <div key={m.id} className="p-3 rounded-lg border border-white/10 bg-white/5 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-yellow-500/20 text-yellow-200">{m.method_type === 'add_funds' ? 'Add Funds' : 'Withdraw'}</Badge>
                    <span className="font-semibold text-white">{m.name}</span>
                    {m.provider && <span className="text-xs text-gray-400">({m.provider})</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={!!m.is_active} onCheckedChange={(v) => handleToggleMethod(m.id, v)} />
                    <span className="text-xs text-gray-400">{m.is_active ? 'Active' : 'Disabled'}</span>
                  </div>
                </div>
                {m.instructions && <p className="text-sm text-gray-300">{m.instructions}</p>}
                <p className="text-[11px] text-gray-500">Updated {new Date(m.updated_at || m.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-effect p-4 sm:p-6 rounded-xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-xl font-semibold text-white">Redeem Codes</h2>
              <p className="text-sm text-gray-400">Create promo/gift codes; validation happens server-side.</p>
            </div>
          </div>

          <form onSubmit={handleCreateCode} className="space-y-3 bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-gray-200">Code</Label>
                <Input
                  value={codeForm.code}
                  onChange={(e) => setCodeForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="PROMO-2025"
                  className="bg-black/30 border-white/10 text-white placeholder-gray-500 uppercase"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-gray-200">Amount (CC)</Label>
                <Input
                  type="number"
                  step="any"
                  value={codeForm.amount}
                  onChange={(e) => setCodeForm((prev) => ({ ...prev, amount: e.target.value }))}
                  placeholder="e.g., 250"
                  className="bg-black/30 border-white/10 text-white placeholder-gray-500"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-gray-200">Expires at (optional)</Label>
                <Input
                  type="datetime-local"
                  value={codeForm.expires_at}
                  onChange={(e) => setCodeForm((prev) => ({ ...prev, expires_at: e.target.value }))}
                  className="bg-black/30 border-white/10 text-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-gray-200">Max uses</Label>
                <Input
                  type="number"
                  min="1"
                  value={codeForm.max_uses}
                  onChange={(e) => setCodeForm((prev) => ({ ...prev, max_uses: e.target.value }))}
                  className="bg-black/30 border-white/10 text-white"
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-gray-200">Notes (metadata)</Label>
              <Textarea
                value={codeForm.notes}
                onChange={(e) => setCodeForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Campaign, eligibility, or internal reason."
                className="bg-black/30 border-white/10 text-white placeholder-gray-500 min-h-[80px]"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" className="golden-gradient text-black font-semibold">Create Code</Button>
            </div>
          </form>

          <div className="space-y-2">
            {codes.length === 0 && !loading && <p className="text-sm text-gray-400">No codes yet.</p>}
            {codes.map((c) => (
              <div key={c.code} className="p-3 rounded-lg border border-white/10 bg-white/5 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-yellow-500/20 text-yellow-200">{c.code}</Badge>
                  <span className="text-white font-semibold">{c.amount} CC</span>
                  <span className="text-xs text-gray-400">Uses: {c.usage_count}/{c.max_uses}</span>
                  <Badge variant={c.is_active ? 'default' : 'secondary'} className={c.is_active ? 'bg-green-500/20 text-green-200' : 'bg-gray-600 text-gray-200'}>
                    {c.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                {c.expires_at && <p className="text-xs text-gray-400">Expires {new Date(c.expires_at).toLocaleString()}</p>}
                {c.metadata && Object.keys(c.metadata).length > 0 && (
                  <p className="text-xs text-gray-400">Notes: {c.metadata.notes || JSON.stringify(c.metadata)}</p>
                )}
                <p className="text-[11px] text-gray-500">Created {new Date(c.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Check className="w-4 h-4 text-green-400" />
            <span>Codes stay server-side; clients only submit redeem requests.</span>
          </div>
        </div>
      </div>

      <div className="glass-effect p-4 sm:p-6 rounded-xl border border-white/10 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-semibold text-white">Membership Promo Codes</h2>
            <p className="text-sm text-gray-400">Discount codes apply at checkout; grant codes are redeemed in Wallet.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={loadData} className="text-yellow-400 hover:text-yellow-300 hover:bg-white/10">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>

        <form onSubmit={handleCreatePromoCode} className="space-y-3 bg-white/5 rounded-lg p-3 border border-white/10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-gray-200">Code</Label>
              <Input
                value={promoForm.code}
                onChange={(e) => setPromoForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                placeholder="FIRSTYEAR10"
                className="bg-black/30 border-white/10 text-white placeholder-gray-500 uppercase"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-gray-200">Type</Label>
              <Select value={promoForm.code_type} onValueChange={(v) => setPromoForm((prev) => ({ ...prev, code_type: v }))}>
                <SelectTrigger className="bg-black/30 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-neutral-900 border-neutral-700 text-white">
                  <SelectItem value="membership_discount_percent">Discount (%)</SelectItem>
                  <SelectItem value="membership_grant">Grant membership</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-gray-200">Creator (required for grant)</Label>
              <Select
                value={promoForm.creator_id || '__any__'}
                onValueChange={(v) => setPromoForm((prev) => ({ ...prev, creator_id: v === '__any__' ? '' : v, tier_id: '' }))}
              >
                <SelectTrigger className="bg-black/30 border-white/10 text-white">
                  <SelectValue placeholder="Optional for discount" />
                </SelectTrigger>
                <SelectContent className="bg-neutral-900 border-neutral-700 text-white max-h-64 overflow-y-auto">
                  <SelectItem value="__any__">(Any creator)</SelectItem>
                  {creators.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.username || c.full_name || c.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-gray-200">Tier (optional)</Label>
              <Select
                value={promoForm.tier_id || '__any__'}
                onValueChange={(v) => setPromoForm((prev) => ({ ...prev, tier_id: v === '__any__' ? '' : v }))}
                disabled={!promoForm.creator_id}
              >
                <SelectTrigger className="bg-black/30 border-white/10 text-white">
                  <SelectValue placeholder={promoForm.creator_id ? 'Any tier' : 'Select a creator first'} />
                </SelectTrigger>
                <SelectContent className="bg-neutral-900 border-neutral-700 text-white max-h-64 overflow-y-auto">
                  <SelectItem value="__any__">(Any tier)</SelectItem>
                  {tiersForSelectedCreator.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} — {t.price_cc} CC / {t.duration_days}d
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {promoForm.code_type === 'membership_grant' ? (
              <div className="space-y-1">
                <Label className="text-gray-200">Grant duration (days)</Label>
                <Input
                  type="number"
                  min="1"
                  value={promoForm.grant_duration_days}
                  onChange={(e) => setPromoForm((prev) => ({ ...prev, grant_duration_days: e.target.value }))}
                  className="bg-black/30 border-white/10 text-white"
                  required
                />
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-gray-200">Discount percent</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  step="any"
                  value={promoForm.discount_percent}
                  onChange={(e) => setPromoForm((prev) => ({ ...prev, discount_percent: e.target.value }))}
                  className="bg-black/30 border-white/10 text-white"
                  required
                />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-gray-200">Expires at (optional)</Label>
              <Input
                type="datetime-local"
                value={promoForm.expires_at}
                onChange={(e) => setPromoForm((prev) => ({ ...prev, expires_at: e.target.value }))}
                className="bg-black/30 border-white/10 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-gray-200">Max uses</Label>
              <Input
                type="number"
                min="1"
                value={promoForm.max_uses}
                onChange={(e) => setPromoForm((prev) => ({ ...prev, max_uses: e.target.value }))}
                className="bg-black/30 border-white/10 text-white"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-gray-200">Max uses per user</Label>
              <Input
                type="number"
                min="1"
                value={promoForm.max_uses_per_user}
                onChange={(e) => setPromoForm((prev) => ({ ...prev, max_uses_per_user: e.target.value }))}
                className="bg-black/30 border-white/10 text-white"
                required
              />
            </div>
            <div className="flex items-end gap-2">
              <Switch checked={!!promoForm.first_time_only} onCheckedChange={(v) => setPromoForm((prev) => ({ ...prev, first_time_only: v }))} />
              <span className="text-sm text-gray-300">First purchase only</span>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-gray-200">Notes (metadata)</Label>
            <Textarea
              value={promoForm.notes}
              onChange={(e) => setPromoForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Campaign, eligibility, or internal reason."
              className="bg-black/30 border-white/10 text-white placeholder-gray-500 min-h-[80px]"
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" className="golden-gradient text-black font-semibold">Create Promo Code</Button>
          </div>
        </form>

        <div className="space-y-2">
          {promoCodes.length === 0 && !loading && <p className="text-sm text-gray-400">No promo codes yet.</p>}
          {promoCodes.map((c) => (
            <div key={c.code} className="p-3 rounded-lg border border-white/10 bg-white/5 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-yellow-500/20 text-yellow-200">{c.code}</Badge>
                  <Badge className="bg-white/10 text-white">{c.code_type}</Badge>
                  <span className="text-xs text-gray-400">Uses: {c.usage_count}/{c.max_uses}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={!!c.is_active} onCheckedChange={(v) => handleTogglePromoCode(c.code, v)} />
                  <span className="text-xs text-gray-400">{c.is_active ? 'Active' : 'Disabled'}</span>
                </div>
              </div>
              {c.code_type === 'membership_discount_percent' && (
                <div className="text-sm text-gray-200">
                  Discount: <span className="text-white font-semibold">{c.discount_percent}%</span>
                  {c.first_time_only ? <span className="text-xs text-gray-400"> (first purchase only)</span> : null}
                </div>
              )}
              {c.code_type === 'membership_grant' && (
                <div className="text-sm text-gray-200">
                  Grants: <span className="text-white font-semibold">{c.grant_duration_days} days</span>
                </div>
              )}
              {c.creator_id && <div className="text-xs text-gray-400">Creator: {c.creator_id}</div>}
              {c.tier_id && <div className="text-xs text-gray-400">Tier: {c.tier_id}</div>}
              {c.expires_at && <p className="text-xs text-gray-400">Expires {new Date(c.expires_at).toLocaleString()}</p>}
              {c.metadata && Object.keys(c.metadata).length > 0 && (
                <p className="text-xs text-gray-400">Notes: {c.metadata.notes || JSON.stringify(c.metadata)}</p>
              )}
              <p className="text-[11px] text-gray-500">Created {new Date(c.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WalletAdminTab;
