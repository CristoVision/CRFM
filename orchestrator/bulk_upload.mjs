import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';
import YAML from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const [key, inlineValue] = token.slice(2).split('=');
    if (inlineValue != null) {
      args[key] = inlineValue;
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i++;
      continue;
    }
    args[key] = true;
  }
  return args;
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readManifest(filePath) {
  const raw = readText(filePath);
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') return JSON.parse(raw);
  return YAML.parse(raw);
}

function assertFileExists(localPath) {
  if (!localPath) throw new Error('Missing file path.');
  const stat = fs.statSync(localPath);
  if (!stat.isFile()) throw new Error(`Not a file: ${localPath}`);
  if (stat.size === 0) throw new Error(`Empty file: ${localPath}`);
}

function guessContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.mp3') return 'audio/mpeg';
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.m4a') return 'audio/mp4';
  if (ext === '.flac') return 'audio/flac';
  if (ext === '.aac') return 'audio/aac';
  if (ext === '.ogg') return 'audio/ogg';
  return 'application/octet-stream';
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function pickCreatorDisplayName(profile) {
  return profile?.display_name || profile?.username || profile?.full_name || null;
}

async function uploadFile({ supabase, bucket, objectPath, localPath }) {
  assertFileExists(localPath);
  const bytes = fs.readFileSync(localPath);
  const contentType = guessContentType(localPath);

  const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, bytes, {
    contentType,
    upsert: true,
  });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  if (!data?.publicUrl) throw new Error(`Missing public URL for ${bucket}/${objectPath}`);
  return data.publicUrl;
}

async function upsertAlbum({ supabase, uploaderId, creatorDisplayName, album, coverUrl, defaults }) {
  const importSource = defaults.import_source || 'bulk_upload';
  const importKey = album.import_key || album.key || slugify(album.title);
  const payload = {
    uploader_id: uploaderId,
    title: album.title,
    creator_display_name: album.creator_display_name || creatorDisplayName,
    cover_art_url: coverUrl || null,
    genre: album.genre ?? defaults.genre ?? null,
    release_date: album.release_date ?? defaults.release_date ?? null,
    languages: album.languages ?? defaults.languages ?? null,
    is_public: album.is_public ?? defaults.is_public ?? false,
    upload_policy: album.upload_policy ?? defaults.upload_policy ?? null,
    import_source: importSource,
    import_key: importKey,
  };

  const { data, error } = await supabase
    .from('albums')
    .upsert(payload, { onConflict: 'uploader_id,import_source,import_key' })
    .select('id, title')
    .single();
  if (error) throw error;
  return data;
}

async function upsertTrack({ supabase, uploaderId, creatorDisplayName, track, audioUrl, audioStorageKey, coverUrl, albumId, defaults }) {
  const importSource = defaults.import_source || 'bulk_upload';
  const importKey = track.import_key || track.key || slugify(`${track.title}-${track.audio}`);

  const payload = {
    uploader_id: uploaderId,
    title: track.title,
    creator_display_name: track.creator_display_name || creatorDisplayName,
    audio_file_url: audioUrl,
    audio_storage_key: audioStorageKey,
    cover_art_url: coverUrl || null,
    album_id: albumId || null,
    track_number_on_album: track.track_number_on_album ?? track.track_number ?? null,
    genre: track.genre ?? defaults.genre ?? null,
    release_date: track.release_date ?? defaults.release_date ?? null,
    languages: track.languages ?? defaults.languages ?? null,
    language: track.language ?? null,
    is_public: track.is_public ?? defaults.is_public ?? false,
    stream_cost: track.stream_cost ?? defaults.stream_cost ?? undefined,
    is_christian_nature: track.is_christian_nature ?? defaults.is_christian_nature ?? false,
    is_instrumental: track.is_instrumental ?? defaults.is_instrumental ?? false,
    ai_in_production: track.ai_in_production ?? defaults.ai_in_production ?? false,
    ai_in_artwork: track.ai_in_artwork ?? defaults.ai_in_artwork ?? false,
    ai_in_lyrics: track.ai_in_lyrics ?? defaults.ai_in_lyrics ?? false,
    lyrics_text: track.lyrics_text ?? null,
    upload_policy: track.upload_policy ?? defaults.upload_policy ?? null,
    import_source: importSource,
    import_key: importKey,
  };

  // Remove undefined so Supabase doesn't complain on numeric fields when omitted.
  Object.keys(payload).forEach((k) => (payload[k] === undefined ? delete payload[k] : null));

  const { data, error } = await supabase
    .from('tracks')
    .upsert(payload, { onConflict: 'uploader_id,import_source,import_key' })
    .select('id, title')
    .single();
  if (error) throw error;
  return data;
}

