import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Send, MessageSquare, FolderPlus, Shield } from 'lucide-react';

const priorities = ['low', 'normal', 'high', 'urgent'];

const StatusPill = ({ status }) => {
  const map = {
    open: 'bg-green-500/20 text-green-200 border-green-500/40',
    waiting_user: 'bg-yellow-500/20 text-yellow-200 border-yellow-500/40',
    in_progress: 'bg-blue-500/20 text-blue-200 border-blue-500/40',
    resolved: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
    closed: 'bg-gray-500/20 text-gray-200 border-gray-500/40',
  };
  return <Badge className={`border ${map[status] || 'bg-gray-500/20 text-gray-200 border-gray-500/40'}`}>{status?.replace('_', ' ')}</Badge>;
};

const SupportContactPanel = () => {
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ subject: '', description: '', priority: 'normal' });
  const [newMessage, setNewMessage] = useState('');
  const [missingSupportTables, setMissingSupportTables] = useState(false);

  const loadCases = useCallback(async () => {
    if (!user) return;
    setLoadingCases(true);
    setMissingSupportTables(false);
    try {
      const { data, error, status } = await supabase
        .from('support_cases')
        .select('id, subject, status, priority, created_at, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      if (error) {
        if (status === 406 || error.code === 'PGRST116') {
          setMissingSupportTables(true);
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
  }, [user]);

  const loadMessages = useCallback(async (caseId) => {
    if (!user || !caseId) return;
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('support_case_messages')
        .select('id, sender_user_id, sender_role, message, created_at')
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
  }, [user]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  useEffect(() => {
    if (selectedCase) {
      loadMessages(selectedCase.id);
    } else {
      setMessages([]);
    }
  }, [selectedCase, loadMessages]);

  const handleCreateCase = async (e) => {
    e.preventDefault();
    if (!user) {
      toast({ title: 'Login required', description: 'Sign in to contact support.', variant: 'destructive' });
      return;
    }
    if (!form.subject.trim()) {
      toast({ title: 'Subject required', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.rpc('create_support_case', {
        p_user_id: user.id,
        p_subject: form.subject.trim(),
        p_description: form.description || '',
        p_priority: form.priority,
        p_channel: 'about_contact',
      });
      if (error) throw error;
      toast({ title: 'Case created', description: 'We will get back to you soon.', variant: 'success' });
      setForm({ subject: '', description: '', priority: 'normal' });
      await loadCases();
    } catch (error) {
      toast({ title: 'Create case failed', description: error.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!selectedCase) return;
    if (!newMessage.trim()) {
      toast({ title: 'Message required', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.rpc('post_support_message', {
        p_case_id: selectedCase.id,
        p_sender_role: 'user',
        p_message: newMessage.trim(),
      });
      if (error) throw error;
      setNewMessage('');
      await loadMessages(selectedCase.id);
      await loadCases();
    } catch (error) {
      toast({ title: 'Send failed', description: error.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const selectedCaseId = useMemo(() => selectedCase?.id, [selectedCase]);

  if (!user) {
    return (
      <div className="glass-effect p-4 sm:p-6 rounded-xl border border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-semibold text-white">Sign in to contact support</h3>
        </div>
        <p className="text-sm text-gray-400">Create a support case or chat with an admin once you’re authenticated.</p>
      </div>
    );
  }

  if (missingSupportTables) {
    return (
      <div className="glass-effect p-4 sm:p-6 rounded-xl border border-yellow-500/30 text-yellow-100">
        <p className="font-semibold">Support backend not available.</p>
        <p className="text-sm text-yellow-200">Ask an admin to apply support_cases.sql in Supabase.</p>
      </div>
    );
  }

  return (
    <div className="glass-effect p-4 sm:p-6 rounded-xl border border-white/10 space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-yellow-400" />
          <h3 className="text-xl font-semibold text-white">Contact Support</h3>
        </div>
        <p className="text-sm text-gray-400">Open a case and chat securely with the team.</p>
      </div>

      <form onSubmit={handleCreateCase} className="space-y-3 bg-black/20 border border-white/10 rounded-lg p-3">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <FolderPlus className="w-4 h-4 text-yellow-300" />
          <span>New case</span>
        </div>
        <Input
          placeholder="Subject"
          value={form.subject}
          onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
          className="bg-black/30 border-white/10 text-white"
        />
        <Textarea
          placeholder="Describe your issue"
          value={form.description}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          className="bg-black/30 border-white/10 text-white min-h-[100px]"
        />
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-400">Priority:</span>
          {priorities.map((p) => (
            <Button
              key={p}
              size="sm"
              variant={form.priority === p ? 'default' : 'outline'}
              className={form.priority === p ? 'golden-gradient text-black' : 'text-yellow-300 border-yellow-400/40'}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, priority: p }))}
            >
              {p}
            </Button>
          ))}
        </div>
        <Button type="submit" disabled={creating} className="golden-gradient text-black font-semibold w-full sm:w-auto">
          {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FolderPlus className="w-4 h-4 mr-2" />}
          Create Case
        </Button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-white">Your Cases</h4>
            {loadingCases && <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />}
          </div>
          {(!cases || cases.length === 0) && !loadingCases ? (
            <p className="text-sm text-gray-400">No cases yet.</p>
          ) : (
            <div className="space-y-2 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
              {cases.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCase(c)}
                  className={`w-full text-left p-3 rounded-lg border ${selectedCaseId === c.id ? 'border-yellow-400/60 bg-yellow-400/10' : 'border-white/10 bg-black/20'} hover:border-yellow-300/50 transition`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-white font-semibold truncate">{c.subject}</div>
                    <StatusPill status={c.status} />
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Priority: {c.priority || 'normal'}</div>
                  <div className="text-[11px] text-gray-500">Updated {new Date(c.updated_at).toLocaleString()}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-white">Messages</h4>
            {loadingMessages && <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />}
          </div>
          {!selectedCase ? (
            <p className="text-sm text-gray-400">Select a case to view messages.</p>
          ) : (
            <>
              <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                {messages.length === 0 && <p className="text-sm text-gray-400">No messages yet.</p>}
                {messages.map((m) => (
                  <div key={m.id} className={`p-2 rounded-md border ${m.sender_role === 'admin' ? 'border-yellow-400/40 bg-yellow-400/5' : 'border-white/10 bg-white/5'}`}>
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                      <span className="uppercase">{m.sender_role}</span>
                      <span>{new Date(m.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-white whitespace-pre-wrap">{m.message}</p>
                  </div>
                ))}
              </div>
              <form onSubmit={handleSendMessage} className="space-y-2">
                <Textarea
                  placeholder="Type a message to support..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="bg-black/30 border-white/10 text-white min-h-[80px]"
                />
                <Button type="submit" disabled={sending} className="golden-gradient text-black font-semibold w-full sm:w-auto">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Send Message
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupportContactPanel;
