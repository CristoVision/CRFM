import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Settings2, Coins, AlertTriangle, Layers, CheckCircle2 } from 'lucide-react';

const STORAGE_PREFIX = 'crfm:creator_upload_policy:';
const CONTENT_POLICY_PREFIX = 'crfm:creator_content_policy:';

const POLICIES = [
  {
    value: 'free',
    title: 'Free Tier (default)',
    subtitle: 'Change anytime.',
    royalty_fee_note: 'CRFM takes 10% of royalties before withdrawal (Free Tier only).',
    bullets: [
      'No upload fee.',
      'Royalties accrue normally (minus platform fee).',
    ],
  },
  {
    value: 'pay_per_upload',
    title: 'Pay Per Upload',
    subtitle: 'Single tracks / one-time fee per upload.',
    bullets: [
      'One-time fee per single/track upload (price TBD).',
      'Royalties: 100% to creator permanently (unless content removed).',
    ],
  },
  {
    value: 'subscription',
    title: 'Unlimited Uploads (Membership)',
    subtitle: 'Monthly / 6-month / yearly (with discounts).',
    bullets: [
      'Unlimited uploads while membership is active.',
      'Royalties: 100% to creator until membership expires (then paused).',
      'Content remains listed, but royalties earned while expired are forfeited.',
    ],
  },
];

const getPolicyLabel = (value) => POLICIES.find((p) => p.value === value)?.title || value;

