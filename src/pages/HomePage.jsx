import React, { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import TracksTab from '@/components/dashboard/TracksTab';
import AlbumsTab from '@/components/dashboard/AlbumsTab';
import PlaylistsTab from '@/components/dashboard/PlaylistsTab';
import CreatorsTab from '@/components/dashboard/CreatorsTab';
import MusicVideosTab from '@/components/dashboard/MusicVideosTab';
import RadioStationsTab from '@/components/dashboard/RadioStationsTab';
import { Search, Music, Disc, ListMusic, Users, LayoutGrid, List, Film, Radio } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [timeRange, setTimeRange] = useState('all'); // all, daily, weekly, monthly, yearly
  const { user } = useAuth();
  const { t } = useLanguage();
  const duTcgUrl = import.meta.env.VITE_DU_TCG_PR_URL || '/games/du';
  const howSteps = useMemo(() => t('about.how.steps') || [], [t]);

  return (
    <div className="container mx-auto px-4 sm:px-6 py-8">
      {!user ? (
        <div className="glass-effect p-6 sm:p-8 rounded-2xl border border-white/10 mb-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">{t('home.heroTitle')}</h2>
              <p className="text-gray-300 text-base sm:text-lg">{t('home.heroBody')}</p>
              <div className="flex flex-wrap gap-3 mt-5">
                <Button asChild className="golden-gradient text-black font-semibold">
                  <a href="/">{t('home.heroCtaExplore')}</a>
                </Button>
                <Button asChild variant="outline" className="border-yellow-400/40 text-yellow-200 hover:text-yellow-100">
                  <a href="/about?tab=how">{t('home.heroCtaHow')}</a>
                </Button>
                <Button asChild variant="ghost" className="text-yellow-200 hover:text-yellow-100">
                  <a href="/?auth=login">{t('about.creators.ctaHub')}</a>
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:max-w-md">
              {howSteps.slice(0, 4).map((step) => (
                <div key={step.title} className="bg-black/30 border border-white/10 rounded-xl p-3">
                  <div className="text-sm text-yellow-300 font-semibold mb-1">{step.title}</div>
                  <div className="text-xs text-gray-300">{step.body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      <div className="text-center mb-12 mt-4 sm:mt-8">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">
          <span className="golden-text">CRFM</span> {t('home.titleSuffix')}
        </h1>
        <p className="text-lg sm:text-xl text-gray-300 mb-8">
          {t('home.subtitle')}
        </p>
        {duTcgUrl ? (
          <div className="flex justify-center mb-6">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-yellow-400/30 text-yellow-200 hover:text-yellow-100 hover:border-yellow-300"
            >
              <a href={duTcgUrl} rel="noreferrer">
                {t('home.playDuTcpr')}
              </a>
            </Button>
          </div>
        ) : null}
        
        <div className="max-w-2xl mx-auto w-full relative glass-effect rounded-xl p-1 sm:p-2">
          <Search className="absolute left-4 sm:left-5 top-1/2 transform -translate-y-1/2 text-yellow-400 w-5 h-5" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('home.searchPlaceholder')}
            className="pl-11 sm:pl-12 pr-4 py-3 text-base sm:text-lg bg-transparent border-0 text-white placeholder:text-gray-400 focus:ring-0"
          />
        </div>
      </div>

      <Tabs defaultValue="tracks" className="w-full">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 sticky top-20 bg-black/80 backdrop-blur-md py-3 px-2 z-30 rounded-lg shadow-lg gap-4 sm:gap-2">
          <div className="w-full sm:flex-1 overflow-x-auto">
            <style>
              {`
                .tabs-scrollbar::-webkit-scrollbar {
                  height: 4px;
                }
                .tabs-scrollbar::-webkit-scrollbar-track {
                  background: transparent;
                }
                .tabs-scrollbar::-webkit-scrollbar-thumb {
                  background: rgba(255, 215, 0, 0.4);
                  border-radius: 2px;
                }
                @media (pointer: coarse) {
                  .tabs-scrollbar::-webkit-scrollbar {
                    display: none;
                  }
                }
              `}
            </style>
            <TabsList className="glass-effect border border-white/10 p-1 rounded-lg inline-flex flex-nowrap tabs-scrollbar">
              <TabsTrigger value="tracks" className="tab-button flex-shrink-0">
                <Music className="w-4 h-4 mr-2" /> {t('home.tabs.tracks')}
              </TabsTrigger>
              <TabsTrigger value="albums" className="tab-button flex-shrink-0">
                <Disc className="w-4 h-4 mr-2" /> {t('home.tabs.albums')}
              </TabsTrigger>
              <TabsTrigger value="playlists" className="tab-button flex-shrink-0">
                <ListMusic className="w-4 h-4 mr-2" /> {t('home.tabs.playlists')}
              </TabsTrigger>
              <TabsTrigger value="videos" className="tab-button flex-shrink-0">
                <Film className="w-4 h-4 mr-2" /> {t('home.tabs.videos')}
              </TabsTrigger>
              <TabsTrigger value="creators" className="tab-button flex-shrink-0">
                <Users className="w-4 h-4 mr-2" /> {t('home.tabs.creators')}
              </TabsTrigger>
              <TabsTrigger value="radio" className="tab-button flex-shrink-0">
                <Radio className="w-4 h-4 mr-2" /> {t('home.tabs.radio')}
              </TabsTrigger>
            </TabsList>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setViewMode('grid')}
              className={`hover:text-yellow-400 ${viewMode === 'grid' ? 'text-yellow-400 bg-white/10' : 'text-white'}`}
              title={t('home.gridView')}
            >
              <LayoutGrid className="w-5 h-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setViewMode('list')}
              className={`hover:text-yellow-400 ${viewMode === 'list' ? 'text-yellow-400 bg-white/10' : 'text-white'}`}
              title={t('home.listView')}
            >
              <List className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex flex-wrap gap-2">
            {['all','daily','weekly','monthly','yearly'].map(range => (
              <Button
                key={range}
                size="sm"
                variant={timeRange === range ? 'default' : 'outline'}
                className={timeRange === range ? 'golden-gradient text-black font-semibold' : 'border-yellow-400/40 text-yellow-200'}
                onClick={() => setTimeRange(range)}
              >
                {t(`home.range.${range}`)}
              </Button>
            ))}
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-400">{t('home.view')}</span>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setViewMode('grid')}
              className={`hover:text-yellow-400 ${viewMode === 'grid' ? 'text-yellow-400 bg-white/10' : 'text-white'}`}
              title={t('home.gridView')}
            >
              <LayoutGrid className="w-5 h-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setViewMode('list')}
              className={`hover:text-yellow-400 ${viewMode === 'list' ? 'text-yellow-400 bg-white/10' : 'text-white'}`}
              title={t('home.listView')}
            >
              <List className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <TabsContent value="tracks">
          <TracksTab searchQuery={searchQuery} viewMode={viewMode} timeRange={timeRange} />
        </TabsContent>
        <TabsContent value="albums">
          <AlbumsTab searchQuery={searchQuery} viewMode={viewMode} timeRange={timeRange} />
        </TabsContent>
        <TabsContent value="playlists">
          <PlaylistsTab searchQuery={searchQuery} viewMode={viewMode} timeRange={timeRange} />
        </TabsContent>
        <TabsContent value="videos">
          <MusicVideosTab searchQuery={searchQuery} viewMode={viewMode} timeRange={timeRange} />
        </TabsContent>
        <TabsContent value="creators">
          <CreatorsTab searchQuery={searchQuery} viewMode={viewMode} timeRange={timeRange} />
        </TabsContent>
        <TabsContent value="radio">
          <RadioStationsTab searchQuery={searchQuery} viewMode={viewMode} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default HomePage;
