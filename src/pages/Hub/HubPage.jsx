import React, { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Music, Disc, ListMusic, Edit3, BarChart2, UploadCloud, Settings, Loader2, AlertTriangle, Film, ShieldAlert } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from "@/components/ui/use-toast";
import HubItemCard from '@/components/hub/HubItemCard';
import MyActions from '@/components/hub/MyActions';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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

function ContentSubTabs({ uploadGate }) {
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
      <TabsContent value="tracks"><Suspense fallback={<LoadingSpinner />}><HubTracksTab uploadGate={uploadGate} /></Suspense></TabsContent>
      <TabsContent value="albums"><Suspense fallback={<LoadingSpinner />}><HubAlbumsTab uploadGate={uploadGate} /></Suspense></TabsContent>
      <TabsContent value="playlists"><Suspense fallback={<LoadingSpinner />}><HubPlaylistsTab uploadGate={uploadGate} /></Suspense></TabsContent>
      <TabsContent value="videos"><Suspense fallback={<LoadingSpinner />}><HubMusicVideosTab uploadGate={uploadGate} /></Suspense></TabsContent>
    </Tabs>
  );
}

const HubPage = () => {
  const { user, profile, refreshUserProfile } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [isCreateTrackModalOpen, setIsCreateTrackModalOpen] = useState(false);
  const [isCreateAlbumModalOpen, setIsCreateAlbumModalOpen] = useState(false);
  const [isCreatePlaylistModalOpen, setIsCreatePlaylistModalOpen] = useState(false);
  const [isUploadVideoModalOpen, setIsUploadVideoModalOpen] = useState(false);
  const [isLrcEditorModalOpen, setIsLrcEditorModalOpen] = useState(false);
  const [editingTrackForLyrics, setEditingTrackForLyrics] = useState(null);
  const [activeTab, setActiveTab] = useState("content");
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [credits, setCredits] = useState({ track: 0, album: 0 });

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

  const subscriptionStatus = String(profile?.stripe_subscription_status || '').toLowerCase();
  const hasActiveSubscription = subscriptionStatus === 'active' || subscriptionStatus === 'trialing';
  const creatorUploadPolicy = String(profile?.creator_upload_policy || 'free').toLowerCase();

  const loadCredits = useCallback(async () => {
    if (!user?.id) {
      setCredits({ track: 0, album: 0 });
      return;
    }
    setLoadingCredits(true);
    try {
      const { data, error } = await supabase
        .from('creator_upload_fee_credits')
        .select('fee_type, credits')
        .eq('user_id', user.id);

      if (error && error.code !== 'PGRST116') throw error;

      const next = { track: 0, album: 0 };
      (data || []).forEach((row) => {
        if (row.fee_type === 'track') next.track = Number(row.credits) || 0;
        if (row.fee_type === 'album') next.album = Number(row.credits) || 0;
      });
      setCredits(next);
    } catch {
      setCredits({ track: 0, album: 0 });
    } finally {
      setLoadingCredits(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadCredits();
  }, [loadCredits]);

  useEffect(() => {
    const handler = () => {
      loadCredits();
    };
    window.addEventListener('crfm:creator_credits_updated', handler);
    return () => {
      window.removeEventListener('crfm:creator_credits_updated', handler);
    };
  }, [loadCredits]);

  const permissions = useMemo(() => {
    const hasAnyCredit = (Number(credits.track) || 0) > 0 || (Number(credits.album) || 0) > 0;

    const canUploadTrack = creatorUploadPolicy === 'free' || hasActiveSubscription || (creatorUploadPolicy === 'pay_per_upload' && (Number(credits.track) || 0) > 0);
    const canCreateAlbum = creatorUploadPolicy === 'free' || hasActiveSubscription || (creatorUploadPolicy === 'pay_per_upload' && (Number(credits.album) || 0) > 0);
    const canCreatePlaylist = creatorUploadPolicy === 'free' || hasActiveSubscription || (creatorUploadPolicy === 'pay_per_upload' && hasAnyCredit);
    const canUploadVideo = creatorUploadPolicy === 'free' || hasActiveSubscription || (creatorUploadPolicy === 'pay_per_upload' && hasAnyCredit);

    return {
      track: canUploadTrack,
      album: canCreateAlbum,
      playlist: canCreatePlaylist,
      video: canUploadVideo,
    };
  }, [creatorUploadPolicy, credits.album, credits.track, hasActiveSubscription]);

  const openMonetization = useCallback(
    ({ billingAction, feeType } = {}) => {
      setActiveTab('monetization');

      const params = new URLSearchParams(location.search || '');
      params.set('tab', 'monetization');

      if (billingAction === 'upload_fee' && (feeType === 'track' || feeType === 'album')) {
        params.set('billing_action', 'upload_fee');
        params.set('fee_type', feeType);
      }

      navigate(
        {
          pathname: location.pathname,
          search: `?${params.toString()}`,
        },
        { replace: false }
      );
    },
    [location.pathname, location.search, navigate]
  );

  const guardUploadAction = useCallback(
    (actionKey, onAllowed) => {
      if (!user) {
        toast({
          title: 'Login required',
          description: 'Please sign in to access creator uploads.',
          variant: 'destructive',
        });
        navigate('/auth');
        return;
      }

      if (permissions[actionKey]) {
        onAllowed?.();
        return;
      }

      const wantsCredits = creatorUploadPolicy === 'pay_per_upload' && (actionKey === 'track' || actionKey === 'album');
      if (wantsCredits) {
        toast({
          title: 'Upload locked',
          description: `Buy a ${actionKey} upload credit to continue.`,
          variant: 'destructive',
        });
        openMonetization({ billingAction: 'upload_fee', feeType: actionKey });
        return;
      }

      toast({
        title: 'Upload locked',
        description: 'Visit Monetization to activate a plan (Free / Pay Per Upload / Unlimited Uploads).',
        variant: 'destructive',
      });
      openMonetization();
    },
    [creatorUploadPolicy, navigate, openMonetization, permissions, toast, user]
  );

  const uploadGate = useMemo(
    () => ({
      credits,
      loadingCredits,
      hasActiveSubscription,
      creatorUploadPolicy,
      permissions,
      guard: guardUploadAction,
      refreshCredits: loadCredits,
    }),
    [credits, creatorUploadPolicy, guardUploadAction, hasActiveSubscription, loadingCredits, loadCredits, permissions]
  );

  const quickActions = useMemo(
    () => [
      { key: 'track', label: 'Upload Track', icon: Music, action: () => setIsCreateTrackModalOpen(true), gradientClass: 'gold-to-green-gradient' },
      { key: 'album', label: 'Create Album', icon: Disc, action: () => setIsCreateAlbumModalOpen(true), gradientClass: 'gold-to-blue-gradient' },
      { key: 'playlist', label: 'New Playlist', icon: ListMusic, action: () => setIsCreatePlaylistModalOpen(true), gradientClass: 'gold-to-purple-gradient' },
      { key: 'video', label: 'Upload Video', icon: Film, action: () => setIsUploadVideoModalOpen(true), gradientClass: 'gold-to-red-gradient' },
    ],
    []
  );

  const hubTabs = [
    { value: "content", label: "Content", icon: <UploadCloud/>, component: <ContentSubTabs uploadGate={uploadGate} /> },
    { value: "lyrics", label: "Lyrics Editor", icon: <Edit3/>, component: user ? <Suspense fallback={<LoadingSpinner />}><HubLyricsTab openLrcEditor={openLrcEditor} /></Suspense> : <PlaceholderContent title="LRC Lyrics Editor" icon={<Edit3 />} message={"Log in to access the Lyrics Editor."} showLoginButton={true}/> },
    { value: "actions", label: "My Actions", icon: <ShieldAlert/>, component: user ? <Suspense fallback={<LoadingSpinner />}><HubActionsTab /></Suspense> : <PlaceholderContent title="My Actions & Tasks" icon={<ShieldAlert />} message={"Log in to see your Actions."} showLoginButton={true}/> },
    { value: "analytics", label: "Analytics", icon: <BarChart2/>, component: user ? <Suspense fallback={<LoadingSpinner />}><AnalyticsTab /></Suspense> : <PlaceholderContent title="Content Analytics" icon={<BarChart2 />} message={"Log in to view your Analytics."} showLoginButton={true}/> },
    { value: "monetization", label: "Monetization", icon: <Settings/>, component: user ? <Suspense fallback={<LoadingSpinner />}><CreatorMonetizationTab /></Suspense> : <PlaceholderContent title="Monetization" icon={<Settings />} message={"Log in to manage tiers and upload preferences."} showLoginButton={true}/> },
  ];

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const tab = params.get('tab');
    if (!tab) return;
    const allowed = new Set(['content', 'lyrics', 'actions', 'analytics', 'monetization']);
    if (allowed.has(tab) && tab !== activeTab) setActiveTab(tab);
  }, [activeTab, location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const stripeReturn = params.get('stripe_return');
    if (stripeReturn !== '1') return;

    setActiveTab('monetization');

    try {
      const snapshot = {
        kind: params.get('kind') || null,
        fee_type: params.get('fee_type') || null,
        plan: params.get('plan') || null,
        session_id: params.get('session_id') || null,
        at: new Date().toISOString(),
      };
      window.sessionStorage.setItem('crfm:stripe_return', JSON.stringify(snapshot));
    } catch {
      // ignore storage failures
    }

    toast({
      title: 'Stripe checkout complete',
      description: 'We are applying your payment. This may take a few seconds.',
    });

    // Remove transient params so refreshes don’t re-toast.
    params.delete('stripe_return');
    params.delete('session_id');
    params.delete('kind');
    params.delete('fee_type');
    params.delete('plan');

    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : '',
      },
      { replace: true }
    );

    // Best-effort refresh profile (webhook might take a moment, billing panel also polls).
    refreshUserProfile?.();
    loadCredits();
  }, [location.pathname, location.search, navigate, refreshUserProfile, toast, loadCredits]);

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
            onClick={() => uploadGate.guard(action.key, action.action)}
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
        {isCreateAlbumModalOpen && <CreateAlbumModal isOpen={isCreateAlbumModalOpen} onOpenChange={() => setIsCreateAlbumModalOpen(false)} onAlbumCreated={() => { /* refresh logic */ }} />}
        {isCreatePlaylistModalOpen && <CreatePlaylistModal isOpen={isCreatePlaylistModalOpen} onOpenChange={() => setIsCreatePlaylistModalOpen(false)} onPlaylistCreated={() => { /* refresh logic */ }} />}
        {isUploadVideoModalOpen && <MusicVideoUploadModal isOpen={isUploadVideoModalOpen} onOpenChange={setIsUploadVideoModalOpen} onVideoUploaded={() => { /* refresh logic */ }} />}
        {isLrcEditorModalOpen && <LrcEditorModal isOpen={isLrcEditorModalOpen} onOpenChange={() => setIsLrcEditorModalOpen(false)} track={editingTrackForLyrics} onLyricsUpdated={() => { /* refresh logic */ }} />}
      </Suspense>
    </div>
  );
};

export default HubPage;