const safeJsonParse = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const CreatorUploadPreferences = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMode, setSaveMode] = useState(null); // 'server' | 'local' | null
  const [counts, setCounts] = useState({ tracks: 0, albums: 0, videos: 0 });
  const [selectedPolicy, setSelectedPolicy] = useState('free');

  const [manageOpen, setManageOpen] = useState(false);
  const [manageLoading, setManageLoading] = useState(false);
  const [contentTab, setContentTab] = useState('tracks'); // tracks | albums | videos
  const [contentSearch, setContentSearch] = useState('');
  const [contentRows, setContentRows] = useState([]);
  const [selectedIds, setSelectedIds] = useState({});
  const [assignPolicy, setAssignPolicy] = useState('free');
  const [dbSupportsContentPolicy, setDbSupportsContentPolicy] = useState(true);

  const isCreator = useMemo(() => !!profile?.is_verified_creator, [profile?.is_verified_creator]);

  const storageKey = useMemo(() => (user?.id ? `${STORAGE_PREFIX}${user.id}` : null), [user?.id]);
  const contentPolicyKey = useMemo(() => (user?.id ? `${CONTENT_POLICY_PREFIX}${user.id}` : null), [user?.id]);

  const contentPolicyMap = useMemo(() => {
    if (!contentPolicyKey) return { tracks: {}, albums: {}, videos: {} };
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(contentPolicyKey) : null;
    const parsed = raw ? safeJsonParse(raw, null) : null;
    return parsed && typeof parsed === 'object'
      ? {
          tracks: parsed.tracks && typeof parsed.tracks === 'object' ? parsed.tracks : {},
          albums: parsed.albums && typeof parsed.albums === 'object' ? parsed.albums : {},
          videos: parsed.videos && typeof parsed.videos === 'object' ? parsed.videos : {},
        }
      : { tracks: {}, albums: {}, videos: {} };
  }, [contentPolicyKey]);

  const loadCounts = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [tracksCount, albumsCount, videosCount] = await Promise.all([
        supabase.from('tracks').select('id', { count: 'exact', head: true }).eq('uploader_id', user.id),
        supabase.from('albums').select('id', { count: 'exact', head: true }).eq('uploader_id', user.id),
        supabase
          .from('videos')
          .select('id', { count: 'exact', head: true })
          .eq('uploader_id', user.id)
          .eq('video_type', 'music_video'),
      ]);

      setCounts({
        tracks: tracksCount.count || 0,
        albums: albumsCount.count || 0,
        videos: videosCount.count || 0,
      });
    } catch (error) {
      setCounts({ tracks: 0, albums: 0, videos: 0 });
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const fromStorage = storageKey ? window.localStorage.getItem(storageKey) : null;
    const fromProfile = profile?.creator_upload_policy;
    const initial = fromStorage || fromProfile || 'free';
    setSelectedPolicy(initial);
    setSaveMode(fromProfile ? 'server' : fromStorage ? 'local' : null);

    setLoading(false);
    loadCounts();
  }, [user?.id, storageKey, profile?.creator_upload_policy, loadCounts]);

  const save = async () => {
    if (!user?.id || !storageKey) return;
    setSaving(true);
    try {
      window.localStorage.setItem(storageKey, selectedPolicy);

      const { error } = await supabase
        .from('profiles')
        .update({ creator_upload_policy: selectedPolicy, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) {
        setSaveMode('local');
        toast({
          title: 'Saved locally',
          description: 'Backend column missing or not writable yet; your selection is stored in this browser.',
          variant: 'destructive',
        });
      } else {
        setSaveMode('server');
        toast({
          title: 'Upload preferences saved',
          description: 'Your upload policy has been updated.',
          className: 'bg-green-600 text-white',
        });
      }
    } catch (error) {
      toast({
        title: 'Could not save preferences',
        description: error.message || 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const getRowPolicy = (type, row) => {
    const fromDb = row?.upload_policy;
    if (fromDb) return fromDb;
    const fromLocal = contentPolicyMap?.[type]?.[row?.id];
    if (fromLocal) return fromLocal;
    return null;
  };

  const fetchContent = useCallback(
    async (type) => {
      if (!user?.id) return;
      setManageLoading(true);
      try {
        const baseSelect = 'id, title, created_at';
        const selectWithPolicy = `${baseSelect}, upload_policy`;

        const runQuery = async (selectString) => {
          if (type === 'tracks') {
            return supabase.from('tracks').select(selectString).eq('uploader_id', user.id).order('created_at', { ascending: false }).limit(250);
          }
          if (type === 'albums') {
            return supabase.from('albums').select(selectString).eq('uploader_id', user.id).order('created_at', { ascending: false }).limit(250);
          }
          return supabase
            .from('videos')
            .select(selectString)
            .eq('uploader_id', user.id)
            .eq('video_type', 'music_video')
            .order('created_at', { ascending: false })
            .limit(250);
        };

        let result = await runQuery(selectWithPolicy);
        if (result.error) {
          setDbSupportsContentPolicy(false);
          result = await runQuery(baseSelect);
        } else {
          setDbSupportsContentPolicy(true);
        }

        if (result.error && result.error.code !== 'PGRST116') throw result.error;
        setContentRows(result.data || []);
        setSelectedIds({});
      } catch (error) {
        toast({
          title: 'Could not load content',
          description: error.message || 'Try again.',
          variant: 'destructive',
        });
        setContentRows([]);
        setSelectedIds({});
      } finally {
        setManageLoading(false);
      }
    },
    [user?.id]
  );

  useEffect(() => {
    if (!manageOpen) return;
    fetchContent(contentTab);
  }, [manageOpen, contentTab, fetchContent]);

  const persistLocalContentPolicy = (type, ids, policyValue) => {
    if (!contentPolicyKey) return;
    const next = {
      tracks: { ...(contentPolicyMap.tracks || {}) },
      albums: { ...(contentPolicyMap.albums || {}) },
      videos: { ...(contentPolicyMap.videos || {}) },
    };
    ids.forEach((id) => {
      next[type][id] = policyValue;
    });
    window.localStorage.setItem(contentPolicyKey, JSON.stringify(next));
  };

  const applyPolicyToSelected = async () => {
    if (!user?.id || !assignPolicy) return;
    const ids = Object.entries(selectedIds)
      .filter(([, v]) => !!v)
      .map(([id]) => id);
    if (!ids.length) {
      toast({ title: 'Select content', description: 'Pick at least one item to update.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      persistLocalContentPolicy(contentTab, ids, assignPolicy);

      if (dbSupportsContentPolicy) {
        const table = contentTab === 'tracks' ? 'tracks' : contentTab === 'albums' ? 'albums' : 'videos';
        const query = supabase
          .from(table)
          .update({ upload_policy: assignPolicy, updated_at: new Date().toISOString() })
          .in('id', ids)
          .eq('uploader_id', user.id);
        if (contentTab === 'videos') query.eq('video_type', 'music_video');
        const { error } = await query;
        if (error) {
          toast({
            title: 'Saved locally',
            description: 'Backend column missing or not writable yet; assignments are stored in this browser.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Content updated',
            description: `Assigned ${ids.length} item(s) to ${getPolicyLabel(assignPolicy)}.`,
            className: 'bg-green-600 text-white',
          });
        }
      } else {
        toast({
          title: 'Saved locally',
          description: `Assigned ${ids.length} item(s) to ${getPolicyLabel(assignPolicy)} (browser-only for now).`,
          variant: 'destructive',
        });
      }

      fetchContent(contentTab);
    } catch (error) {
      toast({ title: 'Could not update content', description: error.message || 'Try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const assignUnassignedToActive = async () => {
    if (!user?.id) return;
    const unassignedIds = (contentRows || [])
      .filter((row) => !getRowPolicy(contentTab, row))
      .map((row) => row.id);
    if (!unassignedIds.length) {
      toast({ title: 'All set', description: 'No unassigned content found in this tab.', className: 'bg-green-600 text-white' });
      return;
    }

    setSelectedIds(unassignedIds.reduce((acc, id) => ({ ...acc, [id]: true }), {}));
    setAssignPolicy(selectedPolicy);
  };

  if (!user) {
    return (
      <div className="glass-effect p-6 rounded-xl border border-white/10 text-gray-300">
        Sign in to manage upload preferences.
      </div>
    );
  }

  if (!isCreator) {
    return (
      <div className="glass-effect p-6 rounded-xl border border-white/10 text-gray-300">
        Upload preference selection is available for verified creators only.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="glass-effect p-6 rounded-xl border border-white/10 text-gray-300 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
        <span>Loading upload preferences…</span>
      </div>
    );
  }

  const hasExistingContent = counts.tracks + counts.albums + counts.videos > 0;
  const activePolicy = POLICIES.find((p) => p.value === selectedPolicy) || POLICIES[0];

  return (
    <div className="glass-effect p-4 sm:p-6 rounded-xl border border-white/10 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-semibold text-white">Upload Policy</h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-white/10 text-gray-200">
            Active: <span className="text-white font-semibold ml-1">{getPolicyLabel(selectedPolicy)}</span>
          </Badge>
          {saveMode === 'server' ? <Badge className="bg-green-500/20 text-green-200">Saved</Badge> : null}
          {saveMode === 'local' ? <Badge className="bg-yellow-500/20 text-yellow-200">Browser-only</Badge> : null}
          <Button onClick={save} disabled={saving} className="golden-gradient text-black font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save
          </Button>
        </div>
      </div>

      <div className="text-sm text-gray-300 flex items-start gap-2">
        <Coins className="w-4 h-4 text-yellow-400 mt-0.5" />
        <div>
          <div className="text-white font-semibold">{activePolicy.title}</div>
          {activePolicy.royalty_fee_note ? (
            <div className="text-gray-300">{activePolicy.royalty_fee_note}</div>
          ) : (
            <div className="text-gray-300">No platform royalty fee applies under this policy.</div>
          )}
          <div className="text-xs text-gray-400">
            This policy does not remove your content; it controls upload eligibility and (for subscriptions) when royalties accrue.
          </div>
        </div>
      </div>

      {hasExistingContent ? (
        <div className="rounded-lg border border-yellow-400/20 bg-yellow-500/10 p-3 text-sm text-yellow-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-yellow-300" />
          <div>
            Existing uploads detected: {counts.tracks} tracks, {counts.albums} albums, {counts.videos} videos.
            <div className="text-xs text-yellow-100/80">
              If you switch policies, the Hub will surface any content that needs a per-item plan selection (single tracks, albums, videos).
            </div>
          </div>
        </div>
      ) : null}

      {hasExistingContent ? (
        <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="text-sm text-gray-300">
            <div className="text-white font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4 text-yellow-400" />
              Assign policies per upload
            </div>
            <div className="text-xs text-gray-400">
              Choose which content stays Free vs Pay Per Upload vs Subscription.
              {!dbSupportsContentPolicy ? ' (Browser-only until DB column is added.)' : ''}
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => setManageOpen(true)}
            className="bg-white/10 border-white/20 text-gray-200 hover:bg-white/20 hover:text-yellow-300"
          >
            Manage content
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {POLICIES.map((policy) => {
          const selected = selectedPolicy === policy.value;
          return (
            <button
              key={policy.value}
              type="button"
              onClick={() => setSelectedPolicy(policy.value)}
              className={[
                'text-left p-4 rounded-lg border bg-white/5 transition',
                selected ? 'border-yellow-400/60 ring-1 ring-yellow-400/30' : 'border-white/10 hover:border-white/20',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-white font-semibold">{policy.title}</div>
                  <div className="text-xs text-gray-400 mt-1">{policy.subtitle}</div>
                </div>
                {selected ? <Badge className="bg-yellow-500/20 text-yellow-200">Active</Badge> : null}
              </div>
              <ul className="mt-3 space-y-1 text-sm text-gray-300 list-disc pl-5">
                {policy.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="sm:max-w-4xl glass-effect text-white font-montserrat">
          <DialogHeader className="space-y-2">
            <DialogTitle className="golden-text text-2xl">Content Policy Assignments</DialogTitle>
            <DialogDescription className="text-gray-300">
              Assign a policy per upload. Unassigned items will follow your active default for new uploads.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Tabs value={contentTab} onValueChange={(v) => setContentTab(v)} className="w-full">
              <TabsList className="grid w-full grid-cols-3 gap-2 glass-effect p-1 rounded-lg">
                <TabsTrigger value="tracks" className="tab-button">Tracks</TabsTrigger>
                <TabsTrigger value="albums" className="tab-button">Albums</TabsTrigger>
                <TabsTrigger value="videos" className="tab-button">Videos</TabsTrigger>
              </TabsList>

              <div className="flex flex-col md:flex-row gap-3 md:items-end justify-between">
                <div className="flex-1">
                  <div className="text-xs text-gray-400 mb-1">Search</div>
                  <Input
                    value={contentSearch}
                    onChange={(e) => setContentSearch(e.target.value)}
                    placeholder="Filter by title…"
                    className="bg-black/20 border-white/10 text-white placeholder-gray-500"
                  />
                </div>
                <div className="w-full md:w-72">
                  <div className="text-xs text-gray-400 mb-1">Assign selected to</div>
                  <Select value={assignPolicy} onValueChange={setAssignPolicy}>
                    <SelectTrigger className="w-full bg-black/20 border-white/10 text-white">
                      <SelectValue placeholder="Choose policy" />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-900 border-neutral-700 text-white">
                      {POLICIES.map((p) => (
                        <SelectItem key={p.value} value={p.value} className="hover:bg-neutral-800 focus:bg-neutral-700">
                          {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-2 md:items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={assignUnassignedToActive}
                  className="bg-white/10 border-white/20 text-gray-200 hover:bg-white/20 hover:text-yellow-300"
                  disabled={manageLoading || saving || !contentRows.length}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Select unassigned
                </Button>
                <div className="text-xs text-gray-400">
                  Loaded {contentRows.length} item(s) (max 250). {dbSupportsContentPolicy ? '' : 'DB column missing; changes are browser-only.'}
                </div>
              </div>

              <TabsContent value="tracks" className="mt-3" />
              <TabsContent value="albums" className="mt-3" />
              <TabsContent value="videos" className="mt-3" />

              <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
                {manageLoading ? (
                  <div className="p-6 flex items-center gap-2 text-gray-300">
                    <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
                    <span>Loading content…</span>
                  </div>
                ) : (
                  <ScrollArea className="h-[340px]">
                    <div className="divide-y divide-white/10">
                      {(contentRows || [])
                        .filter((r) => (contentSearch ? (r.title || '').toLowerCase().includes(contentSearch.toLowerCase()) : true))
                        .map((row) => {
                          const rowPolicy = getRowPolicy(contentTab, row);
                          const isChecked = !!selectedIds[row.id];
                          return (
                            <div key={row.id} className="p-3 flex items-center gap-3">
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={(v) => setSelectedIds((prev) => ({ ...prev, [row.id]: !!v }))}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-white font-medium truncate">{row.title || '(Untitled)'}</div>
                                <div className="text-xs text-gray-400">{row.created_at ? new Date(row.created_at).toLocaleString() : ''}</div>
                              </div>
                              <Badge className="bg-white/10 text-gray-200">
                                {rowPolicy ? getPolicyLabel(rowPolicy) : 'Unassigned'}
                              </Badge>
                            </div>
                          );
                        })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </Tabs>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setManageOpen(false)}
              disabled={saving}
              className="flex-1 text-gray-300 border-gray-500 hover:border-yellow-400 hover:text-yellow-300"
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={applyPolicyToSelected}
              disabled={saving}
              className="flex-1 golden-gradient text-black font-semibold"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Apply to selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreatorUploadPreferences;
