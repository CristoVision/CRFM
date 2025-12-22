import React from 'react';
import { Link } from 'react-router-dom';

function DuGamePage() {
  const duGameIframeUrl = import.meta.env.VITE_DU_TCG_PR_IFRAME_URL || '/du-game/';

  return (
    <div className="fixed inset-0 z-0 bg-black">
      <div className="absolute top-4 left-4 z-50 flex items-center gap-3">
        <Link
          to="/"
          className="px-4 py-2 rounded-full bg-black/70 text-white text-sm font-semibold border border-white/10 shadow-lg hover:bg-black/90 transition"
        >
          ← Volver a CRFM
        </Link>
        <a
          href={duGameIframeUrl}
          target="_blank"
          rel="noreferrer"
          className="px-3 py-2 rounded-full bg-white/10 text-white text-xs font-semibold border border-white/10 hover:bg-white/20 transition"
        >
          Abrir en nueva pestaña
        </a>
      </div>
      <iframe
        title="DU TCG PR"
        src={duGameIframeUrl}
        className="absolute top-0 left-0 w-full border-0"
        style={{ height: 'calc(100% - var(--crfm-player-offset, 120px))' }}
        allow="fullscreen; clipboard-read; clipboard-write"
      />
      <div className="absolute inset-x-0 bottom-0 h-[120px] pointer-events-none" />
    </div>
  );
}

export default DuGamePage;
