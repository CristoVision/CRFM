import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import AnalyticsFilters from '@/components/analytics/AnalyticsFilters';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { toast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertTriangle, Users, Eye } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, isValid, formatISO } from 'date-fns';
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

export default function PageViewsAnalyticsPanel() {
  const { user } = useAuth();
  
  const [appliedFilters, setAppliedFilters] = useState({
    dateRange: {
      from: subDays(new Date(), 30),
      to: new Date(),
    },
    selectedTrackId: null, 
    genre: null,
    language: null,
  });

  const [viewsData, setViewsData] = useState([]);
  const [uniqueViewersData, setUniqueViewersData] = useState([]); 
  const [loadingCharts, setLoadingCharts] = useState(false);
  const [error, setError] = useState(null);

  const fetchDataForCharts = useCallback(async () => {
    if (!user || !appliedFilters.dateRange.from || !appliedFilters.dateRange.to) {
      setViewsData([]);
      setUniqueViewersData([]);
      return;
    }
    setLoadingCharts(true);
    setError(null);

    const startDate = startOfDay(appliedFilters.dateRange.from);
    const endDate = endOfDay(appliedFilters.dateRange.to);
    const startTs = formatISO(startDate);
    const endTs = formatISO(endDate);

    try {
      const { data: playlistRows, error: playlistLookupError } = await supabase
        .from('playlists')
        .select('id')
        .eq('creator_id', user.id);
      if (playlistLookupError) {
        console.warn('Failed to load creator playlists for page views filter:', playlistLookupError);
      }
      const playlistIds = (playlistRows || []).map(p => p.id);
      if (!playlistIds.length) {
        setError("No playlists found for this account.");
        setViewsData([]);
        setUniqueViewersData([]);
        setLoadingCharts(false);
        return;
      }

      const { data: streamRows, error: streamErr } = await supabase
        .from('playlist_stream_events')
        .select('played_at, listener_user_id, playlist_id')
        .in('playlist_id', playlistIds)
        .gte('played_at', startTs)
        .lte('played_at', endTs);
      if (streamErr) throw streamErr;

      const aggViews = {};
      const aggUnique = {};
      streamRows.forEach(row => {
        const dayKey = format(new Date(row.played_at), 'yyyy-MM-dd');
        aggViews[dayKey] = (aggViews[dayKey] || 0) + 1;
        aggUnique[dayKey] = aggUnique[dayKey] || new Set();
        if (row.listener_user_id) aggUnique[dayKey].add(row.listener_user_id);
      });

      const viewsDataLocal = Object.entries(aggViews).map(([day, views]) => ({ day, views })).sort((a, b) => new Date(a.day) - new Date(b.day));
      const uniqueDataLocal = Object.entries(aggUnique).map(([day, set]) => ({ day, count: set.size })).sort((a, b) => new Date(a.day) - new Date(b.day));

      setViewsData(viewsDataLocal);
      setUniqueViewersData(uniqueDataLocal);

      if (viewsDataLocal.length === 0 && uniqueDataLocal.length === 0) {
        setError("No data available for the selected filters and date range.");
      }

    } catch (err) {
      console.error("Error fetching page view analytics:", err);
      const friendlyErrorMessage = "Page view analytics unavailable — playlist_stream_events query failed.";
      setError(friendlyErrorMessage);
      toast({ title: 'Page View Analytics Unavailable', description: friendlyErrorMessage, variant: 'info' });
      setViewsData([]);
      setUniqueViewersData([]);
    } finally {
      setLoadingCharts(false);
    }
  }, [user, appliedFilters]);

  useEffect(() => {
    fetchDataForCharts();
  }, [fetchDataForCharts]);
  
  const handleApplyAnalyticsFilters = useCallback((newlyAppliedFilters) => {
    setAppliedFilters(prev => ({ ...prev, ...newlyAppliedFilters }));
  }, []);


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
        {error && !loadingCharts && data.length === 0 && <div className="flex flex-col items-center justify-center h-full text-red-400 p-4 text-center"><AlertTriangle className="w-8 h-8 mb-2" /><p className="text-sm">{error}</p></div>}
        {!loadingCharts && !error && data.length === 0 && <div className="flex items-center justify-center h-full text-gray-400"><p>No data available for this period.</p></div>}
        {!loadingCharts && !error && data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, left: -5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="day" tickFormatter={(tick) => isValid(new Date(tick)) ? format(new Date(tick), 'MMM d') : tick} stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 12, dx:-5 }} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,215,0,0.05)' }}/>
              <Legend wrapperStyle={{fontSize: "12px"}}/>
              <Line type="monotone" dataKey={dataKey} stroke={dataKey === "views" ? "#22d3ee" : "#f472b6"} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5, strokeWidth: 1 }} name={yAxisLabel} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
  
  return (
    <div className="space-y-6">
      <Card className="glass-effect-light p-4 md:p-6">
        <div className="flex justify-end">
          <AnalyticsFilters 
            initialFilterValues={appliedFilters}
            onApply={handleApplyAnalyticsFilters}
            userId={user?.id}
            showTrackFilter={false} 
            showGenreFilter={false}
            showLanguageFilter={false}
          />
        </div>
      </Card>

      {error && !loadingCharts && (viewsData.length === 0 && uniqueViewersData.length === 0) && (
        <Card className="glass-effect-light p-4 text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-2" />
          <p className="text-red-400">{error}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {renderChart("Daily Page Views", viewsData, "views", "Views", <Eye />)}
        {renderChart("Unique Daily Viewers", uniqueViewersData, "count", "Viewers", <Users />)}
      </div>
    </div>
  );
}
