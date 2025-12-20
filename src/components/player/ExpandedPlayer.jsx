// MODULE: ExpandedPlayer
// PURPOSE: Vista completa del reproductor con arte, detalles, controles, volumen y tabs de Lyrics/Queue.
// EXPORTED: default
// DEPENDS: PlayerContext (usePlayer), shadcn/ui Tabs, lucide-react, subcomponentes Expanded*

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePlayer } from '@/contexts/PlayerContext';
import PlayerLyricsView from './PlayerLyricsView';
import QueuePanel from './QueuePanel';
import ExpandedPlayerHeader from './ExpandedPlayerHeader.jsx';
import ExpandedPlayerArtwork from './ExpandedPlayerArtwork.jsx';
import ExpandedPlayerTrackDetails from './ExpandedPlayerTrackDetails.jsx';
import ExpandedPlayerProgressBar from './ExpandedPlayerProgressBar.jsx';
import ExpandedPlayerControls from './ExpandedPlayerControls.jsx';
import ExpandedPlayerVolumeControl from './ExpandedPlayerVolumeControl.jsx';
import { ListMusic, ScrollText } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

function ExpandedPlayer() {
  const { currentTrack } = usePlayer();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('lyrics');

  if (!currentTrack) {
    return (
      <div className="fixed inset-0 player-background z-50 flex items-center justify-center">
        <p className="text-white text-xl">{t('player.expanded.noTrack')}</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 player-background z-50 flex flex-col font-montserrat">
      {/* SECTION: Header (close/minimize actions live here) */}
      <ExpandedPlayerHeader />

      {/* SECTION: Main layout (artwork + tabs) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Artwork + primary controls */}
        <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-6 md:p-8">
          <div className="max-w-md w-full">
            <ExpandedPlayerArtwork />
            <ExpandedPlayerTrackDetails />
            <ExpandedPlayerProgressBar />
            <ExpandedPlayerControls />
            <ExpandedPlayerVolumeControl />
          </div>
        </div>

        {/* Lyrics/Queue tabs */}
        <div className="w-full md:w-1/2 border-t md:border-t-0 md:border-l border-white/10 flex flex-col player-lyrics-panel-bg">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="bg-transparent border-b border-white/10 rounded-none p-0 h-auto grid grid-cols-2">
              <TabsTrigger value="lyrics" className="player-tab-trigger">
                <ScrollText className="w-4 h-4 mr-2" /> {t('player.tabs.lyrics')}
              </TabsTrigger>
              <TabsTrigger value="queue" className="player-tab-trigger">
                <ListMusic className="w-4 h-4 mr-2" /> {t('player.tabs.queue')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="lyrics" className="flex-1 min-h-0 overflow-hidden">
              <PlayerLyricsView />
            </TabsContent>
            <TabsContent value="queue" className="flex-1 min-h-0 overflow-hidden">
              <QueuePanel />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

export default ExpandedPlayer;
