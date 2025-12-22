import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlayer } from '@/contexts/PlayerContext';

function DuGamePage() {
  const duGameIframeUrl = import.meta.env.VITE_DU_TCG_PR_IFRAME_URL || '/du-game/';
  const playerOffset = 'var(--crfm-player-offset, 120px)';
  const { playbackMode, setGameMusicMode } = usePlayer();
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem('du_music_prompted');
      if (!seen) setShowPrompt(true);
    } catch {
      setShowPrompt(true);
    }
  }, []);

  const handleChoice = async (mode) => {
    await setGameMusicMode?.(mode);
    setShowPrompt(false);
    try {
      localStorage.setItem('du_music_prompted', '1');
    } catch {
      // ignore storage errors
    }
  };

  return (
    <div className="fixed inset-0 z-0 bg-black flex flex-col" style={{ paddingBottom: playerOffset }}>
      {showPrompt && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="max-w-lg w-[92%] bg-black/80 border border-yellow-400/30 rounded-2xl p-6 text-white shadow-2xl">
            <div className="text-xl font-semibold text-yellow-300 mb-2">Musica del juego o tu playlist?</div>
            <p className="text-sm text-gray-300 mb-4">
              Recomendado: musica del juego para mayor inmersion. Puedes cambiarlo en el reproductor cuando quieras.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                className="px-4 py-2 rounded-full bg-yellow-400 text-black font-semibold hover:bg-yellow-300 transition"
                onClick={() => handleChoice('game')}
              >
                Usar musica del juego
              </button>
              <button
                className="px-4 py-2 rounded-full bg-white/10 text-white border border-white/10 hover:bg-white/20 transition"
                onClick={() => handleChoice('crfm')}
              >
                Mantener mi musica de CRFM
              </button>
            </div>
            <div className="text-xs text-gray-400 mt-3">
              Modo actual: {playbackMode === 'game' ? 'Juego' : 'CRFM'}
            </div>
          </div>
        </div>
      )}
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
      <div id="player-dock-sentinel" className="h-px w-full" aria-hidden="true" />
    </div>
  );
}

export default DuGamePage;
