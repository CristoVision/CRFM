import { supabase } from '@/lib/supabaseClient';

const supabaseUrl = supabase?.supabaseUrl;

const storagePublicUrl = (bucket, path) => {
  if (!supabaseUrl) return null;
  const safeBucket = encodeURIComponent(bucket);
  const safePath = String(path || '')
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return `${supabaseUrl}/storage/v1/object/public/${safeBucket}/${safePath}`;
};

export const BRAND_LOGO_GIF_URL =
  storagePublicUrl('logo', 'crfm-logo-gold.gif') || '/favicon-32x32.png';

export const CROSSCOIN_ICON_URL =
  storagePublicUrl('logo', 'CrossCoin2025.png') || '/favicon-32x32.png';
