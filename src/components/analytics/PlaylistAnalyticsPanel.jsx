import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import AnalyticsFilters from '@/components/analytics/AnalyticsFilters';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { toast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertTriangle, Users, ListMusic } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, isValid } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    let formattedLabel = label;
    if (isValid(new Date(label))) {
      formattedLabel = format(new Date(label), 'MMM d, yyyy');
    }
    return (
      <div className="glass-effect p-3 rounded-md border border-yellow-400/30">
        <p className="label text-sm text-yellow-300">{formattedLabel}</p>
        {payload.map((pld, index) => (
          <p key={index} style={{ color: pld.stroke }} className="text-xs">
            {`${pld.name}: ${pld.value.toLocaleString()}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function PlaylistAnalyticsPanel() {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const [playsData, setPlaysData] = useState([]);
  const [listenersData, setListenersData] = useState([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [loadingCharts, setLoadingCharts] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCreatorPlaylists = async () => {
      if (!user || !dateRange.from || !dateRange.to) return;
      setLoadingPlaylists(true);
      setError(null);
      try {
        const { data: fallback, error: fallbackError } = await supabase
          .from('playlists')
          .select('id, title')
          .eq('creator_id', user.id)
          .order('created_at', { ascending: false });
        if (fallbackError) throw fallbackError;
        const mappedPlaylists = (fallback || []).map(p => ({ playlist_id: p.id, title: p.title, play_count: 0 }));
        setPlaylists(mappedPlaylists);

        if (mappedPlaylists.length > 0 && (!selectedPlaylistId || !mappedPlaylists.find(p => p.playlist_id === selectedPlaylistId))) {
          setSelectedPlaylistId(mappedPlaylists[0].playlist_id);
        } else if (mappedPlaylists.length === 0) {
          setSelectedPlaylistId(null);
          setPlaysData([]);
          setListenersData([]);
        }
      } catch (err) {
        console.error("Error fetching creator playlists:", err);
        toast({ title: 'Playlist analytics unavailable', description: 'Unable to load playlists for this creator.', variant: 'info' });
        setPlaylists([]);
        setSelectedPlaylistId(null);
        setError('Playlist analytics unavailable — playlists table query failed.');
      } finally {
        setLoadingPlaylists(false);
      }
    };
    fetchCreatorPlaylists();
  }, [user, dateRange]);

  const fetchDataForCharts = useCallback(async () => {
    if (!selectedPlaylistId || !dateRange.from || !dateRange.to || !user) {
      setPlaysData([]);
      setListenersData([]);
      return;
    }
    setLoadingCharts(true);
    setError(null);

    const startDateString = format(startOfDay(dateRange.from), "yyyy-MM-dd");
    const endDateString = format(endOfDay(dateRange.to), "yyyy-MM-dd");

    try {
      // Plays (fallback to playlist_stream_events)
      const { data: streamRows, error: streamErr } = await supabase
        .from('playlist_stream_events')
        .select('played_at, listener_user_id')
        .eq('playlist_id', selectedPlaylistId)
        .gte('played_at', startDateString + 'T00:00:00Z')
        .lte('played_at', endDateString + 'T23:59:59Z');
      if (streamErr) throw streamErr;

      const aggPlays = {};
      const aggListeners = {};
      streamRows.forEach(row => {
        const dayKey = format(new Date(row.played_at), 'yyyy-MM-dd');
        aggPlays[dayKey] = (aggPlays[dayKey] || 0) + 1;
        aggListeners[dayKey] = aggListeners[dayKey] || new Set();
        if (row.listener_user_id) aggListeners[dayKey].add(row.listener_user_id);
      });

      const playsData = Object.entries(aggPlays).map(([day, plays]) => ({ day, plays })).sort((a, b) => new Date(a.day) - new Date(b.day));
      const listenersData = Object.entries(aggListeners).map(([day, set]) => ({ day, count: set.size })).sort((a, b) => new Date(a.day) - new Date(b.day));

      setPlaysData(playsData);
      setListenersData(listenersData);

    } catch (err) {
      console.error("Error fetching playlist analytics charts:", err);
      setError(err.message);
      toast({ title: 'Failed to load playlist analytics charts', description: `Error fetching chart data: ${err.message}`, variant: 'destructive' });
      setPlaysData([]);
      setListenersData([]);
    } finally {
      setLoadingCharts(false);
    }
  }, [selectedPlaylistId, dateRange, user]);

  useEffect(() => {
    if (selectedPlaylistId) {
      fetchDataForCharts();
    }
  }, [fetchDataForCharts, selectedPlaylistId]);
  
  const handleFiltersChange = (newFilters) => {
    if (newFilters?.dateRange) {
      setDateRange(newFilters.dateRange);
    }
  };

  const renderChart = (title, data, dataKey, yAxisLabel, icon) => (
    <Card className="glass-effect-light flex-1 min-w-[300px] md:min-w-[400px]">
      <CardHeader>
        <CardTitle className="golden-text flex items-center">
          {React.cloneElement(icon, { className: "mr-2 h-5 w-5 text-yellow-400"})}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        {loadingCharts && <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 text-yellow-400 animate-spin" /></div>}
        {error && !loadingCharts && <div className="flex flex-col items-center justify-center h-full text-red-400"><AlertTriangle className="w-8 h-8 mb-2" /><p className="text-sm">{error}</p></div>}
        {!loadingCharts && !error && data.length === 0 && <div className="flex items-center justify-center h-full text-gray-400"><p>No data available for this period.</p></div>}
        {!loadingCharts && !error && data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, left: -5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="day" tickFormatter={(tick) => isValid(new Date(tick)) ? format(new Date(tick), 'MMM d') : tick} stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 12, dx:-5 }} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,215,0,0.05)' }}/>
              <Legend wrapperStyle={{fontSize: "12px"}}/>
              <Line type="monotone" dataKey={dataKey} stroke={dataKey === "plays" ? "#34d399" : "#fbbf24"} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5, strokeWidth: 1 }} name={yAxisLabel} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
  
  return (
    <div className="space-y-6">
      <Card className="glass-effect-light p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div>
            <label htmlFor="playlist-select-panel" className="block text-sm font-medium text-gray-300 mb-1">Select Playlist</label>
            <Select 
              value={selectedPlaylistId || ''} 
              onValueChange={setSelectedPlaylistId}
              disabled={playlists.length === 0 || loadingPlaylists}
            >
              <SelectTrigger id="playlist-select-panel" className="w-full bg-black/20 border-white/10 text-white focus:border-yellow-400">
                <SelectValue placeholder={loadingPlaylists ? "Loading playlists..." : "Select a playlist..."} />
              </SelectTrigger>
              <SelectContent className="glass-effect border-yellow-400/30 text-white">
                {loadingPlaylists ? <SelectItem value="loading" disabled>Loading playlists...</SelectItem> :
                playlists.length > 0 ? playlists.map(playlist => (
                  <SelectItem key={playlist.playlist_id} value={playlist.playlist_id} className="hover:!bg-yellow-400/10 hover:!text-yellow-200">{playlist.title} ({playlist.play_count || 0} plays)</SelectItem>
                )) : <SelectItem value="no-playlists-found" disabled>No playlists found for this period</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-1">
             <AnalyticsFilters 
                initialFilterValues={{ dateRange }} 
                onApply={handleFiltersChange}
                userId={user?.id}
                showTrackFilter={false}
                showGenreFilter={false}
                showLanguageFilter={false}
              />
          </div>
        </div>
      </Card>

      {error && !loadingPlaylists && !loadingCharts && (
        <Card className="glass-effect-light p-4 text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-2" />
          <p className="text-red-400">{error}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {renderChart("Daily Playlist Plays", playsData, "plays", "Plays", <ListMusic />)}
        {renderChart("Unique Playlist Listeners", listenersData, "count", "Listeners", <Users />)}
      </div>
    </div>
  );
}
