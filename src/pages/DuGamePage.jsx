import React from 'react';
import { Link } from 'react-router-dom';

function DuGamePage() {
  const duGameIframeUrl = import.meta.env.VITE_DU_TCG_PR_IFRAME_URL || '/du-game/';
  const playerOffset = 'var(--crfm-player-offset, 120px)';

  return (
    <div className="fixed inset-0 z-0 bg-black flex flex-col" style={{ paddingBottom: playerOffset }}>
      <div className="hidden md:flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/60 backdrop-blur-lg" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}>
        <div className="flex items-center gap-3">
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
      </div>
      <div className="flex-1 min-h-0 relative">
        <iframe
          title="DU TCG PR"
          src={duGameIframeUrl}
          className="absolute inset-0 w-full h-full border-0"
          allow="fullscreen; clipboard-read; clipboard-write"
        />
      </div>
      <div className="md:hidden flex items-center justify-between gap-3 px-4 py-3 border-t border-white/10 bg-black/70 backdrop-blur-lg" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}>
        <Link
          to="/"
          className="px-4 py-2 rounded-full bg-black/70 text-white text-sm font-semibold border border-white/10 shadow-lg hover:bg-black/90 transition flex-1 text-center"
        >
          ← Volver a CRFM
        </Link>
        <a
          href={duGameIframeUrl}
          target="_blank"
          rel="noreferrer"
          className="px-3 py-2 rounded-full bg-white/10 text-white text-xs font-semibold border border-white/10 hover:bg-white/20 transition"
        >
          Abrir
        </a>
      </div>
    </div>
  );
}

export default DuGamePage;
