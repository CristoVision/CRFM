import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import AnalyticsFilters from '@/components/analytics/AnalyticsFilters';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { toast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertTriangle, Users, Disc } from 'lucide-react';
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

export default function AlbumAnalyticsPanel() {
  const { user } = useAuth();
  const [albums, setAlbums] = useState([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState(null);
  
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const [playsData, setPlaysData] = useState([]);
  const [listenersData, setListenersData] = useState([]);
  const [loadingAlbums, setLoadingAlbums] = useState(false);
  const [loadingCharts, setLoadingCharts] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCreatorAlbums = async () => {
      if (!user || !dateRange.from || !dateRange.to) return;
      setLoadingAlbums(true);
      setError(null);
      try {
        const { data: fallbackAlbums, error: fallbackError } = await supabase
          .from('albums')
          .select('id, title')
          .eq('uploader_id', user.id)
          .order('created_at', { ascending: false });
        if (fallbackError) throw fallbackError;
        const mappedAlbums = (fallbackAlbums || []).map(a => ({ album_id: a.id, title: a.title, play_count: 0 }));

        setAlbums(mappedAlbums);

        if (mappedAlbums.length > 0 && (!selectedAlbumId || !mappedAlbums.find(a => a.album_id === selectedAlbumId))) {
          setSelectedAlbumId(mappedAlbums[0].album_id);
        } else if (mappedAlbums.length === 0) {
          setSelectedAlbumId(null);
          setPlaysData([]);
          setListenersData([]);
        }
      } catch (err) {
        console.error("Error fetching creator albums:", err);
        toast({ title: 'Album analytics unavailable', description: 'Unable to load albums for this creator.', variant: 'info' });
        setAlbums([]);
        setSelectedAlbumId(null);
        setError('Album analytics unavailable — albums table query failed.');
      } finally {
        setLoadingAlbums(false);
      }
    };
    fetchCreatorAlbums();
  }, [user, dateRange]);

  const fetchDataForCharts = useCallback(async () => {
    if (!selectedAlbumId || !dateRange.from || !dateRange.to || !user) {
      setPlaysData([]);
      setListenersData([]);
      return;
    }
    setLoadingCharts(true);
    setError(null);

    const startDateString = format(startOfDay(dateRange.from), "yyyy-MM-dd");
    const endDateString = format(endOfDay(dateRange.to), "yyyy-MM-dd");

    try {
      const { data: albumTracks, error: tracksError } = await supabase
        .from('tracks')
        .select('id')
        .eq('album_id', selectedAlbumId)
        .eq('uploader_id', user.id);

      if (tracksError) throw tracksError;
      const trackIdsInAlbum = albumTracks.map(t => t.id);

      let playsData = [];
      if (trackIdsInAlbum.length > 0) {
        const playsRes = await supabase
          .from('daily_track_streams')
          .select('day, plays')
          .in('track_id', trackIdsInAlbum)
          .gte('day', startDateString + 'T00:00:00Z')
          .lte('day', endDateString + 'T23:59:59Z')
          .order('day', { ascending: true });
        if (playsRes.error) {
          const { data: streamRows, error: streamErr } = await supabase
            .from('track_streams')
            .select('streamed_at, track_id')
            .in('track_id', trackIdsInAlbum)
            .gte('streamed_at', startOfDay(dateRange.from).toISOString())
            .lte('streamed_at', endOfDay(dateRange.to).toISOString());
          if (streamErr) throw streamErr;
          const agg = {};
          streamRows.forEach(row => {
            const dayKey = format(new Date(row.streamed_at), 'yyyy-MM-dd');
            agg[dayKey] = (agg[dayKey] || 0) + 1;
          });
          playsData = Object.entries(agg).map(([day, plays]) => ({ day, plays })).sort((a, b) => new Date(a.day) - new Date(b.day));
        } else {
          playsData = playsRes.data.map(d => ({ ...d, day: format(new Date(d.day), 'yyyy-MM-dd') }));
        }
      }

      const listenersAggRows = await supabase
        .from('track_streams')
        .select('streamed_at, user_id, track_id')
        .in('track_id', trackIdsInAlbum)
        .gte('streamed_at', startOfDay(dateRange.from).toISOString())
        .lte('streamed_at', endOfDay(dateRange.to).toISOString());
      if (listenersAggRows.error) throw listenersAggRows.error;
      const listenerAgg = {};
      (listenersAggRows.data || []).forEach(row => {
        const dayKey = format(new Date(row.streamed_at), 'yyyy-MM-dd');
        listenerAgg[dayKey] = listenerAgg[dayKey] || new Set();
        if (row.user_id) listenerAgg[dayKey].add(row.user_id);
      });
      const listenersData = Object.entries(listenerAgg).map(([day, set]) => ({ day, count: set.size })).sort((a, b) => new Date(a.day) - new Date(b.day));

      setPlaysData(playsData);
      setListenersData(listenersData);

    } catch (err) {
      console.error("Error fetching album analytics charts:", err);
      setError(err.message);
      toast({ title: 'Failed to load album analytics charts', description: `Error fetching chart data: ${err.message}`, variant: 'destructive' });
      setPlaysData([]);
      setListenersData([]);
    } finally {
      setLoadingCharts(false);
    }
  }, [selectedAlbumId, dateRange, user]);

  useEffect(() => {
    if(selectedAlbumId) {
      fetchDataForCharts();
    }
  }, [fetchDataForCharts, selectedAlbumId]);
  
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
              <Line type="monotone" dataKey={dataKey} stroke={dataKey === "plays" ? "#a052d8" : "#d88452"} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5, strokeWidth: 1 }} name={yAxisLabel} />
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
            <label htmlFor="album-select-panel" className="block text-sm font-medium text-gray-300 mb-1">Select Album</label>
            <Select 
              value={selectedAlbumId || ''} 
              onValueChange={setSelectedAlbumId}
              disabled={albums.length === 0 || loadingAlbums}
            >
              <SelectTrigger id="album-select-panel" className="w-full bg-black/20 border-white/10 text-white focus:border-yellow-400">
                <SelectValue placeholder={loadingAlbums ? "Loading albums..." : "Select an album..."} />
              </SelectTrigger>
              <SelectContent className="glass-effect border-yellow-400/30 text-white">
                {loadingAlbums ? <SelectItem value="loading" disabled>Loading albums...</SelectItem> :
                albums.length > 0 ? albums.map(album => (
                  <SelectItem key={album.album_id} value={album.album_id} className="hover:!bg-yellow-400/10 hover:!text-yellow-200">{album.title} ({album.play_count || 0} plays)</SelectItem>
                )) : <SelectItem value="no-albums-found" disabled>No albums found for this period</SelectItem>}
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

      {error && !loadingAlbums && !loadingCharts && (
        <Card className="glass-effect-light p-4 text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-2" />
          <p className="text-red-400">{error}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {renderChart("Daily Album Plays", playsData, "plays", "Plays", <Disc />)}
        {renderChart("Unique Album Listeners", listenersData, "count", "Listeners", <Users />)}
      </div>
    </div>
  );
}
