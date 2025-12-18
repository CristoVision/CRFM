import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, CheckCircle, Cloud, FolderUp, Loader2, Music, RefreshCw, Upload, XCircle } from 'lucide-react';

const SUPPORTED_AUDIO = ['mp3', 'm4a', 'wav', 'flac', 'aac', 'ogg'];
const SUPPORTED_IMAGES = ['jpg', 'jpeg', 'png', 'webp'];

const safeLower = (v) => (v == null ? '' : String(v).toLowerCase());

const extOf = (name) => {
  const parts = String(name || '').split('.');
  if (parts.length < 2) return '';
  return safeLower(parts[parts.length - 1]);
};

const sanitizeKeyPart = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\/\\]/g, '-')
    .replace(/[^a-zA-Z0-9 _\-.()]/g, '')
    .slice(0, 180);

const slugify = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);

const makeBatchId = (title) => {
  const base = slugify(title || 'album');
  return `${base || 'album'}-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(16).slice(2, 8)}`;
};

const detectBrowser = () => {
  if (typeof navigator === 'undefined') return { name: 'unknown', isSafari: false, isChromium: false };
  const ua = navigator.userAgent || '';
  const isDuckDuckGo = ua.includes('DuckDuckGo');
  const isCriOS = ua.includes('CriOS'); // Chrome on iOS
  const isFxiOS = ua.includes('FxiOS');
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|Edg|OPR/.test(ua);
  const isChromium = /Chrome|CriOS|Edg/.test(ua);
  const name = isDuckDuckGo ? 'duckduckgo' : isCriOS ? 'chrome_ios' : isFxiOS ? 'firefox_ios' : isSafari ? 'safari' : isChromium ? 'chromium' : 'unknown';
  return { name, isSafari, isChromium };
};

const formatNumber = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString();
};

const formatBytes = (bytes) => {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let idx = 0;
  let value = n;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
};

const pickCreatorDisplayName = (profile) => profile?.display_name || profile?.username || profile?.full_name || 'Creator';

const fileKind = (file) => {
  const ext = extOf(file?.name);
  if (SUPPORTED_AUDIO.includes(ext)) return 'audio';
  if (SUPPORTED_IMAGES.includes(ext)) return 'image';
  return 'other';
};

const guessTrackTitleFromFilename = (name) => {
  const base = String(name || '').replace(/\.[^.]+$/, '');
  return base.replace(/^\d+\s*[-_.]\s*/, '').trim();
};

const DEFAULTS = {
  is_public: false,
  stream_cost: 1,
  is_christian_nature: true,
};

const LOCAL_KEY = 'crfm:bulk_upload_draft_v1';

const loadDraft = () => {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const saveDraft = (draft) => {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(draft));
  } catch {
    // ignore
  }
};

const clearDraft = () => {
  try {
    localStorage.removeItem(LOCAL_KEY);
  } catch {
    // ignore
  }
};

const mergeNewFilesIntoDraft = (prevFiles, incomingFiles) => {
  const prev = Array.isArray(prevFiles) ? prevFiles : [];
  const next = [];
  const seen = new Set();

  const keyOf = (f) => {
    const file = f?.file;
    const name = f?.name || file?.name || '';
    const size = file?.size ?? f?.size ?? 0;
    const lastModified = file?.lastModified ?? f?.lastModified ?? 0;
    return `${name}::${size}::${lastModified}`;
  };

  const push = (f) => {
    const k = keyOf(f);
    if (seen.has(k)) return;
    seen.add(k);
    next.push(f);
  };

  prev.forEach(push);
  incomingFiles.forEach(push);
  return next;
};

const buildStorageKey = ({ userId, batchId, kind, fileName }) => {
  const cleanName = sanitizeKeyPart(fileName);
  if (kind === 'album_cover') return `${userId}/albums/${batchId}/${cleanName}`;
  if (kind === 'track_cover') return `${userId}/track-covers/${batchId}/${cleanName}`;
  return `${userId}/tracks/${batchId}/${cleanName}`;
};

