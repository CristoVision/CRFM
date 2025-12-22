export const isLikelyVideoUrl = (value) =>
  typeof value === 'string' && /\.(mp4|webm|ogg|mov)$/i.test(value);

export const isUsableMediaUrl = (value) =>
  typeof value === 'string' &&
  (value.startsWith('http') || value.startsWith('data:') || value.startsWith('blob:') || value.includes('/'));

export const pickImageFallback = (candidates, fallback) => {
  const found = (candidates || []).find((url) => url && !isLikelyVideoUrl(url));
  return found || fallback;
};

export const pickVideoUrl = (candidate) => (isUsableMediaUrl(candidate) ? candidate : null);
