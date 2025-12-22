import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import MultiSelectTrackPicker from '@/components/ui/MultiSelectTrackPicker';
import { pickImageFallback } from '@/lib/mediaFallbacks';

const GAME_SLUG = 'du_tcg_pr';

const DuGameMusicTab = () => {
  const { profile, user } = useAuth();
  const [selectedTracks, setSelectedTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile?.is_admin) {
      setLoading(false);
      return;
    }
    const fetchGameMusic = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('game_music_tracks')
          .select('id, track_id, order_index, tracks:tracks(id, title, cover_art_url, creator_display_name)')
          .eq('game_slug', GAME_SLUG)
          .order('order_index', { ascending: true });
        if (error) throw error;
        const tracks = (data || [])
          .map((row) => row.tracks)
          .filter(Boolean)
          .map((track) => ({
            id: track.id,
            title: track.title,
            cover_art_url: track.cover_art_url,
            creator_display_name: track.creator_display_name,
          }));
        setSelectedTracks(tracks);
      } catch (err) {
        toast({ title: 'Game music error', description: err.message, variant: 'destructive' });
        setSelectedTracks([]);
      } finally {
        setLoading(false);
      }
    };
    fetchGameMusic();
  }, [profile?.is_admin]);

  const handleSave = async () => {
    if (!profile?.is_admin || !user?.id) return;
    setSaving(true);
    try {
      const { error: deleteError } = await supabase
        .from('game_music_tracks')
        .delete()
        .eq('game_slug', GAME_SLUG);
      if (deleteError) throw deleteError;

      if (selectedTracks.length) {
        const payload = selectedTracks.map((track, index) => ({
          game_slug: GAME_SLUG,
          track_id: track.id,
          order_index: index + 1,
          is_active: true,
          created_by: user.id,
          updated_by: user.id,
        }));
        const { error: insertError } = await supabase.from('game_music_tracks').insert(payload);
        if (insertError) throw insertError;
      }

      toast({ title: 'Game music updated', description: 'DU game soundtrack saved.' });
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!profile?.is_admin) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-gray-300">
        Admin access required.
      </div>
    );
  }

  return (
    <div className="space-y-6 text-white">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>DU Game Music</CardTitle>
          <Badge variant="secondary">{selectedTracks.length}</Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-300">
            Selecciona las pistas que sonaran dentro de DU TCG PR cuando el jugador active musica del juego.
          </p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="glass-effect p-6 rounded-xl">Cargando...</div>
      ) : (
        <div className="glass-effect p-6 rounded-xl space-y-4">
          <MultiSelectTrackPicker
            selectedTracks={selectedTracks}
            onSelectedTracksChange={setSelectedTracks}
            placeholder="Buscar tracks para musica del juego..."
          />
          <div className="space-y-3">
            {selectedTracks.map((track, index) => (
              <div key={track.id} className="flex items-center gap-3 bg-black/30 rounded-lg p-2 border border-white/10">
                <span className="text-xs text-yellow-300 w-6 text-center">{index + 1}</span>
                <img-replace
                  src={pickImageFallback([track.cover_art_url], '/favicon-32x32.png')}
                  alt={track.title}
                  className="w-10 h-10 rounded-md object-cover"
                />
                <div className="flex-1">
                  <div className="text-sm font-semibold">{track.title}</div>
                  <div className="text-xs text-gray-400">{track.creator_display_name || 'Creador'}</div>
                </div>
              </div>
            ))}
          </div>
          <Button
            onClick={handleSave}
            className="golden-gradient text-black font-semibold"
            disabled={saving}
          >
            {saving ? 'Guardando...' : 'Guardar musica'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default DuGameMusicTab;
