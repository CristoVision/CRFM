import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { Loader2, AlertTriangle, BarChart3, Trophy, Users, Music, RadioTower, ListMusic, Disc, Eye } from 'lucide-react';
import AchievementsOverview from '@/components/analytics/AchievementsOverview';
import AnalyticsFilters from '@/components/analytics/AnalyticsFilters';
import TrackAnalyticsPanel from '@/components/analytics/TrackAnalyticsPanel';
import AlbumAnalyticsPanel from '@/components/analytics/AlbumAnalyticsPanel';
import PlaylistAnalyticsPanel from '@/components/analytics/PlaylistAnalyticsPanel';
import PageViewsAnalyticsPanel from '@/components/analytics/PageViewsAnalyticsPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { subDays, format, startOfDay, endOfDay } from 'date-fns';

const AnalyticsTab = () => {
  const { user, profile } = useAuth();
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [errorOverview, setErrorOverview] = useState(null);
  
  const [totalStreams, setTotalStreams] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0); 
  const [totalListeners, setTotalListeners] = useState(0); 
  const [totalPageViews, setTotalPageViews] = useState(0);
  
  const [overviewFilters, setOverviewFilters] = useState({
    dateRange: { 
      from: subDays(new Date(), 30), 
      to: new Date() 
    },
    selectedTrackId: null, 
    genre: 'any',
    language: 'any'
  });

  const fetchOverviewData = useCallback(async () => {
    if (!user?.id) {
      setLoadingOverview(false);
      return;
    }
    setLoadingOverview(true);
    setErrorOverview(null);

    const startDate = overviewFilters.dateRange.from 
      ? format(startOfDay(overviewFilters.dateRange.from), 'yyyy-MM-dd') 
      : format(startOfDay(subDays(new Date(), 30)), 'yyyy-MM-dd');
    const endDate = overviewFilters.dateRange.to 
      ? format(endOfDay(overviewFilters.dateRange.to), 'yyyy-MM-dd') 
      : format(endOfDay(new Date()), 'yyyy-MM-dd');

    try {
      const { data, error } = await supabase.rpc('get_overall_stats_for_creator', {
        p_creator_id: user.id,
        start_ts: startDate,
        end_ts: endDate,
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const stats = data[0];
        setTotalStreams(stats.total_plays || 0);
        setTotalListeners(stats.unique_listeners_count || 0);
        setTotalPageViews(stats.total_views || 0);
        setTotalEarnings((stats.total_plays || 0) * 0.001); 
      } else {
        setTotalStreams(0);
        setTotalListeners(0);
        setTotalPageViews(0);
        setTotalEarnings(0);
      }

    } catch (err) {
      console.error("Overview analytics fetch error:", err);
      setErrorOverview(err.message);
      toast({ title: "Error Loading Overview Analytics", description: err.message, variant: "destructive" });
    } finally {
      setLoadingOverview(false);
    }
  }, [user, overviewFilters.dateRange]);

  useEffect(() => {
    fetchOverviewData();
  }, [fetchOverviewData]);

  const handleOverviewFiltersApply = (newFilters) => {
    setOverviewFilters(prev => ({ 
      ...prev, 
      dateRange: newFilters.dateRange,
      genre: newFilters.genre,
      language: newFilters.language
    }));
  };
  
  useEffect(() => {
    fetchOverviewData();
  }, [overviewFilters.dateRange, fetchOverviewData]);


  if (!user || !profile) {
     return (
      <div className="min-h-[calc(100vh-200px)] flex flex-col items-center justify-center glass-effect rounded-xl p-6">
        <AlertTriangle className="w-16 h-16 text-yellow-400 mb-4" />
        <h3 className="text-2xl font-semibold text-yellow-300 mb-2">Analytics Unavailable</h3>
        <p className="text-gray-300 text-center">Please ensure you are logged in and your profile is set up.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 md:p-6 font-montserrat text-white">
      <header className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold golden-text">Your Analytics</h1>
          <p className="text-gray-400 mt-1">Insights into your content performance and audience.</p>
        </div>
      </header>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mb-6 glass-effect p-1 rounded-lg">
          <TabsTrigger value="overview" className="tab-button"><BarChart3 className="w-4 h-4 mr-2"/>Overview</TabsTrigger>
          <TabsTrigger value="tracks" className="tab-button"><RadioTower className="w-4 h-4 mr-2"/>Tracks</TabsTrigger>
          <TabsTrigger value="albums" className="tab-button"><Disc className="w-4 h-4 mr-2"/>Albums</TabsTrigger>
          <TabsTrigger value="playlists" className="tab-button"><ListMusic className="w-4 h-4 mr-2"/>Playlists</TabsTrigger>
          <TabsTrigger value="pageViews" className="tab-button"><Eye className="w-4 h-4 mr-2"/>Page Views</TabsTrigger>
          <TabsTrigger value="achievements" className="tab-button"><Trophy className="w-4 h-4 mr-2"/>Achievements</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {loadingOverview ? (
             <div className="min-h-[300px] flex items-center justify-center glass-effect rounded-xl">
                <Loader2 className="w-10 h-10 text-yellow-400 animate-spin mr-3" />
                <p className="text-lg text-gray-300">Loading Overview...</p>
              </div>
          ) : errorOverview ? (
            <div className="min-h-[300px] flex flex-col items-center justify-center glass-effect rounded-xl p-6">
              <AlertTriangle className="w-12 h-12 text-red-500 mb-3" />
              <h3 className="text-xl font-semibold text-red-400 mb-1">Overview Error</h3>
              <p className="text-gray-300 text-center text-sm mb-3">{errorOverview}</p>
              <button onClick={fetchOverviewData} className="golden-gradient text-black font-semibold py-2 px-3 rounded-md hover:opacity-90 text-sm">
                Retry
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6 flex justify-end">
                <AnalyticsFilters 
                  initialFilterValues={overviewFilters} 
                  onApply={handleOverviewFiltersApply} 
                  userId={user.id}
                />
              </div>
              <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <Card className="glass-effect-light">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-300">Total Streams</CardTitle>
                    <Music className="h-5 w-5 text-yellow-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold golden-text">{totalStreams.toLocaleString()}</div>
                  </CardContent>
                </Card>
                <Card className="glass-effect-light">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-300">Unique Listeners</CardTitle>
                    <Users className="h-5 w-5 text-yellow-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold golden-text">{totalListeners.toLocaleString()}</div>
                  </CardContent>
                </Card>
                 <Card className="glass-effect-light">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-300">Total Page Views</CardTitle>
                    <Eye className="h-5 w-5 text-yellow-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold golden-text">{totalPageViews.toLocaleString()}</div>
                  </CardContent>
                </Card>
                <Card className="glass-effect-light">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-300">Estimated Earnings</CardTitle>
                    <img src="/favicon-32x32.png" alt="CrossCoin" className="w-5 h-5" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold golden-text">{totalEarnings.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).slice(1)} <span className="text-sm text-yellow-500">XCC</span></div>
                  </CardContent>
                </Card>
              </section>
            </>
          )}
        </TabsContent>

        <TabsContent value="tracks">
          <TrackAnalyticsPanel />
        </TabsContent>

        <TabsContent value="albums">
          <AlbumAnalyticsPanel />
        </TabsContent>

        <TabsContent value="playlists">
          <PlaylistAnalyticsPanel />
        </TabsContent>
        
        <TabsContent value="pageViews">
          <PageViewsAnalyticsPanel />
        </TabsContent>

        <TabsContent value="achievements">
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <h3 className="text-xl font-semibold text-white">Achievements & Badges</h3>
            </div>
            <p className="text-sm text-gray-400">
              Mira tus logros desbloqueados y los pendientes. Los íconos pueden ser imágenes (PNG/SVG) desde la columna <code>icon_url</code> de la tabla <code>achievements</code>; si está vacío, usamos un badge de color por defecto.
            </p>
            <AchievementsOverview userId={user.id} projectCode="CRFM" />
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalyticsTab;