const inferBatchIdFromStorageKey = (storageKey) => {
  const raw = String(storageKey || '');
  if (!raw) return null;
  const match = raw.match(/\/(?:tracks|albums|track-covers)\/([^/]+)\//i);
  return match?.[1] || null;
};

const uploadToBucket = async ({ bucket, objectPath, file }) => {
  const { error } = await supabase.storage.from(bucket).upload(objectPath, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  return data?.publicUrl || null;
};

const publicUrlFor = ({ bucket, storageKey }) => {
  if (!bucket || !storageKey) return null;
  const { data } = supabase.storage.from(bucket).getPublicUrl(storageKey);
  return data?.publicUrl || null;
};

const hasActiveUnlimited = (profile) => {
  const status = safeLower(profile?.stripe_subscription_status);
  if (status === 'active' || status === 'trialing') return true;
  const expiresAt = profile?.creator_unlimited_expires_at;
  if (!expiresAt) return false;
  const ts = new Date(expiresAt).getTime();
  return Number.isFinite(ts) && ts > Date.now();
};

const getPolicyLabel = (policy) => {
  if (policy === 'subscription') return 'Unlimited (Subscription)';
  if (policy === 'pay_per_upload') return 'Pay Per Upload';
  return 'Free (10% platform fee on streams)';
};

const CreatorBulkUploadWorkspace = ({ open, onOpenChange }) => {
  const { user, profile, refreshUserProfile } = useAuth();
  const browser = useMemo(() => detectBrowser(), []);
  const inputRef = useRef(null);
  const trackAudioInputRef = useRef(null);
  const pendingTrackAudioIdRef = useRef(null);

  const [step, setStep] = useState('staging'); // staging | uploading | done
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [dbReady, setDbReady] = useState(true);

  const [mode, setMode] = useState('album'); // album | singles
  const [albumTitle, setAlbumTitle] = useState('');
  const [draftBatchId, setDraftBatchId] = useState(null);
  const [usePerTrackCovers, setUsePerTrackCovers] = useState(false);
  const [selectedPolicyMode, setSelectedPolicyMode] = useState('inherit'); // inherit | fixed
  const [fixedPolicy, setFixedPolicy] = useState('free'); // free | pay_per_upload | subscription

  const [files, setFiles] = useState([]); // { id, file?, name, kind, status, error?, publicUrl?, bucket?, storageKey?, size?, lastModified? }
  const [tracks, setTracks] = useState([]); // { id, title, audioFileId, coverFileId, trackNumber }
  const [albumCoverFileId, setAlbumCoverFileId] = useState(null);

  const [credits, setCredits] = useState({ track: 0, album: 0 });
  const [creditsLoading, setCreditsLoading] = useState(false);

  const effectiveCreatorPolicy = safeLower(profile?.creator_upload_policy || 'free');
  const unlimitedActive = hasActiveUnlimited(profile);

  const canProceedWithPolicy = useMemo(() => {
    if (unlimitedActive) return { ok: true };
    if (effectiveCreatorPolicy === 'free') return { ok: true };
    if (effectiveCreatorPolicy === 'subscription') return { ok: false, reason: 'subscription_required' };
    if (effectiveCreatorPolicy === 'pay_per_upload') {
      const needsAlbumCredit = mode === 'album';
      const available = needsAlbumCredit ? credits.album : credits.track;
      return available > 0 ? { ok: true } : { ok: false, reason: 'credits_required' };
    }
    return { ok: true };
  }, [credits.album, credits.track, effectiveCreatorPolicy, mode, unlimitedActive]);

  const removeTrackById = (trackId) => {
    const target = tracks.find((t) => t.id === trackId);
    if (!target) return;

    setTracks((prev) => {
      const remaining = (prev || []).filter((t) => t.id !== trackId);
      return remaining.map((t, idx) => ({ ...t, trackNumber: idx + 1 }));
    });

    setFiles((prev) => {
      const next = [...(prev || [])];
      const isUsedAsAlbumCover = (fileId) => !!fileId && fileId === albumCoverFileId;
      const isUsedByOtherTracks = (fileId) => !!fileId && tracks.some((t) => t.id !== trackId && (t.audioFileId === fileId || t.coverFileId === fileId));
      const shouldKeep = (fileId) => isUsedAsAlbumCover(fileId) || isUsedByOtherTracks(fileId);

      const maybeDrop = (fileId) => {
        if (!fileId) return;
        if (shouldKeep(fileId)) return;
        const idx = next.findIndex((f) => f.id === fileId);
        if (idx < 0) return;
        const meta = next[idx];
        const canSafelyDrop = !meta.publicUrl && !meta.storageKey;
        if (canSafelyDrop) next.splice(idx, 1);
      };

      maybeDrop(target.audioFileId);
      maybeDrop(target.coverFileId);

      return next;
    });

    toast({ title: 'Track removed', description: target.title || 'Untitled' });
  };

  const supportedAudioCount = useMemo(() => files.filter((f) => f.kind === 'audio').length, [files]);
  const supportedImageCount = useMemo(() => files.filter((f) => f.kind === 'image').length, [files]);
  const unsupportedCount = useMemo(() => files.filter((f) => f.kind === 'other').length, [files]);

  const resolvedBatchId = useMemo(() => draftBatchId || null, [draftBatchId]);

  useEffect(() => {
    if (!open) return;
    setStep('staging');
    setBusy(false);
    setLastError(null);
    setDbReady(true);
    setMode('album');
    setAlbumTitle('');
    setDraftBatchId(null);
    setUsePerTrackCovers(false);
    setSelectedPolicyMode('inherit');
    setFixedPolicy('free');
    setFiles([]);
    setTracks([]);
    setAlbumCoverFileId(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!user?.id) return;
    setCreditsLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('creator_upload_fee_credits')
          .select('fee_type, credits')
          .eq('user_id', user.id);
        if (error && error.code !== 'PGRST116') throw error;
        const next = { track: 0, album: 0 };
        (data || []).forEach((row) => {
          if (row.fee_type === 'track') next.track = Number(row.credits) || 0;
          if (row.fee_type === 'album') next.album = Number(row.credits) || 0;
        });
        setCredits(next);
      } catch {
        setCredits({ track: 0, album: 0 });
      } finally {
        setCreditsLoading(false);
      }
    })();
  }, [open, user?.id]);

  useEffect(() => {
    if (!open) return;
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      // Detect if DB has the columns required for idempotent bulk upserts.
      // If missing, inserts will fail after uploads, so warn early.
      try {
        const { error } = await supabase.from('tracks').select('import_key').limit(1);
        if (error) throw error;
        if (!cancelled) setDbReady(true);
      } catch {
        if (!cancelled) setDbReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user?.id]);

  useEffect(() => {
    if (!open) return;
    const draft = loadDraft();
    if (!draft) return;
    if (draft?.user_id && user?.id && draft.user_id !== user.id) return;
    if (!draft?.tracks || !draft?.files_meta) return;

    // We can restore metadata and already-uploaded URLs, but not File objects.
    setMode(draft.mode || 'album');
    setAlbumTitle(draft.album_title || '');
    setUsePerTrackCovers(!!draft.use_per_track_covers);
    setSelectedPolicyMode(draft.selected_policy_mode || 'inherit');
	    setFixedPolicy(draft.fixed_policy || 'free');
	    setAlbumCoverFileId(draft.album_cover_file_id || null);
	    setTracks(draft.tracks || []);
	    setFiles(draft.files_meta || []);
	    const explicitBatchId = draft.batch_id || null;
	    if (explicitBatchId) {
	      setDraftBatchId(explicitBatchId);
	    } else {
	      const inferred = (draft.files_meta || [])
	        .map((f) => inferBatchIdFromStorageKey(f?.storageKey))
	        .find((v) => !!v);
	      setDraftBatchId(inferred || null);
	    }
	  }, [open, user?.id]);

  useEffect(() => {
    if (!open) return;
    saveDraft({
      user_id: user?.id || null,
      mode,
      album_title: albumTitle,
      batch_id: draftBatchId,
      use_per_track_covers: usePerTrackCovers,
      selected_policy_mode: selectedPolicyMode,
      fixed_policy: fixedPolicy,
      album_cover_file_id: albumCoverFileId,
      tracks,
      // Only persist meta fields (no File objects).
      files_meta: files.map((f) => ({
        id: f.id,
        name: f.name || f.file?.name,
        kind: f.kind,
        status: f.status,
        error: f.error,
        publicUrl: f.publicUrl || null,
        bucket: f.bucket || null,
        storageKey: f.storageKey || null,
        size: f.file?.size ?? f.size ?? null,
        lastModified: f.file?.lastModified ?? f.lastModified ?? null,
        // file is NOT persisted
      })),
    });
  }, [albumCoverFileId, albumTitle, draftBatchId, files, fixedPolicy, mode, open, selectedPolicyMode, tracks, usePerTrackCovers, user?.id]);

  const reconcileFiles = (prevFiles, incomingFileList) => {
    const prev = Array.isArray(prevFiles) ? [...prevFiles] : [];
    const nowId = () => `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

    const fingerprint = (f) => {
      const name = (f?.name || f?.file?.name || '').trim();
      const size = f?.size ?? f?.file?.size ?? 0;
      const lastModified = f?.lastModified ?? f?.file?.lastModified ?? 0;
      return `${name}::${size}::${lastModified}`;
    };

    const indexByFingerprint = new Map();
    prev.forEach((p, idx) => {
      const key = fingerprint(p);
      if (!key || key.startsWith('::')) return;
      if (!indexByFingerprint.has(key)) indexByFingerprint.set(key, idx);
    });

    const indexByNameKind = new Map();
    prev.forEach((p, idx) => {
      const name = (p?.name || p?.file?.name || '').trim();
      const kind = p?.kind || 'other';
      const key = `${kind}::${name}`;
      if (!name) return;
      if (!indexByNameKind.has(key)) indexByNameKind.set(key, idx);
    });

    const incomingFiles = [];
    Array.from(incomingFileList || []).forEach((file) => {
      const kind = fileKind(file);
      const meta = {
        id: nowId(),
        file,
        name: file.name,
        kind,
        status: 'pending',
        error: null,
        publicUrl: null,
        bucket: null,
        storageKey: null,
        size: file.size ?? null,
        lastModified: file.lastModified ?? null,
      };

      const fp = fingerprint(meta);
      const existingIdxByFp = indexByFingerprint.get(fp);
      if (existingIdxByFp != null) {
        // Re-attach File handle to existing entry (keeps IDs stable for tracks).
        prev[existingIdxByFp] = {
          ...prev[existingIdxByFp],
          file,
          name: file.name,
          kind,
          size: file.size ?? prev[existingIdxByFp].size ?? null,
          lastModified: file.lastModified ?? prev[existingIdxByFp].lastModified ?? null,
          status: prev[existingIdxByFp].publicUrl ? 'uploaded' : prev[existingIdxByFp].status || 'pending',
        };
        return;
      }

      const nameKindKey = `${kind}::${file.name}`;
      const existingIdxByName = indexByNameKind.get(nameKindKey);
      if (existingIdxByName != null && !(prev[existingIdxByName]?.file)) {
        prev[existingIdxByName] = {
          ...prev[existingIdxByName],
          file,
          name: file.name,
          kind,
          size: file.size ?? prev[existingIdxByName].size ?? null,
          lastModified: file.lastModified ?? prev[existingIdxByName].lastModified ?? null,
          status: prev[existingIdxByName].publicUrl ? 'uploaded' : prev[existingIdxByName].status || 'pending',
        };
        return;
      }

      incomingFiles.push(meta);
    });

    return mergeNewFilesIntoDraft(prev, incomingFiles);
  };

  const setSelectionFromFileList = (fileList) => {
    setDraftBatchId((prev) => prev || makeBatchId(albumTitle));
    const nextFiles = reconcileFiles(files, fileList);
    setFiles(nextFiles);

    const nowId = () => `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const incomingTracks = [];
    const fingerprintOfFile = (file) => `${file.name}::${file.size ?? 0}::${file.lastModified ?? 0}`;
    const fingerprintOfMeta = (x) =>
      `${(x.name || x.file?.name || '')}::${x.size ?? x.file?.size ?? 0}::${x.lastModified ?? x.file?.lastModified ?? 0}`;

    const audioSelected = Array.from(fileList || []).filter((f) => fileKind(f) === 'audio');
    audioSelected.forEach((file) => {
      const fp = fingerprintOfFile(file);
      const match = nextFiles.find((x) => x.kind === 'audio' && fingerprintOfMeta(x) === fp);
      const audioId = match?.id || null;
      if (!audioId) return;
      incomingTracks.push({
        id: nowId(),
        title: guessTrackTitleFromFilename(file.name),
        audioFileId: audioId,
        coverFileId: null,
        trackNumber: 0,
      });
    });

    setTracks((prev) => {
      const existingAudioIds = new Set((prev || []).map((t) => t.audioFileId));
      const dedupedIncoming = incomingTracks.filter((t) => !existingAudioIds.has(t.audioFileId));
      const combined = [...(prev || []), ...dedupedIncoming];
      return combined.map((t, idx) => ({ ...t, trackNumber: idx + 1 }));
    });

    // If no album cover chosen yet, choose the largest image in the incoming selection.
    if (!albumCoverFileId) {
      const coverCandidate = Array.from(fileList || [])
        .filter((f) => fileKind(f) === 'image')
        .sort((a, b) => (b.size || 0) - (a.size || 0))[0];
      if (coverCandidate) {
        const fp = fingerprintOfFile(coverCandidate);
        const match = nextFiles.find((x) => x.kind === 'image' && fingerprintOfMeta(x) === fp);
        if (match?.id) setAlbumCoverFileId(match.id);
      }
    }
  };

  const handlePickFiles = async (event) => {
    const list = event.target.files;
    if (!list || list.length === 0) {
      toast({ title: 'No files selected', description: 'Select audio and artwork files to begin.' });
      return;
    }
    setSelectionFromFileList(list);
    // Allow selecting the same files again later.
    try {
      event.target.value = '';
    } catch {
      // ignore
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const list = event.dataTransfer?.files;
    if (!list || list.length === 0) return;
    setSelectionFromFileList(list);
  };

  const handlePickTrackAudio = (event) => {
    const list = event.target.files;
    const trackId = pendingTrackAudioIdRef.current;
    pendingTrackAudioIdRef.current = null;
    const file = list?.[0];

    if (!trackId || !file) return;
    if (fileKind(file) !== 'audio') {
      toast({ title: 'Invalid file', description: 'Select an audio file (mp3/m4a/wav/flac).', variant: 'destructive' });
      return;
    }

    setDraftBatchId((prev) => prev || makeBatchId(albumTitle));

    setFiles((prev) => {
      const next = [...(prev || [])];
      const track = tracks.find((t) => t.id === trackId);
      const targetFileId = track?.audioFileId || null;
      const idx = targetFileId ? next.findIndex((f) => f.id === targetFileId) : -1;
      if (idx >= 0) {
        const existing = next[idx];
        next[idx] = {
          ...existing,
          file,
          name: file.name,
          kind: 'audio',
          size: file.size ?? existing.size ?? null,
          lastModified: file.lastModified ?? existing.lastModified ?? null,
          status: existing.publicUrl ? 'uploaded' : 'pending',
          error: null,
        };
        return next;
      }

      const id = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
      next.push({
        id,
        file,
        name: file.name,
        kind: 'audio',
        status: 'pending',
        error: null,
        publicUrl: null,
        bucket: null,
        storageKey: null,
        size: file.size ?? null,
        lastModified: file.lastModified ?? null,
      });

      setTracks((prevTracks) => prevTracks.map((t) => (t.id === trackId ? { ...t, audioFileId: id } : t)));
      return next;
    });

    try {
      event.target.value = '';
    } catch {
      // ignore
    }
  };

  const missingFilesWarning = useMemo(() => {
    const metaOnly = files.some((f) => !f.file && (f.publicUrl || f.storageKey || f.name));
    if (!metaOnly) return null;
    return 'Draft restored. For any file that is not attached, use Select Files again (Safari cannot persist file handles after reload).';
  }, [files]);

  const handleClearDraft = () => {
    clearDraft();
    setFiles([]);
    setTracks([]);
    setAlbumTitle('');
    setAlbumCoverFileId(null);
    setDraftBatchId(null);
    toast({ title: 'Draft cleared' });
  };

  const ensureAuth = () => {
    if (!user?.id) {
      toast({ title: 'Login required', description: 'Sign in to use bulk upload.', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const validateStaging = () => {
    if (mode === 'album' && !albumTitle.trim()) return { ok: false, error: 'Album title is required.' };
    if (tracks.length === 0) return { ok: false, error: 'No tracks detected. Select audio files (mp3/m4a/wav/flac).' };
    if (supportedAudioCount === 0) return { ok: false, error: 'No supported audio files selected.' };
    if (!dbReady) return { ok: false, error: 'Database migrations missing for bulk upload. Run `supabase db push` and refresh the page.' };
    const missingAudioTracks = tracks.filter((t) => {
      const f = files.find((x) => x.id === t.audioFileId);
      const hasPersistedUpload = !!(f?.bucket && f?.storageKey);
      return !f?.file && !f?.publicUrl && !hasPersistedUpload;
    });
    if (missingAudioTracks.length > 0) {
      const preview = missingAudioTracks
        .slice(0, 5)
        .map((t) => t.title || 'Untitled')
        .join(', ');
      const suffix = missingAudioTracks.length > 5 ? '…' : '';
      return {
        ok: false,
        error: `Some tracks are missing attached audio files. Re-select the missing audio files. Missing: ${preview}${suffix}`,
      };
    }
    if (!canProceedWithPolicy.ok) {
      if (canProceedWithPolicy.reason === 'subscription_required') {
        return { ok: false, error: 'Your upload policy requires an active subscription (Unlimited). Activate it in Monetization first.' };
      }
      if (canProceedWithPolicy.reason === 'credits_required') {
        return { ok: false, error: 'Your upload policy is Pay Per Upload, but you have no upload credits.' };
      }
    }
    return { ok: true };
  };

	  const uploadAll = async () => {
	    if (!ensureAuth()) return;
	    setLastError(null);
    const staging = validateStaging();
    if (!staging.ok) {
      toast({ title: 'Cannot upload yet', description: staging.error, variant: 'destructive' });
      return;
    }

	    const creatorDisplayName = pickCreatorDisplayName(profile);
	    const batchId = resolvedBatchId || makeBatchId(albumTitle);
	    if (!resolvedBatchId) setDraftBatchId(batchId);

	    const policyToWrite = selectedPolicyMode === 'fixed' ? fixedPolicy : null;

    setStep('uploading');
    setBusy(true);

    try {
      if (unsupportedCount > 0) {
        toast({
          title: 'Ignoring unsupported files',
          description: `${unsupportedCount} file(s) will be ignored (not audio/image).`,
        });
      }

      // Upload files first.
      const nextFiles = [...files];

      const getFileById = (id) => nextFiles.find((f) => f.id === id);
      const setFileState = (id, patch) => {
        const idx = nextFiles.findIndex((f) => f.id === id);
        if (idx < 0) return;
        nextFiles[idx] = { ...nextFiles[idx], ...patch };
        setFiles([...nextFiles]);
      };

      for (const f of nextFiles) {
        if (!f.file) continue;
        if (f.kind === 'other') continue;
        if (f.status === 'uploaded' && f.publicUrl) continue;

	        setFileState(f.id, { status: 'uploading', error: null });
	        const bucket = f.kind === 'audio' ? 'track-audio' : mode === 'album' && f.id === albumCoverFileId ? 'album-covers' : 'track-cover';
	        const keyKind = f.kind === 'audio' ? 'audio' : mode === 'album' && f.id === albumCoverFileId ? 'album_cover' : 'track_cover';
	        const storageKey = f.storageKey || buildStorageKey({ userId: user.id, batchId, kind: keyKind, fileName: f.file.name });

	        try {
	          const publicUrl = await uploadToBucket({ bucket, objectPath: storageKey, file: f.file });
	          setFileState(f.id, { status: 'uploaded', publicUrl, bucket, storageKey });
	        } catch (err) {
	          const rawMessage = err?.message || String(err);
	          setFileState(f.id, { status: 'error', error: rawMessage });
	          if (/maximum allowed size/i.test(rawMessage) || /exceeded the maximum/i.test(rawMessage)) {
	            const sizeHint = f.file?.size ? ` File size: ${formatBytes(f.file.size)}.` : '';
	            throw new Error(
	              `File too large for bucket "${bucket}".${sizeHint} Increase the bucket file size limit in Supabase Dashboard → Storage → Buckets → ${bucket} → Settings, or upload a smaller/encoded file (mp3 recommended).`
	            );
	          }
	          throw err;
	        }
	      }

      // Best-effort restore public URLs from persisted storage keys (draft restore / older drafts).
      for (const f of nextFiles) {
        if (f.publicUrl) continue;
        if (!f.storageKey) continue;
        const inferredBucket =
          f.bucket ||
          (f.kind === 'audio'
            ? 'track-audio'
            : mode === 'album' && f.id === albumCoverFileId
              ? 'album-covers'
              : 'track-cover');
        const restored = publicUrlFor({ bucket: inferredBucket, storageKey: f.storageKey });
        if (restored) setFileState(f.id, { publicUrl: restored, bucket: inferredBucket });
      }

      // Create album if needed.
      let albumId = null;
      let albumCoverUrl = null;
	      if (mode === 'album') {
	        const coverMeta = getFileById(albumCoverFileId);
	        const coverBucket = coverMeta?.bucket || (coverMeta ? 'album-covers' : null);
	        albumCoverUrl = coverMeta?.publicUrl || publicUrlFor({ bucket: coverBucket, storageKey: coverMeta?.storageKey }) || null;
	        const importKey = batchId;

        const albumPayload = {
          uploader_id: user.id,
          title: albumTitle.trim(),
          creator_display_name: creatorDisplayName,
          cover_art_url: albumCoverUrl,
          is_public: DEFAULTS.is_public,
          upload_policy: policyToWrite,
          import_source: 'bulk_ui',
          import_key: importKey,
        };

        const { data: albumRow, error: albumError } = await supabase
          .from('albums')
          .upsert(albumPayload, { onConflict: 'uploader_id,import_source,import_key' })
          .select('id')
          .single();
        if (albumError) throw albumError;
        albumId = albumRow?.id || null;
      }

      // Create tracks.
	      for (const t of tracks) {
        const audioMeta = getFileById(t.audioFileId);
        const audioBucket = audioMeta?.bucket || 'track-audio';
        const audioUrl = audioMeta?.publicUrl || publicUrlFor({ bucket: audioBucket, storageKey: audioMeta?.storageKey });
        if (!audioUrl || !audioMeta?.storageKey) throw new Error(`Missing uploaded audio for track "${t.title}".`);
        const coverMeta = t.coverFileId ? getFileById(t.coverFileId) : null;
	        const coverBucket = coverMeta?.bucket || (coverMeta ? (mode === 'album' && coverMeta.id === albumCoverFileId ? 'album-covers' : 'track-cover') : null);
	        const coverPublic = coverMeta?.publicUrl || publicUrlFor({ bucket: coverBucket, storageKey: coverMeta?.storageKey });
	        const coverUrl = (usePerTrackCovers ? coverPublic : null) || (mode === 'album' ? albumCoverUrl : coverPublic) || null;
	        const importKey = `${batchId}:${t.trackNumber || 0}:${slugify(t.title)}`;

        const trackPayload = {
          uploader_id: user.id,
          title: t.title?.trim() || 'Untitled',
          creator_display_name: creatorDisplayName,
          audio_file_url: audioUrl,
          audio_storage_key: audioMeta.storageKey,
          cover_art_url: coverUrl,
          is_public: DEFAULTS.is_public,
          stream_cost: DEFAULTS.stream_cost,
          is_christian_nature: DEFAULTS.is_christian_nature,
          album_id: albumId,
          track_number_on_album: mode === 'album' ? t.trackNumber : null,
          upload_policy: policyToWrite,
          import_source: 'bulk_ui',
          import_key: importKey,
        };

        const { error: trackError } = await supabase
          .from('tracks')
          .upsert(trackPayload, { onConflict: 'uploader_id,import_source,import_key' });
        if (trackError) throw trackError;
      }

      await refreshUserProfile?.();
      setStep('done');
      toast({ title: 'Upload complete', description: `${tracks.length} track(s) imported successfully.`, className: 'bg-green-600 text-white' });
    } catch (err) {
      const message = err?.message || String(err);
      setLastError(message);
      toast({
        title: 'Bulk upload failed',
        description: message,
        variant: 'destructive',
      });
      setStep('staging');
    } finally {
      setBusy(false);
    }
  };

  const renderBrowserNote = () => {
    const policyLabel = getPolicyLabel(effectiveCreatorPolicy);
    const unlimited = unlimitedActive ? 'Unlimited active' : 'Unlimited inactive';
    const creditText = creditsLoading ? 'Loading credits...' : `Credits — Track: ${credits.track}, Album: ${credits.album}`;

    return (
      <div className="p-4 rounded-xl border border-white/10 bg-black/20 text-sm text-gray-200 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-white/10 text-white">Browser: {browser.name}</Badge>
          <Badge className="bg-yellow-500/20 text-yellow-200">Policy: {policyLabel}</Badge>
          <Badge className="bg-white/10 text-gray-200">{unlimited}</Badge>
        </div>
        <p className="text-gray-300">
          Safari/iCloud tip: selecting an offloaded file may work but can be slow. For best results, use “Download Now” on the album folder first,
          upload, then “Remove Download” to reclaim space.
        </p>
        <p className="text-xs text-gray-400">
          Folder selection varies by browser. If you can’t pick a folder, open the album folder in Finder and select all files (audio + cover) instead.
        </p>
        <p className="text-xs text-gray-400">{creditText}</p>
      </div>
    );
  };

  const renderStaging = () => (
    <div className="space-y-4">
      {renderBrowserNote()}

      {missingFilesWarning ? (
        <div className="p-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 text-yellow-100 text-sm flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 mt-0.5" />
          <div>{missingFilesWarning}</div>
        </div>
      ) : null}

      {!dbReady ? (
        <div className="p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-100 text-sm flex items-start gap-2">
          <XCircle className="w-5 h-5 mt-0.5" />
          <div>
            <p className="font-semibold">Database not ready for bulk upload.</p>
            <p className="text-sm">Run `supabase db push` to apply the latest migrations, then refresh this page.</p>
          </div>
        </div>
      ) : null}

      {lastError ? (
        <div className="p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-100 text-sm flex items-start gap-2">
          <XCircle className="w-5 h-5 mt-0.5" />
          <div>
            <p className="font-semibold">Last error</p>
            <p className="text-sm break-words">{lastError}</p>
          </div>
        </div>
      ) : null}

      {!canProceedWithPolicy.ok ? (
        <div className="p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-100 text-sm flex items-start gap-2">
          <XCircle className="w-5 h-5 mt-0.5" />
          <div>
            {canProceedWithPolicy.reason === 'subscription_required'
              ? 'Your current policy requires Unlimited (subscription). Activate it in Monetization before uploading.'
              : 'Your current policy is Pay Per Upload but you have no credits.'}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-gray-200">Mode</Label>
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <Button
                type="button"
                size="sm"
                variant={mode === 'album' ? 'default' : 'outline'}
                className={mode === 'album' ? 'golden-gradient text-black' : 'border-white/10 text-gray-200'}
                onClick={() => setMode('album')}
              >
                Album
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === 'singles' ? 'default' : 'outline'}
                className={mode === 'singles' ? 'golden-gradient text-black' : 'border-white/10 text-gray-200'}
                onClick={() => setMode('singles')}
              >
                Singles
              </Button>
            </div>
          </div>

          {mode === 'album' ? (
            <div className="space-y-2">
              <Label className="text-gray-200">Album title</Label>
              <Input value={albumTitle} onChange={(e) => setAlbumTitle(e.target.value)} className="bg-black/30 border-white/10 text-white" />
              <div className="space-y-1">
                <Label className="text-xs text-gray-400">Album cover (optional)</Label>
                <select
                  value={albumCoverFileId || ''}
                  onChange={(e) => setAlbumCoverFileId(e.target.value || null)}
                  className="w-full h-10 rounded-md bg-black/30 border border-white/10 text-white px-2"
                >
                  <option value="">(none)</option>
                  {files
                    .filter((f) => f.kind === 'image')
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name || f.file?.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-gray-400">Use per-track covers</div>
                <Switch checked={usePerTrackCovers} onCheckedChange={(v) => setUsePerTrackCovers(!!v)} />
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-300">Singles will be created without an album. Each track can have its own cover.</div>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-gray-200">Upload Policy</Label>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-gray-300">Inherit from profile</div>
            <Switch checked={selectedPolicyMode === 'fixed'} onCheckedChange={(v) => setSelectedPolicyMode(v ? 'fixed' : 'inherit')} />
          </div>
          {selectedPolicyMode === 'fixed' ? (
            <div className="flex items-center gap-2 text-xs">
              {['free', 'pay_per_upload', 'subscription'].map((p) => (
                <Button
                  key={p}
                  type="button"
                  size="sm"
                  variant={fixedPolicy === p ? 'default' : 'outline'}
                  className={fixedPolicy === p ? 'golden-gradient text-black' : 'border-white/10 text-gray-200'}
                  onClick={() => setFixedPolicy(p)}
                >
                  {getPolicyLabel(p)}
                </Button>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-500">Leaves upload_policy NULL so content follows your current creator policy.</div>
          )}
        </div>
      </div>

      <div
        className="rounded-xl border border-dashed border-white/20 bg-black/10 p-6 text-center space-y-2"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="flex items-center justify-center gap-2 text-yellow-200 font-semibold">
          <FolderUp className="w-5 h-5" /> Drop files here
        </div>
        <div className="text-sm text-gray-300">Or select files (audio + artwork). Safari works best with file selection.</div>
	        <div className="flex items-center justify-center gap-2">
	          <input
	            ref={inputRef}
	            type="file"
	            multiple
	            accept={SUPPORTED_AUDIO.map((x) => `.${x}`).concat(SUPPORTED_IMAGES.map((x) => `.${x}`)).join(',')}
	            className="hidden"
	            onChange={handlePickFiles}
	          />
	          <input
	            ref={trackAudioInputRef}
	            type="file"
	            multiple={false}
	            accept={SUPPORTED_AUDIO.map((x) => `.${x}`).join(',')}
	            className="hidden"
	            onChange={handlePickTrackAudio}
	          />
	          <Button type="button" className="golden-gradient text-black font-semibold" onClick={() => inputRef.current?.click()}>
	            <Upload className="w-4 h-4 mr-2" />
	            Select Files
	          </Button>
          <Button type="button" variant="outline" className="border-white/10 text-gray-200" onClick={handleClearDraft}>
            Clear Draft
          </Button>
        </div>
        <div className="text-xs text-gray-500">
          Supported audio: {SUPPORTED_AUDIO.join(', ')} · images: {SUPPORTED_IMAGES.join(', ')}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-gray-400">Audio files</div>
          <div className="text-xl font-semibold text-white">{supportedAudioCount}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-gray-400">Images</div>
          <div className="text-xl font-semibold text-white">{supportedImageCount}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-gray-400">Unsupported</div>
          <div className="text-xl font-semibold text-white">{unsupportedCount}</div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-2">
        <div className="text-sm text-white font-semibold">Files</div>
        <div className="space-y-2 max-h-[22vh] overflow-y-auto pr-1">
          {files.length === 0 ? (
            <div className="text-sm text-gray-500">No files selected yet.</div>
	          ) : (
	            files.map((f) => {
	              const missingAttachment = f.kind !== 'other' && !f.file && !f.publicUrl && !(f.bucket && f.storageKey);
	              return (
	                <div key={f.id} className="p-3 rounded-lg border border-white/10 bg-white/5 flex items-center justify-between gap-3">
                  <div className="min-w-[220px]">
                    <div className="text-sm text-white font-semibold">{f.name || f.file?.name}</div>
                    <div className="text-xs text-gray-500">
                      {f.kind}
                      {missingAttachment ? ' · missing attachment' : null}
                      {f.publicUrl ? ' · uploaded' : null}
                    </div>
                  </div>
                  <div className="text-xs text-gray-300">
                    {f.status === 'uploaded' ? (
                      <span className="text-green-300 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> Uploaded
                      </span>
                    ) : f.status === 'error' ? (
                      <span className="text-red-300 flex items-center gap-1">
                        <XCircle className="w-4 h-4" /> {f.error || 'Error'}
                      </span>
                    ) : (
                      <span className="text-gray-300">{f.status}</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {supportedAudioCount === 0 && (supportedImageCount > 0 || unsupportedCount > 0) ? (
        <div className="p-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 text-yellow-100 text-sm flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 mt-0.5" />
          <div>No supported audio files detected in your selection. If you picked an empty folder, Safari only returns selected files (folders aren’t uploaded).</div>
        </div>
      ) : null}

      {tracks.length > 0 ? (
        <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Music className="w-5 h-5 text-yellow-300" />
              Tracks ({tracks.length})
            </div>
            <Button type="button" variant="outline" className="border-white/10 text-gray-200" onClick={() => setTracks((prev) => prev.map((t, idx) => ({ ...t, trackNumber: idx + 1 })))}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Re-number
            </Button>
          </div>

	          <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
	            {tracks.map((t) => {
	              const audioMeta = files.find((f) => f.id === t.audioFileId);
	              const audioName = audioMeta?.name || audioMeta?.file?.name || '(unknown audio)';
	              const audioMissing = !audioMeta?.file && !audioMeta?.publicUrl && !(audioMeta?.bucket && audioMeta?.storageKey);
	              return (
	              <div key={t.id} className="p-3 rounded-lg border border-white/10 bg-white/5 grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
		                <div className="md:col-span-12 text-xs text-gray-400 flex items-center justify-between gap-2">
		                  <span className="truncate">Audio: {audioName}</span>
			                  <div className="flex items-center gap-2">
			                    {audioMissing ? (
			                      <Button
			                        type="button"
			                        size="sm"
			                        variant="outline"
			                        className="border-white/10 text-gray-200 h-7 px-2"
			                        onClick={() => {
			                          pendingTrackAudioIdRef.current = t.id;
			                          trackAudioInputRef.current?.click();
			                        }}
			                      >
			                        Attach audio
			                      </Button>
			                    ) : null}
			                    <Button
			                      type="button"
			                      size="sm"
			                      variant="outline"
			                      className="border-red-500/30 text-red-200 hover:bg-red-500/10 h-7 px-2"
			                      onClick={() => removeTrackById(t.id)}
			                    >
			                      Remove
			                    </Button>
			                    {audioMissing ? <span className="text-red-300">missing attachment</span> : <span className="text-green-300">attached</span>}
			                  </div>
			                </div>
	                <div className="md:col-span-2">
	                  <Label className="text-xs text-gray-400">#</Label>
	                  <Input
	                    type="number"
                    min="1"
                    value={t.trackNumber || ''}
                    onChange={(e) =>
                      setTracks((prev) =>
                        prev.map((x) => (x.id === t.id ? { ...x, trackNumber: Number(e.target.value) || 1 } : x))
                      )
                    }
                    className="bg-black/30 border-white/10 text-white"
                  />
                </div>
                <div className="md:col-span-7">
                  <Label className="text-xs text-gray-400">Title</Label>
                  <Input
                    value={t.title}
                    onChange={(e) => setTracks((prev) => prev.map((x) => (x.id === t.id ? { ...x, title: e.target.value } : x)))}
                    className="bg-black/30 border-white/10 text-white"
                  />
                </div>
                <div className="md:col-span-3">
                  <Label className="text-xs text-gray-400">Cover (optional)</Label>
                  <select
                    value={t.coverFileId || ''}
                    onChange={(e) =>
                      setTracks((prev) => prev.map((x) => (x.id === t.id ? { ...x, coverFileId: e.target.value || null } : x)))
                    }
                    className="w-full h-10 rounded-md bg-black/30 border border-white/10 text-white px-2"
                  >
                    <option value="">(none)</option>
                    {files
                      .filter((f) => f.kind === 'image')
                      .map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name || f.file?.name}
                        </option>
                      ))}
	                  </select>
	                </div>
	              </div>
	              );
	            })}
	          </div>
	        </div>
	      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" className="border-white/10 text-gray-200" onClick={() => onOpenChange(false)}>
          Close
        </Button>
        <Button type="button" className="golden-gradient text-black font-semibold" onClick={uploadAll} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Cloud className="w-4 h-4 mr-2" />}
          Upload & Create
        </Button>
      </div>
    </div>
  );

  const renderUploading = () => {
    const done = files.filter((f) => f.kind !== 'other' && f.status === 'uploaded').length;
    const total = files.filter((f) => f.kind !== 'other').length;
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-xl border border-white/10 bg-black/20 text-white">
          <div className="flex items-center gap-2 font-semibold">
            <Loader2 className="w-5 h-5 animate-spin text-yellow-300" />
            Uploading…
          </div>
          <div className="text-sm text-gray-300 mt-1">
            Progress: {done}/{total} files uploaded. Keep this tab open.
          </div>
        </div>
        <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
          {files
            .filter((f) => f.kind !== 'other')
            .map((f) => (
              <div key={f.id} className="p-3 rounded-lg border border-white/10 bg-white/5 flex items-center justify-between gap-3">
                <div className="min-w-[220px]">
                  <div className="text-sm text-white font-semibold">{f.name || f.file?.name}</div>
                  <div className="text-xs text-gray-500">{f.bucket ? `${f.bucket} · ${f.storageKey || ''}` : f.kind}</div>
                </div>
                <div className="text-sm">
                  {f.status === 'uploaded' ? (
                    <span className="text-green-300 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Uploaded
                    </span>
                  ) : f.status === 'error' ? (
                    <span className="text-red-300 flex items-center gap-1">
                      <XCircle className="w-4 h-4" /> {f.error || 'Error'}
                    </span>
                  ) : (
                    <span className="text-gray-300 flex items-center gap-1">
                      <Loader2 className="w-4 h-4 animate-spin" /> {f.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
    );
  };

  const renderDone = () => (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/10 text-green-100 flex items-start gap-2">
        <CheckCircle className="w-5 h-5 mt-0.5" />
        <div>
          <div className="font-semibold">Imported successfully</div>
          <div className="text-sm text-green-200">
            Created {tracks.length} track(s) {mode === 'album' ? `under "${albumTitle}"` : 'as singles'}.
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="border-white/10 text-gray-200"
          onClick={() => {
            clearDraft();
            onOpenChange(false);
          }}
        >
          Close
        </Button>
      </div>
    </div>
  );

	  return (
	    <Dialog open={open} onOpenChange={onOpenChange}>
	      <DialogContent className="sm:max-w-4xl glass-effect-light text-white font-montserrat max-h-[90vh] overflow-y-auto border-yellow-500/30">
	        <DialogHeader className="space-y-2">
	          <DialogTitle className="golden-text text-2xl flex items-center gap-2">
	            <FolderUp className="w-6 h-6 text-yellow-300" />
	            Bulk Upload Workspace
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            Upload albums or singles in batches, with review before saving to your library. Works best when files are already downloaded locally.
          </DialogDescription>
        </DialogHeader>

        {step === 'staging' ? renderStaging() : null}
        {step === 'uploading' ? renderUploading() : null}
        {step === 'done' ? renderDone() : null}
      </DialogContent>
    </Dialog>
  );
};

export default CreatorBulkUploadWorkspace;
