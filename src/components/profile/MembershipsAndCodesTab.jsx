import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Receipt, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const EVENT_TYPES = ['all', 'membership_purchased', 'membership_granted', 'wallet_code_redeemed'];

const formatAmount = (value) => {
  if (value === null || value === undefined) return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return `${num.toLocaleString()} CC`;
};

const MembershipsAndCodesTab = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [creatorOptions, setCreatorOptions] = useState([]);

  const initialFilters = useMemo(
    () => ({
      searchQuery: '',
      eventType: 'all',
      creatorId: 'all',
      startDate: null,
      endDate: null,
    }),
    []
  );

  const [filters, setFilters] = useState(initialFilters);
  const [activeFilters, setActiveFilters] = useState(initialFilters);

  const loadCreatorsForEvents = useCallback(async (rows) => {
    const creatorIds = Array.from(new Set((rows || []).map((r) => r.creator_id).filter(Boolean)));
    if (!creatorIds.length) {
      setCreatorOptions([]);
      return;
    }

    const { data, error } = await supabase.from('profiles').select('id, username, full_name').in('id', creatorIds);
    if (error && error.code !== 'PGRST116') return;
    const options = (data || [])
      .map((p) => ({ id: p.id, label: p.username || p.full_name || p.id }))
      .sort((a, b) => a.label.localeCompare(b.label));
    setCreatorOptions(options);
  }, []);

  const fetchEvents = useCallback(
    async (currentFilters = activeFilters) => {
      if (!user?.id) return;
      setLoading(true);
      try {
        let query = supabase
          .from('billing_events')
          .select('id, event_type, creator_id, tier_id, code, gross_amount_cc, discount_amount_cc, net_amount_cc, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(200);

        if (currentFilters.eventType && currentFilters.eventType !== 'all') {
          query = query.eq('event_type', currentFilters.eventType);
        }
        if (currentFilters.creatorId && currentFilters.creatorId !== 'all') {
          query = query.eq('creator_id', currentFilters.creatorId);
        }
        if (currentFilters.searchQuery) {
          query = query.ilike('code', `%${currentFilters.searchQuery}%`);
        }
        if (currentFilters.startDate) {
          query = query.gte('created_at', currentFilters.startDate.toISOString());
        }
        if (currentFilters.endDate) {
          const endDatePlusOne = new Date(currentFilters.endDate);
          endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
          query = query.lte('created_at', endDatePlusOne.toISOString());
        }

        const { data, error } = await query;
        if (error) throw error;
        setEvents(data || []);
        loadCreatorsForEvents(data || []);
      } catch (error) {
        toast({
          title: t('profile.memberships.toasts.loadFailedTitle'),
          description: error.message || t('profile.memberships.toasts.loadFailedBody'),
          variant: 'destructive',
        });
        setEvents([]);
        setCreatorOptions([]);
      } finally {
        setLoading(false);
      }
    },
    [activeFilters, user?.id, loadCreatorsForEvents, t]
  );

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    fetchEvents(initialFilters);
  }, [user?.id, fetchEvents, initialFilters]);

  const applyFilters = () => {
    setActiveFilters(filters);
    fetchEvents(filters);
  };

  const resetFilters = () => {
    setFilters(initialFilters);
    setActiveFilters(initialFilters);
    fetchEvents(initialFilters);
  };

  if (!user) {
    return (
        <div className="glass-effect-light p-6 rounded-xl border border-white/10 text-gray-300">
        {t('profile.memberships.signInPrompt')}
      </div>
    );
  }

  const hasActiveFilters =
    activeFilters.searchQuery ||
    (activeFilters.eventType && activeFilters.eventType !== 'all') ||
    (activeFilters.creatorId && activeFilters.creatorId !== 'all') ||
    activeFilters.startDate ||
    activeFilters.endDate;

  return (
    <div className="space-y-6">
      <div className="glass-effect-light p-6 rounded-xl border border-white/10">
        <div className="flex items-center gap-2 mb-4">
          <Receipt className="w-5 h-5 text-yellow-400" />
          <h2 className="text-2xl font-bold golden-text">{t('profile.memberships.title')}</h2>
        </div>

        <div className="p-4 md:p-6 mb-6 bg-black/30 rounded-xl border border-white/10 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <Input
              type="text"
              placeholder={t('profile.memberships.searchPlaceholder')}
              value={filters.searchQuery}
              onChange={(e) => setFilters((prev) => ({ ...prev, searchQuery: e.target.value.toUpperCase() }))}
              className="bg-white/5 border-white/10 placeholder-gray-400 text-white focus:border-yellow-400"
            />

            <Select value={filters.eventType} onValueChange={(v) => setFilters((prev) => ({ ...prev, eventType: v }))}>
              <SelectTrigger className="w-full bg-white/5 border-white/10 text-white focus:border-yellow-400">
                <SelectValue placeholder={t('profile.memberships.eventTypePlaceholder')} />
              </SelectTrigger>
              <SelectContent className="bg-neutral-900 border-neutral-700 text-white">
                {EVENT_TYPES.map((eventType) => (
                  <SelectItem key={eventType} value={eventType} className="hover:bg-neutral-800 focus:bg-neutral-700">
                    {t(`profile.memberships.events.${eventType}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.creatorId} onValueChange={(v) => setFilters((prev) => ({ ...prev, creatorId: v }))}>
              <SelectTrigger className="w-full bg-white/5 border-white/10 text-white focus:border-yellow-400">
                <SelectValue placeholder={t('profile.memberships.creatorPlaceholder')} />
              </SelectTrigger>
              <SelectContent className="bg-neutral-900 border-neutral-700 text-white">
                <SelectItem value="all" className="hover:bg-neutral-800 focus:bg-neutral-700">{t('profile.memberships.anyCreator')}</SelectItem>
                {creatorOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="hover:bg-neutral-800 focus:bg-neutral-700">
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DatePicker
              date={filters.startDate}
              setDate={(date) => setFilters((prev) => ({ ...prev, startDate: date }))}
              placeholder={t('profile.memberships.startDate')}
              className="bg-white/5 border-white/10 text-white focus:border-yellow-400"
            />
            <DatePicker
              date={filters.endDate}
              setDate={(date) => setFilters((prev) => ({ ...prev, endDate: date }))}
              placeholder={t('profile.memberships.endDate')}
              className="bg-white/5 border-white/10 text-white focus:border-yellow-400"
            />
          </div>

          <div className="flex flex-col sm:flex-row justify-end items-center gap-3 pt-2">
            {hasActiveFilters && (
              <Button
                variant="outline"
                onClick={resetFilters}
                className="w-full sm:w-auto text-yellow-400 border-yellow-400/50 hover:bg-yellow-400/10 hover:text-yellow-300"
              >
                <X className="w-4 h-4 mr-2" />
                {t('profile.memberships.reset')}
              </Button>
            )}
            <Button onClick={applyFilters} className="w-full sm:w-auto golden-gradient text-black font-semibold">
              {t('profile.memberships.apply')}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-300">
            <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
            <span>{t('profile.memberships.loading')}</span>
          </div>
        ) : events.length ? (
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead className="text-gray-300">{t('profile.memberships.table.date')}</TableHead>
                  <TableHead className="text-gray-300">{t('profile.memberships.table.event')}</TableHead>
                  <TableHead className="text-gray-300">{t('profile.memberships.table.creator')}</TableHead>
                  <TableHead className="text-gray-300">{t('profile.memberships.table.code')}</TableHead>
                  <TableHead className="text-gray-300 text-right">{t('profile.memberships.table.gross')}</TableHead>
                  <TableHead className="text-gray-300 text-right">{t('profile.memberships.table.discount')}</TableHead>
                  <TableHead className="text-gray-300 text-right">{t('profile.memberships.table.net')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((e) => (
                  <TableRow key={e.id} className="border-white/10">
                    <TableCell className="text-gray-200 whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString(language === 'es' ? 'es-ES' : 'en-US')}
                    </TableCell>
                    <TableCell className="text-gray-200">{t(`profile.memberships.events.${e.event_type}`)}</TableCell>
                    <TableCell className="text-gray-300">
                      {e.creator_id
                        ? creatorOptions.find((c) => c.id === e.creator_id)?.label || e.creator_id
                        : '—'}
                    </TableCell>
                    <TableCell className="text-gray-300">{e.code || '—'}</TableCell>
                    <TableCell className="text-gray-200 text-right">{formatAmount(e.gross_amount_cc)}</TableCell>
                    <TableCell className="text-gray-200 text-right">{formatAmount(e.discount_amount_cc)}</TableCell>
                    <TableCell className="text-gray-200 text-right">{formatAmount(e.net_amount_cc)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-sm text-gray-400">{t('profile.memberships.noHistory')}</div>
        )}

        <div className="text-xs text-gray-500 mt-4">
          {t('profile.memberships.footer')}
        </div>
      </div>
    </div>
  );
};

export default MembershipsAndCodesTab;