async function main() {
  const args = parseArgs(process.argv);
  const manifestPath = args.manifest || args.m;
  if (!manifestPath) {
    console.error('Usage: node orchestrator/bulk_upload.mjs --manifest bulk/manifest.yml');
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const authEmail = process.env.BULK_AUTH_EMAIL;
  const authPassword = process.env.BULK_AUTH_PASSWORD;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY in env.');
  }
  if (!authEmail || !authPassword) {
    throw new Error('Missing BULK_AUTH_EMAIL and BULK_AUTH_PASSWORD in env (required to respect RLS/upload policies).');
  }

  const manifest = readManifest(manifestPath);
  const defaults = manifest.defaults || {};
  const dryRun = !!args['dry-run'];

  const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: authEmail,
    password: authPassword,
  });
  if (signInError) throw signInError;
  const uploaderId = signInData?.user?.id;
  if (!uploaderId) throw new Error('Unable to resolve authenticated user id.');

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, full_name, display_name, creator_upload_policy, stripe_subscription_status, creator_unlimited_expires_at')
    .eq('id', uploaderId)
    .single();
  if (profileError) throw profileError;

  const creatorDisplayName = manifest.creator_display_name || pickCreatorDisplayName(profileRow) || 'Creator';
  const rootDir = manifest.root_dir ? path.resolve(path.dirname(manifestPath), manifest.root_dir) : path.dirname(manifestPath);

  const report = {
    uploader_id: uploaderId,
    creator_display_name: creatorDisplayName,
    root_dir: rootDir,
    dry_run: dryRun,
    albums: [],
    singles: [],
    warnings: [],
  };

  if (dryRun) {
    console.log('[dry-run] authenticated as', uploaderId);
    console.log('[dry-run] root_dir', rootDir);
  }

  const albums = Array.isArray(manifest.albums) ? manifest.albums : [];
  for (const album of albums) {
    if (!album?.title) throw new Error('Album missing title.');
    if (!Array.isArray(album.tracks) || album.tracks.length === 0) {
      throw new Error(`Album "${album.title}" has no tracks.`);
    }

    const albumKey = album.import_key || album.key || slugify(album.title);
    const albumCoverLocal = album.cover_art ? path.resolve(rootDir, album.cover_art) : null;
    const albumCoverPath = albumCoverLocal ? `${uploaderId}/albums/${albumKey}/${path.basename(albumCoverLocal)}` : null;

    if (albumCoverLocal) assertFileExists(albumCoverLocal);

    let albumCoverUrl = null;
    if (!dryRun && albumCoverLocal && albumCoverPath) {
      albumCoverUrl = await uploadFile({
        supabase,
        bucket: 'album-covers',
        objectPath: albumCoverPath,
        localPath: albumCoverLocal,
      });
    }

    const albumRow = dryRun
      ? { id: '[dry-run]', title: album.title }
      : await upsertAlbum({ supabase, uploaderId, creatorDisplayName, album, coverUrl: albumCoverUrl, defaults });

    const albumResult = { album: albumRow, cover_url: albumCoverUrl, tracks: [] };

    for (const track of album.tracks) {
      if (!track?.title) throw new Error(`Track in album "${album.title}" missing title.`);
      if (!track?.audio) throw new Error(`Track "${track.title}" in album "${album.title}" missing audio path.`);

      const trackKey = track.import_key || track.key || slugify(track.title);
      const audioLocal = path.resolve(rootDir, track.audio);
      const audioStorageKey = `${uploaderId}/tracks/${albumKey}/${trackKey}/${path.basename(audioLocal)}`;
      assertFileExists(audioLocal);

      const coverLocal = track.cover_art ? path.resolve(rootDir, track.cover_art) : null;
      const coverStorageKey = coverLocal ? `${uploaderId}/track-covers/${albumKey}/${trackKey}/${path.basename(coverLocal)}` : null;
      if (coverLocal) assertFileExists(coverLocal);

      let audioUrl = null;
      let coverUrl = albumCoverUrl || null;

      if (!dryRun) {
        audioUrl = await uploadFile({
          supabase,
          bucket: 'track-audio',
          objectPath: audioStorageKey,
          localPath: audioLocal,
        });
        if (coverLocal && coverStorageKey) {
          coverUrl = await uploadFile({
            supabase,
            bucket: 'track-cover',
            objectPath: coverStorageKey,
            localPath: coverLocal,
          });
        }
      }

      const trackRow = dryRun
        ? { id: '[dry-run]', title: track.title }
        : await upsertTrack({
            supabase,
            uploaderId,
            creatorDisplayName,
            track,
            audioUrl,
            audioStorageKey,
            coverUrl,
            albumId: albumRow.id,
            defaults,
          });

      albumResult.tracks.push({ track: trackRow, audio_url: audioUrl, cover_url: coverUrl, audio_storage_key: audioStorageKey });
    }

    report.albums.push(albumResult);
    console.log(`Imported album: ${album.title} (${albumResult.tracks.length} tracks)`);
  }

  const singles = Array.isArray(manifest.singles) ? manifest.singles : [];
  for (const track of singles) {
    if (!track?.title) throw new Error('Single track missing title.');
    if (!track?.audio) throw new Error(`Single "${track.title}" missing audio path.`);

    const trackKey = track.import_key || track.key || slugify(track.title);
    const audioLocal = path.resolve(rootDir, track.audio);
    const audioStorageKey = `${uploaderId}/tracks/singles/${trackKey}/${path.basename(audioLocal)}`;
    assertFileExists(audioLocal);

    const coverLocal = track.cover_art ? path.resolve(rootDir, track.cover_art) : null;
    const coverStorageKey = coverLocal ? `${uploaderId}/track-covers/singles/${trackKey}/${path.basename(coverLocal)}` : null;
    if (coverLocal) assertFileExists(coverLocal);

    let audioUrl = null;
    let coverUrl = null;

    if (!dryRun) {
      audioUrl = await uploadFile({
        supabase,
        bucket: 'track-audio',
        objectPath: audioStorageKey,
        localPath: audioLocal,
      });
      if (coverLocal && coverStorageKey) {
        coverUrl = await uploadFile({
          supabase,
          bucket: 'track-cover',
          objectPath: coverStorageKey,
          localPath: coverLocal,
        });
      }
    }

    const trackRow = dryRun
      ? { id: '[dry-run]', title: track.title }
      : await upsertTrack({
          supabase,
          uploaderId,
          creatorDisplayName,
          track,
          audioUrl,
          audioStorageKey,
          coverUrl,
          albumId: null,
          defaults,
        });

    report.singles.push({ track: trackRow, audio_url: audioUrl, cover_url: coverUrl, audio_storage_key: audioStorageKey });
    console.log(`Imported single: ${track.title}`);
  }

  const outFile = args.out || path.resolve(__dirname, 'bulk_upload_report.json');
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(`Done. Report written to ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

