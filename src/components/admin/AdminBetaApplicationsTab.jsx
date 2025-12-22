import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';

const statuses = ['pending', 'approved', 'declined', 'contacted'];

const AdminBetaApplicationsTab = () => {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('beta_applications')
        .select('id, created_at, name, artist_name, email, links, genre, role_interest, notes, status')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setApplications(data || []);
    } catch (error) {
      toast({ title: t('admin.beta.errorTitle'), description: error.message, variant: 'destructive' });
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, []);

  const handleStatusChange = async (id, nextStatus) => {
    setSavingId(id);
    try {
      const { error } = await supabase
        .from('beta_applications')
        .update({ status: nextStatus, reviewed_at: new Date().toISOString(), reviewed_by: profile?.id || null })
        .eq('id', id);
      if (error) throw error;
      setApplications((prev) => prev.map((row) => (row.id === id ? { ...row, status: nextStatus } : row)));
      toast({ title: t('admin.beta.savedTitle'), description: t('admin.beta.savedBody'), variant: 'success' });
    } catch (error) {
      toast({ title: t('admin.beta.errorTitle'), description: error.message, variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  const rows = useMemo(() => applications, [applications]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <Loader2 className="w-10 h-10 animate-spin text-yellow-400" />
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="glass-effect p-6 rounded-xl border border-white/10 text-gray-300">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-semibold">{t('admin.beta.emptyTitle')}</h3>
        </div>
        <p className="text-sm text-gray-400">{t('admin.beta.emptyBody')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="glass-effect p-4 rounded-xl border border-white/10">
        <h3 className="text-xl font-semibold text-white mb-1">{t('admin.beta.title')}</h3>
        <p className="text-sm text-gray-400">{t('admin.beta.subtitle')}</p>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="glass-effect p-4 rounded-xl border border-white/10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <div className="text-white font-semibold">{row.name}</div>
                <div className="text-sm text-gray-400">{row.artist_name || t('admin.beta.noArtist')}</div>
                <div className="text-xs text-gray-500">{row.email}</div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Select value={row.status || 'pending'} onValueChange={(value) => handleStatusChange(row.id, value)}>
                  <SelectTrigger className="bg-black/30 border-white/10 text-white w-[160px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange(row.id, row.status || 'pending')}
                  disabled={savingId === row.id}
                  className="border-white/10 text-white"
                >
                  {savingId === row.id ? t('admin.beta.saving') : t('admin.beta.refresh')}
                </Button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-300">
              <div>
                <div className="text-xs text-gray-500">{t('admin.beta.labels.links')}</div>
                <div>{row.links || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">{t('admin.beta.labels.genre')}</div>
                <div>{row.genre || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">{t('admin.beta.labels.role')}</div>
                <div>{row.role_interest || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">{t('admin.beta.labels.notes')}</div>
                <div>{row.notes || '—'}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminBetaApplicationsTab;
