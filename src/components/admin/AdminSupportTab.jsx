import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { Loader2, MessageSquare, Filter, User, CheckCircle, AlertTriangle, Clock, Shield, Send } from 'lucide-react';

const statusOptions = ['open', 'waiting_user', 'in_progress', 'resolved', 'closed'];
const priorityOptions = ['low', 'normal', 'high', 'urgent'];

const Pill = ({ label, colorClass }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${colorClass}`}>{label}</span>
);

const statusColor = (s) => ({
  open: 'bg-green-500/15 text-green-200 border-green-500/30',
  waiting_user: 'bg-yellow-500/15 text-yellow-200 border-yellow-500/30',
  in_progress: 'bg-blue-500/15 text-blue-200 border-blue-500/30',
  resolved: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30',
  closed: 'bg-gray-500/15 text-gray-200 border-gray-500/30',
}[s] || 'bg-gray-500/15 text-gray-200 border-gray-500/30');

const priorityColor = (p) => ({
  low: 'bg-gray-500/15 text-gray-200 border-gray-500/30',
  normal: 'bg-blue-500/15 text-blue-200 border-blue-500/30',
  high: 'bg-orange-500/15 text-orange-200 border-orange-500/30',
  urgent: 'bg-red-500/15 text-red-200 border-red-500/30',
}[p] || 'bg-gray-500/15 text-gray-200 border-gray-500/30');

const AdminSupportTab = () => {
  const { profile } = useAuth();
  const [cases, setCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [filters, setFilters] = useState({ status: 'open', search: '' });
  const [missingTables, setMissingTables] = useState(false);

  const loadCases = useCallback(async () => {
    if (!profile?.is_admin) return;
    setLoadingCases(true);
    setMissingTables(false);
    try {
      let query = supabase
        .from('support_cases')
        .select('id, subject, status, priority, channel, user_id, created_at, updated_at, assigned_admin_id, user:profiles(id, username, full_name)')
        .order('updated_at', { ascending: false });

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters.search) {
        const term = filters.search;
        query = query.or(`subject.ilike.%${term}%,description.ilike.%${term}%`);
      }

      const { data, error, status } = await query;
      if (error) {
        if (status === 406 || error.code === 'PGRST116') {
          setMissingTables(true);
        } else {
          toast({ title: 'Error loading cases', description: error.message, variant: 'destructive' });
        }
        setCases([]);
      } else {
        setCases(data || []);
      }
    } finally {
      setLoadingCases(false);
    }
  }, [filters, profile]);

  const loadMessages = useCallback(async (caseId) => {
    if (!profile?.is_admin || !caseId) return;
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('support_case_messages')
        .select('id, sender_role, message, created_at')
        .eq('case_id', caseId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      toast({ title: 'Error loading messages', description: error.message, variant: 'destructive' });
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, [profile]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  useEffect(() => {
    if (selectedCase) loadMessages(selectedCase.id);
    else setMessages([]);
  }, [selectedCase, loadMessages]);

  const handleSelectCase = (c) => {
    setSelectedCase(c);
  };

  const handleUpdateStatus = async (status) => {
    if (!selectedCase) return;
    try {
      const { error } = await supabase
        .from('support_cases')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', selectedCase.id);
      if (error) throw error;
      toast({ title: 'Status updated', variant: 'success' });
      await loadCases();
      setSelectedCase((prev) => prev ? { ...prev, status } : prev);
    } catch (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    }
  };

  const handleAssign = async () => {
    if (!selectedCase || !profile?.id) return;
    try {
      const { error } = await supabase
        .from('support_cases')
        .update({ assigned_admin_id: profile.id, updated_at: new Date().toISOString(), status: selectedCase.status === 'open' ? 'in_progress' : selectedCase.status })
        .eq('id', selectedCase.id);
      if (error) throw error;
      toast({ title: 'Assigned to you', variant: 'success' });
      await loadCases();
      setSelectedCase((prev) => prev ? { ...prev, assigned_admin_id: profile.id, status: prev.status === 'open' ? 'in_progress' : prev.status } : prev);
    } catch (error) {
      toast({ title: 'Assign failed', description: error.message, variant: 'destructive' });
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!selectedCase || !reply.trim()) {
      toast({ title: 'Message required', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.rpc('post_support_message', {
        p_case_id: selectedCase.id,
        p_sender_role: 'admin',
        p_message: reply.trim(),
      });
      if (error) throw error;
      setReply('');
      await loadMessages(selectedCase.id);
      await loadCases();
    } catch (error) {
      toast({ title: 'Send failed', description: error.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const casesFiltered = useMemo(() => cases, [cases]);

  if (!profile?.is_admin) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center text-center p-6 glass-effect rounded-xl text-white">
        <Shield className="w-12 h-12 text-yellow-400 mb-3" />
        <p>Admin access required.</p>
      </div>
    );
  }

  if (missingTables) {
    return (
      <div className="glass-effect p-4 sm:p-6 rounded-xl border border-yellow-500/30 text-yellow-100">
        <p className="font-semibold">Support tables not available.</p>
        <p className="text-sm text-yellow-200">Apply support_cases.sql in Supabase to enable admin support.</p>
      </div>
    );
  }

  return (
    <div className="glass-effect p-4 sm:p-6 rounded-2xl border border-white/10 text-white space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-yellow-400" />
          <h2 className="text-2xl font-bold">Support Cases</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search subject/description"
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            className="bg-black/20 border-white/10 text-white"
          />
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <Filter className="w-4 h-4 text-yellow-300" />
            <select
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
              className="bg-black/30 border border-white/10 rounded-md px-2 py-1 text-white text-sm"
            >
              <option value="all">All</option>
              {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Cases</h3>
            {loadingCases && <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />}
          </div>
          {casesFiltered.length === 0 && !loadingCases ? (
            <p className="text-sm text-gray-400">No cases found.</p>
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
              {casesFiltered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleSelectCase(c)}
                  className={`w-full text-left p-3 rounded-xl border transition ${selectedCase?.id === c.id ? 'border-yellow-400/60 bg-yellow-400/10' : 'border-white/10 bg-black/20 hover:border-yellow-300/40'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold truncate">{c.subject}</div>
                    <Pill label={c.priority} colorClass={priorityColor(c.priority)} />
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Pill label={c.status} colorClass={statusColor(c.status)} />
                    {c.assigned_admin_id && <Badge className="bg-blue-500/20 text-blue-200 border-blue-500/40 text-xs">Assigned</Badge>}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    User: {c.user?.username || c.user?.full_name || c.user_id}
                  </div>
                  <div className="text-[11px] text-gray-500">Updated {new Date(c.updated_at).toLocaleString()}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Thread</h3>
            {loadingMessages && <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />}
          </div>
          {!selectedCase ? (
            <p className="text-sm text-gray-400">Select a case to view and respond.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-300">
                <User className="w-4 h-4 text-yellow-300" />
                <span>{selectedCase.user?.username || selectedCase.user?.full_name || selectedCase.user_id}</span>
                <Pill label={selectedCase.status} colorClass={statusColor(selectedCase.status)} />
                <Pill label={selectedCase.priority} colorClass={priorityColor(selectedCase.priority)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => handleAssign()}>
                  <CheckCircle className="w-4 h-4 mr-2" /> Assign to me
                </Button>
                <select
                  value={selectedCase.status}
                  onChange={(e) => handleUpdateStatus(e.target.value)}
                  className="bg-black/30 border border-white/10 rounded-md px-2 py-1 text-white text-sm"
                >
                  {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="space-y-2 max-h-[240px] overflow-y-auto custom-scrollbar pr-1">
                {messages.length === 0 && <p className="text-sm text-gray-400">No messages yet.</p>}
                {messages.map((m) => (
                  <div key={m.id} className={`p-2 rounded-lg border ${m.sender_role === 'admin' ? 'border-yellow-400/40 bg-yellow-400/5' : 'border-white/10 bg-white/5'}`}>
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                      <span className="uppercase">{m.sender_role}</span>
                      <span>{new Date(m.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-white whitespace-pre-wrap">{m.message}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSend} className="space-y-2">
                <Textarea
                  placeholder="Reply to user..."
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  className="bg-black/30 border-white/10 text-white min-h-[80px]"
                />
                <div className="flex flex-wrap gap-2 items-center">
                  <Button type="submit" disabled={sending} className="golden-gradient text-black font-semibold">
                    {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                    Send
                  </Button>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Messages are logged for audit.
                  </span>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminSupportTab;
