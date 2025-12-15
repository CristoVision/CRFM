// src/components/admin/StationsTab.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import ConfirmationDialog from '@/components/common/ConfirmationDialog';
import { Radio, RefreshCcw, Trash2, Save, Plus, ArrowUp, ArrowDown, X, AlertTriangle } from 'lucide-react';
import MultiSelectTrackPicker from '@/components/ui/MultiSelectTrackPicker';

function Row({ children }) {
  return <div className="flex flex-col sm:flex-row sm:items-center gap-3">{children}</div>;
}

const StationsTab = () => {
  const { profile } = useAuth();
  const [stations, setStations] = useState([]);
  const [loadingStations, setLoadingStations] = useState(false);
  const [savingStation, setSavingStation] = useState(false);
  const [creatingStation, setCreatingStation] = useState(false);
  const [expandedStationId, setExpandedStationId] = useState(null);

  // gestión de pistas por estación
  const [tracksByStation, setTracksByStation] = useState({}); // { [stationId]: [{ id, track_id, play_order, track:{...}}] }
  const [pickerOpenFor, setPickerOpenFor] = useState(null); // stationId o null
  const [pickerSelected, setPickerSelected] = useState([]); // [{value, label, ...}]

  const [newStation, setNewStation] = useState({
    name: '',
    description: '',
    is_active: true,
    is_sign_in_station: false,
    ad_interval_seconds: 0,
  });

  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [confirmDialogTitle, setConfirmDialogTitle] = useState('');
  const [confirmDialogDescription, setConfirmDialogDescription] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);

  const fetchStations = async () => {
    setLoadingStations(true);
    try {
      const { data, error } = await supabase
        .from('stations')
        .select('id,name,description,is_active,is_sign_in_station,ad_interval_seconds,created_at,updated_at')
        .order('is_sign_in_station', { ascending: false })
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStations(data || []);
    } catch (e) {
      toast({ title: 'Error loading stations', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingStations(false);
    }
  };

  const loadStationTracks = async (stationId) => {
    try {
      const { data, error } = await supabase
        .from('station_tracks')
        .select(`
          id,
          station_id,
          track_id,
          play_order,
          track:tracks(id,title,creator_display_name,cover_art_url)
        `)
        .eq('station_id', stationId)
        .order('play_order', { ascending: true });

      if (error) throw error;
      setTracksByStation((prev) => ({ ...prev, [stationId]: data || [] }));
    } catch (e) {
      toast({ title: 'Error loading tracks', description: e.message, variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (!profile?.is_admin) return;
    fetchStations();
  }, [profile]);

  if (!profile?.is_admin) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-8 glass-effect rounded-xl text-white">
        <AlertTriangle className="w-12 h-12 text-yellow-400 mb-4" />
        <h3 className="text-2xl font-semibold text-yellow-300 mb-2">Admin access required</h3>
        <p className="text-gray-400">Only administrators can manage stations.</p>
      </div>
    );
  }

  const createStation = async () => {
    if (!newStation.name.trim()) {
      toast({ title: 'Name required', description: 'Please enter a station name.', variant: 'destructive' });
      return;
    }
    setCreatingStation(true);
    try {
      const { data, error } = await supabase.rpc('rpc_admin_upsert_station', {
        p_admin_id: profile.id,
        p_id: null,
        p_name: newStation.name.trim(),
        p_description: newStation.description?.trim() || null,
        p_is_active: !!newStation.is_active,
        p_is_sign_in: !!newStation.is_sign_in_station,
        p_ad_interval_seconds: Number.isFinite(+newStation.ad_interval_seconds) ? +newStation.ad_interval_seconds : 0,
      });
      if (error) throw error;

      toast({ title: 'Station created', description: data?.name || newStation.name, variant: 'success' });
      setNewStation({ name: '', description: '', is_active: true, is_sign_in_station: false, ad_interval_seconds: 0 });
      fetchStations();
    } catch (e) {
      toast({ title: 'Create failed', description: e.message, variant: 'destructive' });
    } finally {
      setCreatingStation(false);
    }
  };

  const updateStationField = async (id, field, value) => {
    setSavingStation(true);
    try {
      const station = stations.find(s => s.id === id);
      if (!station) throw new Error('Station not found');
      const { error } = await supabase.rpc('rpc_admin_upsert_station', {
        p_admin_id: profile.id,
        p_id: id,
        p_name: field === 'name' ? value : station.name,
        p_description: field === 'description' ? value : station.description,
        p_is_active: field === 'is_active' ? value : station.is_active,
        p_is_sign_in: field === 'is_sign_in_station' ? value : station.is_sign_in_station,
        p_ad_interval_seconds: field === 'ad_interval_seconds' ? value : station.ad_interval_seconds ?? 0,
      });
      if (error) throw error;
      setStations(prev => prev.map(s => (s.id === id ? { ...s, [field]: value } : s)));
      toast({ title: 'Updated', description: `${field} saved`, variant: 'success' });
    } catch (e) {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
      fetchStations();
    } finally {
      setSavingStation(false);
    }
  };

  const refreshStationQueue = async (id) => {
    try {
      const { error } = await supabase.rpc('refresh_station_random_tracks', { p_station_id: id, p_limit: 30 });
      if (error) throw error;
      toast({ title: 'Refreshed', description: 'Random queue rebuilt (30 tracks).', variant: 'success' });
      await loadStationTracks(id);
    } catch (e) {
      toast({ title: 'Refresh failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleDeleteStation = (id) => {
    setConfirmDialogTitle('Delete Station?');
    setConfirmDialogDescription('Are you sure you want to delete this station? This action cannot be undone.');
    setConfirmAction(() => async () => {
      try {
        const { error } = await supabase.rpc('rpc_admin_delete_station', {
          p_admin_id: profile.id,
          p_station_id: id,
        });
        if (error) throw error;
        setStations(prev => prev.filter(s => s.id !== id));
        setTracksByStation(prev => {
          const copy = { ...prev };
          delete copy[id];
          return copy;
        });
        toast({ title: 'Station deleted', variant: 'success' });
      } catch (e) {
        toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
      } finally {
        setIsConfirmDialogOpen(false);
      }
    });
    setIsConfirmDialogOpen(true);
  };

  const openManageTracks = async (stationId) => {
    setExpandedStationId(prev => (prev === stationId ? null : stationId));
    await loadStationTracks(stationId);
  };

  const addTracksToStation = async (stationId) => {
    if (!pickerSelected.length) {
      setPickerOpenFor(null);
      return;
    }
    try {
      const current = tracksByStation[stationId] || [];
      let nextOrder = current.length > 0 ? Math.max(...current.map(t => t.play_order || 0)) + 1 : 1;

      const rows = pickerSelected.map(opt => ({
        station_id: stationId,
        track_id: opt.value,
        play_order: nextOrder++,
      }));

      const { error } = await supabase.from('station_tracks').insert(rows);
      if (error) throw error;

      toast({ title: 'Tracks added', description: `${rows.length} track(s) added.`, variant: 'success' });
      setPickerSelected([]);
      setPickerOpenFor(null);
      await loadStationTracks(stationId);
    } catch (e) {
      toast({ title: 'Add failed', description: e.message, variant: 'destructive' });
    }
  };

  const removeStationTrack = async (stationId, stationTrackId) => {
    try {
      const { error } = await supabase.rpc('rpc_admin_remove_station_track', {
        p_admin_id: profile.id,
        p_station_track_id: stationTrackId,
      });
      if (error) throw error;
      await loadStationTracks(stationId);
    } catch (e) {
      toast({ title: 'Remove failed', description: e.message, variant: 'destructive' });
    }
  };

  const moveTrack = async (stationId, stationTrackId, direction) => {
    const list = tracksByStation[stationId] || [];
    const index = list.findIndex(t => t.id === stationTrackId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const a = list[index];
    const b = list[targetIndex];

    try {
      // swap play_order
      const { error: e1 } = await supabase.from('station_tracks').update({ play_order: b.play_order }).eq('id', a.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('station_tracks').update({ play_order: a.play_order }).eq('id', b.id);
      if (e2) throw e2;

      await loadStationTracks(stationId);
    } catch (e) {
      toast({ title: 'Reorder failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Crear estación */}
      <Card className="glass-effect">
        <CardContent className="p-4 sm:p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Radio className="w-5 h-5 mr-2 text-yellow-400" />
            Create Station
          </h2>

          <div className="space-y-4">
            <Row>
              <div className="w-full">
                <Label>Name</Label>
                <Input
                  value={newStation.name}
                  onChange={e => setNewStation(s => ({ ...s, name: e.target.value }))}
                  placeholder="e.g., CRFM Default Radio"
                />
              </div>
            </Row>

            <Row>
              <div className="w-full">
                <Label>Short description (optional)</Label>
                <Input
                  value={newStation.description}
                  onChange={e => setNewStation(s => ({ ...s, description: e.target.value }))}
                  placeholder="Auto-generated 24/7 free station"
                />
              </div>
            </Row>

            <Row>
              <div className="flex items-center gap-2">
                <Switch
                  checked={newStation.is_active}
                  onCheckedChange={v => setNewStation(s => ({ ...s, is_active: v }))}
                />
                <span className="text-sm text-gray-300">Active</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={newStation.is_sign_in_station}
                  onCheckedChange={v => setNewStation(s => ({ ...s, is_sign_in_station: v }))}
                />
                <span className="text-sm text-gray-300">Used on sign in</span>
              </div>
            </Row>

            <Row>
              <div className="w-full sm:max-w-[220px]">
                <Label>Ad interval (sec)</Label>
                <Input
                  type="number"
                  value={newStation.ad_interval_seconds}
                  onChange={e => setNewStation(s => ({ ...s, ad_interval_seconds: e.target.value }))}
                  placeholder="0 = no ads"
                />
              </div>
            </Row>

            <div className="pt-2">
              <Button
                className="golden-gradient text-black font-semibold"
                onClick={createStation}
                disabled={creatingStation}
              >
                {creatingStation ? <RefreshCcw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Create
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Listado de estaciones */}
      <Card className="glass-effect">
        <CardContent className="p-4 sm:p-6">
          <h2 className="text-xl font-semibold mb-4">Stations</h2>

          {loadingStations ? (
            <div className="text-gray-400">Loading stations…</div>
          ) : stations.length === 0 ? (
            <div className="text-gray-400">No stations found.</div>
          ) : (
            <div className="space-y-5">
              {stations.map(st => {
                const isExpanded = expandedStationId === st.id;
                const trackList = tracksByStation[st.id] || [];
                return (
                  <div key={st.id} className="p-4 rounded-xl bg-white/5 border border-white/10">
                    {/* Header + acciones (alineado para móvil) */}
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-lg font-semibold break-words">{st.name}</div>
                          <div className="text-sm text-gray-400 break-words">
                            {st.description || '—'}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button size="sm" variant="outline" className="h-9"
                            onClick={() => refreshStationQueue(st.id)}>
                            <RefreshCcw className="w-4 h-4 mr-2" />
                            Refresh Queue
                          </Button>
                          <Button size="sm" variant="destructive" className="h-9"
                            onClick={() => handleDeleteStation(st.id)}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={!!st.is_active}
                            onCheckedChange={(v) => updateStationField(st.id, 'is_active', v)}
                            disabled={savingStation}
                          />
                          <span className="text-xs text-gray-300">Active</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={!!st.is_sign_in_station}
                            onCheckedChange={(v) => updateStationField(st.id, 'is_sign_in_station', v)}
                            disabled={savingStation}
                          />
                          <span className="text-xs text-gray-300">Used on sign in</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-gray-300">Ad interval</Label>
                          <Input
                            className="h-8 text-sm w-24"
                            type="number"
                            value={st.ad_interval_seconds ?? 0}
                            onChange={(e) => updateStationField(st.id, 'ad_interval_seconds', +e.target.value || 0)}
                            disabled={savingStation}
                          />
                        </div>
                        <div className="text-xs text-gray-500 self-center">
                          Updated: {new Date(st.updated_at).toLocaleString()}
                        </div>
                      </div>

                      {/* Botón gestionar pistas */}
                      <div className="pt-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openManageTracks(st.id)}
                          className="bg-white/10 hover:bg-white/20"
                        >
                          {isExpanded ? 'Hide tracks' : 'Manage tracks'}
                        </Button>
                      </div>

                      {/* Gestión de pistas */}
                      {isExpanded && (
                        <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3">
                          <div className="flex flex-wrap items-center gap-2 justify-between">
                            <div className="text-sm font-semibold">Tracks in station ({trackList.length})</div>
                            <div className="flex items-center gap-2">
                              {pickerOpenFor === st.id ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => addTracksToStation(st.id)}
                                    className="golden-gradient text-black font-semibold"
                                  >
                                    <Plus className="w-4 h-4 mr-1" />
                                    Add selected
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={() => { setPickerOpenFor(null); setPickerSelected([]); }}>
                                    <X className="w-4 h-4" />
                                  </Button>
                                </>
                              ) : (
                                <Button size="sm" onClick={() => setPickerOpenFor(st.id)}>
                                  <Plus className="w-4 h-4 mr-1" />
                                  Add tracks
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Picker (multi-select) */}
                          {pickerOpenFor === st.id && (
                            <div className="mt-3">
                              <MultiSelectTrackPicker
                                selected={pickerSelected}
                                onChange={setPickerSelected}
                                placeholder="Search tracks to add…"
                              />
                            </div>
                          )}

                          {/* Lista de pistas */}
                          <div className="mt-3 space-y-2">
                            {trackList.length === 0 ? (
                              <div className="text-sm text-gray-400">No tracks in this station.</div>
                            ) : (
                              trackList.map((row, idx) => (
                                <div
                                  key={row.id}
                                  className="flex items-center gap-3 p-2 bg-white/5 rounded-md border border-white/10"
                                >
                                  <img
                                    src={row.track?.cover_art_url || ''}
                                    alt=""
                                    className="w-10 h-10 rounded object-cover bg-black/40"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-sm font-medium truncate">
                                      {row.track?.title || 'Untitled'}
                                    </div>
                                    <div className="text-xs text-gray-400 truncate">
                                      {row.track?.creator_display_name || 'Unknown Artist'}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      onClick={() => moveTrack(st.id, row.id, 'up')}
                                      disabled={idx === 0}
                                      title="Move up"
                                    >
                                      <ArrowUp className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      onClick={() => moveTrack(st.id, row.id, 'down')}
                                      disabled={idx === trackList.length - 1}
                                      title="Move down"
                                    >
                                      <ArrowDown className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-red-400 hover:text-red-300"
                                      onClick={() => removeStationTrack(st.id, row.id)}
                                      title="Remove from station"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmationDialog
        isOpen={isConfirmDialogOpen}
        onOpenChange={setIsConfirmDialogOpen}
        onConfirm={confirmAction}
        title={confirmDialogTitle}
        description={confirmDialogDescription}
      />
    </div>
  );
};

export default StationsTab;
