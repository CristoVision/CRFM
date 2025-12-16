import React, { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { PlusCircle, Music, Disc, ListMusic, Edit3, BarChart2, UploadCloud, Settings, Info, Loader2, AlertTriangle, Search, Film, ShieldAlert } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from "@/components/ui/use-toast";
import HubItemCard from '@/components/hub/HubItemCard';
import MyActions from '@/components/hub/MyActions';
import { Link } from 'react-router-dom';
import { logContentView } from '@/lib/analyticsClient';

const CreateTrackModal = React.lazy(() => import('@/components/hub/CreateTrackModal'));
const CreateAlbumModal = React.lazy(() => import('@/components/hub/CreateAlbumModal'));
const CreatePlaylistModal = React.lazy(() => import('@/components/hub/CreatePlaylistModal'));
const LrcEditorModal = React.lazy(() => import('@/components/hub/LrcEditorModal'));
const MusicVideoUploadModal = React.lazy(() => import('@/components/hub/MusicVideoUploadModal'));

const HubTracksTab = React.lazy(() => import('@/components/hub/HubTracksTab'));
const HubAlbumsTab = React.lazy(() => import('@/components/hub/HubAlbumsTab'));
const HubPlaylistsTab = React.lazy(() => import('@/components/hub/HubPlaylistsTab'));
const HubMusicVideosTab = React.lazy(() => import('@/components/hub/HubMusicVideosTab'));
const HubLyricsTab = React.lazy(() => import('@/components/hub/HubLyricsTab'));
const HubActionsTab = React.lazy(() => import('@/components/hub/HubActionsTab'));
const AnalyticsTab = React.lazy(() => import('@/pages/Hub/AnalyticsTab'));
const CreatorMonetizationTab = React.lazy(() => import('@/components/creator/CreatorMonetizationTab'));

const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-64">
    <Loader2 className="h-12 w-12 animate-spin text-yellow-400" />
  </div>
);

const ErrorDisplay = ({ message }) => (
  <div className="flex flex-col items-center justify-center h-64 bg-red-500/10 p-4 rounded-lg">
    <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
    <p className="text-red-500 font-semibold">Error loading content</p>
    <p className="text-red-400 text-sm">{message}</p>
  </div>
);

function PlaceholderContent({ title, icon, message, showLoginButton = false }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8 glass-effect rounded-xl">
      {React.cloneElement(icon, { className: "w-16 h-16 text-yellow-400 mb-6 opacity-70" })}
      <h2 className="text-4xl font-bold golden-text mb-4">{title}</h2>
      <p className="text-xl text-gray-300 mb-6">{message || "This section is under construction."}</p>
      <p className="text-gray-400">Exciting features are being developed. Stay tuned!</p>
      {showLoginButton && (
        <Button asChild className="mt-8 golden-gradient text-black font-semibold hover:opacity-90 transition-opacity proximity-glow-button">
          <Link to="/auth">Login to Access Creator Hub</Link>
        </Button>
      )}
    </div>
  );
}

function ContentSubTabs() {
  const { user } = useAuth();
  if (!user) {
    return <PlaceholderContent title="Your Content" icon={<UploadCloud />} message="Please log in to manage your content." showLoginButton={true} />;
  }
  return (
    <Tabs defaultValue="tracks" className="w-full">
      <TabsList className="flex w-full overflow-x-auto pb-2 space-x-2 bg-transparent p-1 mb-6">
        <TabsTrigger value="tracks" className="tab-button flex-shrink-0"><Music className="w-4 h-4 mr-2"/>Tracks</TabsTrigger>
        <TabsTrigger value="albums" className="tab-button flex-shrink-0"><Disc className="w-4 h-4 mr-2"/>Albums</TabsTrigger>
        <TabsTrigger value="playlists" className="tab-button flex-shrink-0"><ListMusic className="w-4 h-4 mr-2"/>Playlists</TabsTrigger>
        <TabsTrigger value="videos" className="tab-button flex-shrink-0"><Film className="w-4 h-4 mr-2"/>Music Videos</TabsTrigger>
      </TabsList>
      <TabsContent value="tracks"><Suspense fallback={<LoadingSpinner />}><HubTracksTab /></Suspense></TabsContent>
      <TabsContent value="albums"><Suspense fallback={<LoadingSpinner />}><HubAlbumsTab /></Suspense></TabsContent>
      <TabsContent value="playlists"><Suspense fallback={<LoadingSpinner />}><HubPlaylistsTab /></Suspense></TabsContent>
      <TabsContent value="videos"><Suspense fallback={<LoadingSpinner />}><HubMusicVideosTab /></Suspense></TabsContent>
    </Tabs>
  );
}

const HubPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateTrackModalOpen, setIsCreateTrackModalOpen] = useState(false);
  const [isCreateAlbumModalOpen, setIsCreateAlbumModalOpen] = useState(false);
  const [isCreatePlaylistModalOpen, setIsCreatePlaylistModalOpen] = useState(false);
  const [isUploadVideoModalOpen, setIsUploadVideoModalOpen] = useState(false);
  const [isLrcEditorModalOpen, setIsLrcEditorModalOpen] = useState(false);
  const [editingTrackForLyrics, setEditingTrackForLyrics] = useState(null);
  const [activeTab, setActiveTab] = useState("content");

  useEffect(() => {
    logContentView({
      resourceType: 'hub_page',
      path: '/hub',
      userId: user?.id || null,
      source: 'web',
    });
  }, [user?.id]);

  const openLrcEditor = (track) => {
    setEditingTrackForLyrics(track);
    setIsLrcEditorModalOpen(true);
  };

  const quickActions = [
    { label: "Upload Track", icon: Music, action: () => setIsCreateTrackModalOpen(true), gradientClass: "gold-to-green-gradient" },
    { label: "Create Album", icon: Disc, action: () => setIsCreateAlbumModalOpen(true), gradientClass: "gold-to-blue-gradient" },
    { label: "New Playlist", icon: ListMusic, action: () => setIsCreatePlaylistModalOpen(true), gradientClass: "gold-to-purple-gradient" },
    { label: "Upload Video", icon: Film, action: () => setIsUploadVideoModalOpen(true), gradientClass: "gold-to-red-gradient" },
  ];

  const hubTabs = [
    { value: "content", label: "Content", icon: <UploadCloud/>, component: <ContentSubTabs/> },
    { value: "lyrics", label: "Lyrics Editor", icon: <Edit3/>, component: user ? <Suspense fallback={<LoadingSpinner />}><HubLyricsTab openLrcEditor={openLrcEditor} /></Suspense> : <PlaceholderContent title="LRC Lyrics Editor" icon={<Edit3 />} message={"Log in to access the Lyrics Editor."} showLoginButton={true}/> },
    { value: "actions", label: "My Actions", icon: <ShieldAlert/>, component: user ? <Suspense fallback={<LoadingSpinner />}><HubActionsTab /></Suspense> : <PlaceholderContent title="My Actions & Tasks" icon={<ShieldAlert />} message={"Log in to see your Actions."} showLoginButton={true}/> },
    { value: "analytics", label: "Analytics", icon: <BarChart2/>, component: user ? <Suspense fallback={<LoadingSpinner />}><AnalyticsTab /></Suspense> : <PlaceholderContent title="Content Analytics" icon={<BarChart2 />} message={"Log in to view your Analytics."} showLoginButton={true}/> },
    { value: "monetization", label: "Monetization", icon: <Settings/>, component: user ? <Suspense fallback={<LoadingSpinner />}><CreatorMonetizationTab /></Suspense> : <PlaceholderContent title="Monetization" icon={<Settings />} message={"Log in to manage tiers and upload preferences."} showLoginButton={true}/> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-4 md:p-8">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 via-amber-300 to-orange-400">Creator Hub</h1>
        <p className="text-slate-400 mt-1">Manage your music, lyrics, videos, and see your impact.</p>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8"
      >
        {quickActions.map((action) => (
          <Button 
            key={action.label}
            onClick={action.action} 
            className={`flex flex-col items-center justify-center h-28 md:h-32 p-4 rounded-lg shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 text-white font-semibold text-sm md:text-base ${action.gradientClass}`}
          >
            <action.icon className="w-8 h-8 md:w-10 md:h-10 mb-2" />
            {action.label}
          </Button>
        ))}
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex w-full overflow-x-auto pb-2 space-x-1 bg-gray-800/80 p-1 rounded-lg mb-6">
          {hubTabs.map(tab => (
            <TabsTrigger 
              key={tab.value} 
              value={tab.value}
              className="data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-300 data-[state=active]:shadow-md text-slate-300 hover:bg-gray-700/50 hover:text-slate-100 px-3 py-2 text-xs sm:text-sm rounded-md transition-all flex-shrink-0"
            >
              {React.cloneElement(tab.icon, { className: "w-4 h-4 mr-0 sm:mr-2"})}
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {hubTabs.map(tab => tab.value === activeTab && (
              <TabsContent key={tab.value} value={tab.value} className="mt-0">
                {tab.component}
              </TabsContent>
            ))}
          </motion.div>
        </AnimatePresence>
      </Tabs>
      
      <Suspense fallback={<LoadingSpinner />}>
        {isCreateTrackModalOpen && <CreateTrackModal isOpen={isCreateTrackModalOpen} onOpenChange={() => setIsCreateTrackModalOpen(false)} onTrackCreated={() => { /* refresh logic if needed */ }} />}
        {isCreateAlbumModalOpen && <CreateAlbumModal isOpen={isCreateAlbumModalOpen} onClose={() => setIsCreateAlbumModalOpen(false)} onAlbumCreated={() => { /* refresh logic */ }} />}
        {isCreatePlaylistModalOpen && <CreatePlaylistModal isOpen={isCreatePlaylistModalOpen} onClose={() => setIsCreatePlaylistModalOpen(false)} onPlaylistCreated={() => { /* refresh logic */ }} />}
        {isUploadVideoModalOpen && <MusicVideoUploadModal isOpen={isUploadVideoModalOpen} onOpenChange={setIsUploadVideoModalOpen} onVideoUploaded={() => { /* refresh logic */ }} />}
        {isLrcEditorModalOpen && <LrcEditorModal isOpen={isLrcEditorModalOpen} onClose={() => setIsLrcEditorModalOpen(false)} track={editingTrackForLyrics} onLyricsUpdated={() => { /* refresh logic */ }} />}
      </Suspense>
    </div>
  );
};

export default HubPage;
