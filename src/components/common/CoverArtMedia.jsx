import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

const detectCarMode = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android Auto|Automotive OS|CarPlay/i.test(ua);
};

const CoverArtMedia = ({
  videoUrl,
  imageUrl,
  className = '',
  objectFitClass = 'object-cover',
  roundedClass = 'rounded-2xl',
  showBadge = false,
}) => {
  const [useVideo, setUseVideo] = useState(false);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const normalizedVideoUrl = useMemo(() => {
    if (!videoUrl) return null;
    if (videoUrl.startsWith('http') || videoUrl.startsWith('data:') || videoUrl.startsWith('blob:')) return videoUrl;
    if (!supabaseUrl) return null;
    const cleaned = videoUrl.replace(/^\/+/, '');
    if (cleaned.startsWith('storage/v1/')) {
      return `${supabaseUrl}/${cleaned}`;
    }
    const path = cleaned.includes('/') ? cleaned : `videocoverart/${cleaned}`;
    return `${supabaseUrl}/storage/v1/object/public/${path}`;
  }, [videoUrl, supabaseUrl]);

  useEffect(() => {
    if (!normalizedVideoUrl) {
      setUseVideo(false);
      return;
    }
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
    const blockVideo = detectCarMode();
    setUseVideo(!prefersReducedMotion && !blockVideo);
  }, [normalizedVideoUrl]);

  const handleVideoError = () => setUseVideo(false);

  if (useVideo && normalizedVideoUrl) {
    return (
      <div className={cn('relative overflow-hidden bg-black', roundedClass, className)}>
        <video
          key={normalizedVideoUrl}
          src={normalizedVideoUrl}
          poster={imageUrl || undefined}
          className={cn('w-full h-full', objectFitClass)}
          loop
          muted
          playsInline
          autoPlay
          onError={handleVideoError}
        />
        {showBadge && (
          <span className="absolute bottom-2 right-2 text-[11px] px-2 py-1 bg-black/60 text-yellow-200 rounded-full border border-yellow-500/40">
            Video cover art
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt="Cover art"
      className={cn('w-full h-full', objectFitClass, roundedClass, className)}
    />
  );
};

export default CoverArtMedia;
