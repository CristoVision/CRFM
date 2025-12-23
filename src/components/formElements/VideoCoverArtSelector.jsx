import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, PlaySquare, RefreshCw, UploadCloud, X } from 'lucide-react';

const BUCKET = 'videocoverart';
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hora

const ACCEPTED_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'image/gif',
];

function isHttpUrl(v) {
  return typeof v === 'string' && /^https?:\/\//i.test(v);
}

// Intentamos convertir "value" a path dentro del bucket.
// Acepta: "userId/file.mp4"  o "videocoverart/userId/file.mp4" o URL (best-effort)
function toBucketPath(value, userId) {
  if (!value) return null;

  if (isHttpUrl(value)) {
    try {
      const u = new URL(value);
      const parts = u.pathname.split('/').filter(Boolean);
      const idx = parts.findIndex((p) => p === BUCKET);
      if (idx >= 0) return decodeURIComponent(parts.slice(idx + 1).join('/'));
      return null;
    } catch {
      return null;
    }
  }

  const cleaned = value.replace(/^\/+/, '');

  if (cleaned.startsWith(`${BUCKET}/`)) return cleaned.slice(`${BUCKET}/`.length);

  // Si es solo "file.mp4" y tenemos userId, lo asumimos en folder userId/
  if (userId && !cleaned.includes('/')) return `${userId}/${cleaned}`;

  return cleaned;
}

async function signPath(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data?.signedUrl || null;
}

export default function VideoCoverArtSelector({
  userId,
  value,
  onChange,
  label = 'Video cover art',
  description = 'Upload a short loop or select one already uploaded.',
  disabled = false,
}) {
  const [existing, setExisting] = useState([]); // [{ name, path, url }]
  const [selectedUrl, setSelectedUrl] = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [uploading, setUploading] = useState(false);

  const selectedLabel = useMemo(() => {
    if (!value) return '';
    if (isHttpUrl(value)) {
      try {
        const u = new URL(value);
        return decodeURIComponent(u.pathname.split('/').pop() || '');
      } catch {
        return 'Selected';
      }
    }
    const cleaned = value.replace(/^\/+/, '');
    return decodeURIComponent(cleaned.split('/').pop() || '');
  }, [value]);

  const refreshList = useCallback(async () => {
    if (!userId) return;

    setLoadingList(true);
    try {
      const { data, error } = await supabase.storage.from(BUCKET).list(userId, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      });
      if (error) throw error;

      const items = (data || []).filter((x) => x?.name);

      const rows = await Promise.all(
        items.map(async (it) => {
          const path = `${userId}/${it.name}`;
          const url = await signPath(path);
          if (!url) return null;
          return { name: it.name, path, url };
        })
      );

      setExisting(rows.filter(Boolean));
    } catch (err) {
      console.error(err);
      toast({
        title: 'No pude cargar tus video cover arts',
        description: err?.message || 'Error en Storage.',
        variant: 'destructive',
      });
    } finally {
      setLoadingList(false);
    }
  }, [userId]);

  // Lista al montar / cambiar userId
  useEffect(() => {
    refreshList();
  }, [refreshList]);

  // Firmar el seleccionado (si value es path)
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!value) {
        setSelectedUrl(null);
        return;
      }

      if (isHttpUrl(value)) {
        setSelectedUrl(value);
        return;
      }

      const path = toBucketPath(value, userId);
      const url = await signPath(path);

      if (!cancelled) setSelectedUrl(url);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [value, userId]);

  const handlePick = (row) => {
    // Guardamos un value “estable” como path dentro del bucket
    onChange?.(`${BUCKET}/${row.path}`);
  };

  const handleClear = () => onChange?.('');

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !userId) return;

    const ok = ACCEPTED_TYPES.some((t) => file.type === t || (t.startsWith('video/') && file.type.startsWith('video/')));
    if (!ok) {
      toast({ title: 'Archivo inválido', description: 'Usa MP4/WEBM/OGG/MOV o GIF.', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const safeName = `${Date.now()}_${file.name}`.replace(/\s+/g, '_');
      const path = `${userId}/${safeName}`;

      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: '3600',
      });

      if (error) throw error;

      onChange?.(`${BUCKET}/${path}`);

      toast({ title: 'Subido', description: 'Video cover art listo.', variant: 'success' });
      await refreshList();
    } catch (err) {
      console.error(err);
      toast({ title: 'Upload falló', description: err?.message || 'No se pudo subir.', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-gray-300">{label}</Label>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={refreshList} disabled={disabled || loadingList || uploading}>
            {loadingList ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
          {value ? (
            <Button type="button" variant="ghost" size="sm" onClick={handleClear} disabled={disabled || uploading}>
              <X className="w-4 h-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {description ? <p className="text-xs text-gray-400">{description}</p> : null}

      <div className="flex items-center gap-3">
        <Input
          type="file"
          accept="video/*,image/gif"
          onChange={handleUpload}
          disabled={disabled || uploading}
          className="bg-white/5 border-white/10 text-gray-400 file:text-yellow-400 hover:file:bg-yellow-400/10"
        />
        <Button type="button" variant="outline" className="border-yellow-400/40 text-yellow-300 hover:bg-yellow-400/10" disabled>
          <UploadCloud className="w-4 h-4 mr-2" />
          Bucket: {BUCKET}
        </Button>
      </div>

      {value && selectedUrl ? (
        <div className="relative rounded-lg overflow-hidden border border-yellow-500/30">
          <video
            key={selectedUrl}
            src={selectedUrl}
            className="w-full h-48 object-cover bg-black"
            loop
            muted
            playsInline
            autoPlay
          />
          <div className="absolute bottom-2 left-2 bg-black/60 text-xs text-yellow-200 px-2 py-1 rounded flex items-center gap-1">
            <PlaySquare className="w-4 h-4" />
            <span>{selectedLabel}</span>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-200">Your uploaded video cover arts</p>
          <p className="text-xs text-gray-400">{existing.length} found</p>
        </div>

        {existing.length === 0 ? (
          <p className="text-xs text-gray-500 border border-dashed border-white/10 rounded-md p-3">
            No uploads yet. Add a short loop to get started.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-auto pr-1 custom-scrollbar">
            {existing.map((row) => (
              <button
                key={row.path}
                type="button"
                className={`group relative rounded-md overflow-hidden border ${
                  value === `${BUCKET}/${row.path}` ? 'border-yellow-400/70' : 'border-white/10'
                } hover:border-yellow-400/60 transition-colors`}
                onClick={() => handlePick(row)}
                disabled={disabled || uploading}
              >
                <video src={row.url} className="w-full h-28 object-cover bg-black" muted loop playsInline />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10" />
                <div className="absolute bottom-1 left-1 right-1 bg-black/60 text-[11px] text-gray-200 px-2 py-1 truncate flex items-center gap-1">
                  <PlaySquare className="w-3 h-3" />
                  <span title={row.name}>{row.name}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
