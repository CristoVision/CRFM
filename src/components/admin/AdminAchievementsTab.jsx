import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

export default function AdminAchievementsTab() {
  const SAMPLE_REWARDS = '[{"type":"currency","code":"CC","amount":100,"project":"CRFM"}]';
  const SAMPLE_RULES = '{"project":"CRFM","event":"streams","threshold":1000}';

  const [projects, setProjects] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [form, setForm] = useState({
    project_id: null,
    season_id: null,
    name: '',
    description: '',
    rarity: 'common',
    icon_url: '',
    active_from: '',
    active_to: '',
    rewards: '[]',
    unlock_rules: '{}',
  });
  const [loading, setLoading] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingSeasons, setLoadingSeasons] = useState(false);
  const [projectLoadError, setProjectLoadError] = useState(null);

  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true);
    setProjectLoadError(null);
    try {
      const { data, error } = await supabase.from('projects').select('id, code, name').order('code');
      if (error) {
        setProjectLoadError(error.message);
      } else {
        setProjects(data || []);
        if (!form.project_id && data?.[0]?.id) {
          setForm((f) => ({ ...f, project_id: data[0].id }));
        }
      }
    } catch (err) {
      setProjectLoadError(err.message);
    } finally {
      setLoadingProjects(false);
    }
  }, [form.project_id]);

  const fetchSeasons = useCallback(async (projectId) => {
    if (!projectId) {
      setSeasons([]);
      return;
    }
    setLoadingSeasons(true);
    const { data, error } = await supabase
      .from('project_seasons')
      .select('id, code, name')
      .eq('project_id', projectId)
      .order('starts_at', { ascending: false });
    if (error) {
      toast({ title: 'Error loading seasons', description: error.message, variant: 'destructive' });
    } else {
      setSeasons(data || []);
    }
    setLoadingSeasons(false);
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (form.project_id) fetchSeasons(form.project_id);
  }, [form.project_id, fetchSeasons]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    let rewardsJson = [];
    let rulesJson = {};
    try {
      rewardsJson = JSON.parse(form.rewards || '[]');
    } catch (err) {
      toast({ title: 'Invalid rewards JSON', description: err.message, variant: 'destructive' });
      setLoading(false);
      return;
    }
    try {
      rulesJson = JSON.parse(form.unlock_rules || '{}');
    } catch (err) {
      toast({ title: 'Invalid unlock_rules JSON', description: err.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const payload = {
      project_id: form.project_id || null,
      season_id: form.season_id || null,
      name: form.name,
      description: form.description,
      rarity: form.rarity,
      icon_url: form.icon_url || null,
      active_from: form.active_from || null,
      active_to: form.active_to || null,
      rewards: rewardsJson,
      unlock_rules: rulesJson,
    };

    const { error } = await supabase.from('achievements').insert(payload);
    if (error) {
      toast({ title: 'Error creating achievement', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Achievement created', description: 'New achievement saved successfully.' });
      setForm((f) => ({
        ...f,
        name: '',
        description: '',
        icon_url: '',
        rewards: '[]',
        unlock_rules: '{}',
      }));
    }
    setLoading(false);
  };

  return (
    <Card className="glass-effect-light">
      <CardHeader>
        <CardTitle className="text-xl text-white">Create Achievement</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-300">Project</Label>
              <Select
                value={form.project_id || undefined}
                onValueChange={(v) => handleChange('project_id', v)}
                disabled={loadingProjects || projects.length === 0}
              >
                <SelectTrigger className="bg-black/30 text-white border-white/10">
                  <SelectValue placeholder={projects.length ? "Select project" : "No projects found"} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {projects.length === 0 && (
                <p className="text-xs text-red-400 mt-1">No projects found. Crea proyectos primero en Supabase.</p>
              )}
              {projectLoadError && (
                <p className="text-xs text-red-400 mt-1">Error: {projectLoadError}</p>
              )}
            </div>
            <div>
              <Label className="text-gray-300">Season (optional)</Label>
              <Select
                value={form.season_id || 'none'}
                onValueChange={(v) => handleChange('season_id', v === 'none' ? null : v)}
                disabled={loadingSeasons || seasons.length === 0}
              >
                <SelectTrigger className="bg-black/30 text-white border-white/10">
                  <SelectValue placeholder={seasons.length ? 'Select season' : 'No seasons'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {seasons.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-300">Name</Label>
              <Input value={form.name} onChange={(e) => handleChange('name', e.target.value)} required />
            </div>
            <div>
              <Label className="text-gray-300">Rarity</Label>
              <Select value={form.rarity} onValueChange={(v) => handleChange('rarity', v)}>
                <SelectTrigger className="bg-black/30 text-white border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="common">Common</SelectItem>
                  <SelectItem value="rare">Rare</SelectItem>
                  <SelectItem value="epic">Epic</SelectItem>
                  <SelectItem value="legendary">Legendary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-gray-300">Description</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => handleChange('description', e.target.value)} />
            </div>
            <div>
              <Label className="text-gray-300">Icon URL (PNG/SVG)</Label>
              <Input value={form.icon_url} onChange={(e) => handleChange('icon_url', e.target.value)} />
            </div>
            <div>
              <Label className="text-gray-300">Active From</Label>
              <Input type="datetime-local" value={form.active_from} onChange={(e) => handleChange('active_from', e.target.value)} />
            </div>
            <div>
              <Label className="text-gray-300">Active To</Label>
              <Input type="datetime-local" value={form.active_to} onChange={(e) => handleChange('active_to', e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-gray-300">Rewards (JSON array)</Label>
            <Textarea
              rows={3}
              value={form.rewards}
              onChange={(e) => handleChange('rewards', e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-gray-500 mt-1">Ejemplo: <code className="font-mono">{SAMPLE_REWARDS}</code></p>
          </div>

          <div>
            <Label className="text-gray-300">Unlock Rules (JSON)</Label>
            <Textarea
              rows={3}
              value={form.unlock_rules}
              onChange={(e) => handleChange('unlock_rules', e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-gray-500 mt-1">Ejemplo: <code className="font-mono">{SAMPLE_RULES}</code></p>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={loading} className="golden-gradient text-black font-semibold">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Save className="w-4 h-4 mr-2" />
              Save Achievement
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
