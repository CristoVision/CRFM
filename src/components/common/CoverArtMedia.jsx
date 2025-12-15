import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (!videoUrl) {
      setUseVideo(false);
      return;
    }
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
    const blockVideo = detectCarMode();
    setUseVideo(!prefersReducedMotion && !blockVideo);
  }, [videoUrl]);

  const handleVideoError = () => setUseVideo(false);

  if (useVideo && videoUrl) {
    return (
      <div className={cn('relative overflow-hidden bg-black', roundedClass, className)}>
        <video
          key={videoUrl}
          src={videoUrl}
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
