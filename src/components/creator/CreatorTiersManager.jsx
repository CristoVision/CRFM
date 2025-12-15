import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PlusCircle, Loader2, Pencil, Power, Crown } from 'lucide-react';

const DEFAULT_FORM = {
  id: null,
  name: '',
  description: '',
  price_cc: '',
  duration_days: '30',
  is_active: true,
};

const normalizePrice = (value) => {
  if (value === '') return '';
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return '';
  return String(parsed);
};

const CreatorTiersManager = () => {
  const { user, profile } = useAuth();
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);

  const isCreator = useMemo(() => !!profile?.is_verified_creator, [profile?.is_verified_creator]);

  const loadTiers = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('creator_membership_tiers')
        .select('id, name, description, price_cc, duration_days, is_active, created_at, updated_at')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false });
      if (error && error.code !== 'PGRST116') throw error;
      setTiers(data || []);
    } catch (error) {
      toast({
        title: 'Could not load tiers',
        description: error.message || 'Try again.',
        variant: 'destructive',
      });
      setTiers([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadTiers();
  }, [loadTiers]);

  const openCreate = () => {
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEdit = (tier) => {
    setForm({
      id: tier.id,
      name: tier.name || '',
      description: tier.description || '',
      price_cc: String(tier.price_cc ?? ''),
      duration_days: String(tier.duration_days ?? '30'),
      is_active: !!tier.is_active,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
    setForm(DEFAULT_FORM);
  };

  const validate = () => {
    if (!form.name.trim()) return 'Name is required.';
    const price = Number(form.price_cc);
    if (!Number.isFinite(price) || price < 0) return 'Price must be a number ≥ 0.';
    const days = Number(form.duration_days);
    if (!Number.isFinite(days) || days <= 0) return 'Duration must be a number > 0.';
    return null;
  };

  const saveTier = async () => {
    if (!user?.id) return;
    const errorMessage = validate();
    if (errorMessage) {
      toast({ title: 'Invalid tier', description: errorMessage, variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        creator_id: user.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        price_cc: Number(form.price_cc),
        duration_days: Number(form.duration_days),
        is_active: !!form.is_active,
        updated_at: new Date().toISOString(),
      };

      if (form.id) {
        const { error } = await supabase
          .from('creator_membership_tiers')
          .update(payload)
          .eq('id', form.id)
          .eq('creator_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('creator_membership_tiers').insert(payload);
        if (error) throw error;
      }

      toast({
        title: 'Tier saved',
        description: form.id ? 'Tier updated successfully.' : 'Tier created successfully.',
        className: 'bg-green-600 text-white',
      });
      closeDialog();
      loadTiers();
    } catch (error) {
      toast({
        title: 'Could not save tier',
        description: error.message || 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (tier) => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('creator_membership_tiers')
        .update({ is_active: !tier.is_active, updated_at: new Date().toISOString() })
        .eq('id', tier.id)
        .eq('creator_id', user.id);
      if (error) throw error;
      toast({
        title: tier.is_active ? 'Tier deactivated' : 'Tier activated',
        description: tier.is_active ? 'This tier is no longer purchasable.' : 'This tier is now purchasable.',
        className: 'bg-green-600 text-white',
      });
      loadTiers();
    } catch (error) {
      toast({
        title: 'Could not update tier',
        description: error.message || 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="glass-effect p-6 rounded-xl border border-white/10 text-gray-300">
        Sign in to manage membership tiers.
      </div>
    );
  }

  if (!isCreator) {
    return (
      <div className="glass-effect p-6 rounded-xl border border-white/10 text-gray-300">
        Membership tiers are available for verified creators only.
      </div>
    );
  }

  return (
    <>
      <div className="glass-effect p-4 sm:p-6 rounded-xl border border-white/10 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-white">Your Membership Tiers</h3>
          </div>
          <Button onClick={openCreate} className="golden-gradient text-black font-semibold">
            <PlusCircle className="w-4 h-4 mr-2" />
            New Tier
          </Button>
        </div>

        <div className="text-sm text-gray-300">
          Create, edit, and deactivate tiers. Only active tiers show on your public creator page.
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-300">
            <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
            <span>Loading tiers…</span>
          </div>
        ) : tiers.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tiers.map((tier) => (
              <div key={tier.id} className="p-4 rounded-lg border border-white/10 bg-white/5 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-white font-semibold truncate">{tier.name}</div>
                      {tier.is_active ? (
                        <Badge className="bg-green-500/20 text-green-200">Active</Badge>
                      ) : (
                        <Badge className="bg-gray-500/20 text-gray-200">Inactive</Badge>
                      )}
                    </div>
                    {tier.description ? <div className="text-sm text-gray-300 mt-1">{tier.description}</div> : null}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-yellow-300 font-semibold">{Number(tier.price_cc || 0).toLocaleString()} CC</div>
                    <div className="text-xs text-gray-400">{tier.duration_days} days</div>
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => openEdit(tier)}
                    className="flex-1 bg-white/10 border-white/20 text-gray-200 hover:bg-white/20 hover:text-yellow-300"
                    disabled={saving}
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => toggleActive(tier)}
                    className="flex-1 bg-white/10 border-white/20 text-gray-200 hover:bg-white/20 hover:text-yellow-300"
                    disabled={saving}
                  >
                    <Power className="w-4 h-4 mr-2" />
                    {tier.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-400">No tiers yet. Create your first tier to enable memberships.</div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(v) => (v ? null : closeDialog())}>
        <DialogContent className="sm:max-w-lg glass-effect text-white font-montserrat">
          <DialogHeader className="space-y-2">
            <DialogTitle className="golden-text text-2xl">{form.id ? 'Edit Tier' : 'Create Tier'}</DialogTitle>
            <DialogDescription className="text-gray-300">
              Price is in CrossCoins (CC). Duration is measured in days.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-300" htmlFor="tier_name">Name</Label>
              <Input
                id="tier_name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="bg-black/20 border-white/10 text-white placeholder-gray-500"
                placeholder="Gold Supporter"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300" htmlFor="tier_desc">Description (optional)</Label>
              <Textarea
                id="tier_desc"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                className="bg-black/20 border-white/10 text-white placeholder-gray-500"
                placeholder="Perks, shoutouts, early access…"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300" htmlFor="tier_price">Price (CC)</Label>
                <Input
                  id="tier_price"
                  inputMode="decimal"
                  value={form.price_cc}
                  onChange={(e) => setForm((prev) => ({ ...prev, price_cc: normalizePrice(e.target.value) }))}
                  className="bg-black/20 border-white/10 text-white placeholder-gray-500"
                  placeholder="500"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300" htmlFor="tier_days">Duration (days)</Label>
                <Input
                  id="tier_days"
                  inputMode="numeric"
                  value={form.duration_days}
                  onChange={(e) => setForm((prev) => ({ ...prev, duration_days: e.target.value.replace(/[^\d]/g, '') }))}
                  className="bg-black/20 border-white/10 text-white placeholder-gray-500"
                  placeholder="30"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="text-sm text-gray-300">
                <div className="text-white font-semibold">Active</div>
                <div className="text-xs text-gray-400">Only active tiers can be purchased.</div>
              </div>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                className="h-5 w-5 accent-yellow-400"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={closeDialog}
              disabled={saving}
              className="flex-1 text-gray-300 border-gray-500 hover:border-yellow-400 hover:text-yellow-300"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={saveTier}
              disabled={saving}
              className="flex-1 golden-gradient text-black font-semibold"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CreatorTiersManager;

