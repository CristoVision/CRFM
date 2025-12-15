import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import AnalyticsFilters from '@/components/analytics/AnalyticsFilters';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { toast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertTriangle, Users, RadioTower } from 'lucide-react';
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

export default function TrackAnalyticsPanel() {
  const { user } = useAuth();
  
  const [appliedFilters, setAppliedFilters] = useState({
    selectedTrackId: null,
    dateRange: {
      from: subDays(new Date(), 30),
      to: new Date(),
    },
    genre: null, 
    language: null, 
  });

  const [playsData, setPlaysData] = useState([]);        
  const [listenersData, setListenersData] = useState([]);
  const [loadingCharts, setLoadingCharts] = useState(false);
  const [chartError, setChartError] = useState("Please select a track or 'All Tracks' from the filters to see analytics.");

  const handleApplyAnalyticsFilters = useCallback((newlyAppliedFilters) => {
    setAppliedFilters(prev => ({ ...prev, ...newlyAppliedFilters }));
  }, []);

  const fetchDataForCharts = useCallback(async () => {
    if (!user || !appliedFilters.dateRange.from || !appliedFilters.dateRange.to) {
        setPlaysData([]);
        setListenersData([]);
        setChartError("Please select a valid date range.");
        return;
    }
    
    setLoadingCharts(true);
    setChartError(null);

    const startTs = startOfDay(appliedFilters.dateRange.from).toISOString();
    const endTs = endOfDay(appliedFilters.dateRange.to).toISOString();

    try {
      // Fetch track ids to scope analytics
      let trackIds = [];
      if (appliedFilters.selectedTrackId) {
        trackIds = [appliedFilters.selectedTrackId];
      } else {
        const { data: trackIdsData, error: trackIdsError } = await supabase
          .from('tracks')
          .select('id')
          .eq('uploader_id', user.id);
        if (trackIdsError) throw trackIdsError;
        trackIds = (trackIdsData || []).map(t => t.id);
      }

      if (trackIds.length === 0) {
        setPlaysData([]);
        setListenersData([]);
        setChartError("No tracks found for this account.");
        setLoadingCharts(false);
        return;
      }

      // Pull raw streams for those tracks
      const { data: streamRows, error: streamErr } = await supabase
        .from('track_streams')
        .select('streamed_at, user_id, track_id')
        .in('track_id', trackIds)
        .gte('streamed_at', startTs)
        .lte('streamed_at', endTs);

      if (streamErr) throw streamErr;

      const playsAgg = {};
      const listenersAgg = {};
      streamRows.forEach(row => {
        const dayKey = format(new Date(row.streamed_at), 'yyyy-MM-dd');
        playsAgg[dayKey] = (playsAgg[dayKey] || 0) + 1;
        listenersAgg[dayKey] = listenersAgg[dayKey] || new Set();
        if (row.user_id) listenersAgg[dayKey].add(row.user_id);
      });

      const playsData = Object.entries(playsAgg).map(([day, plays]) => ({ day, plays })).sort((a, b) => new Date(a.day) - new Date(b.day));
      const mappedListeners = Object.entries(listenersAgg).map(([day, set]) => ({ day, count: set.size })).sort((a, b) => new Date(a.day) - new Date(b.day));

      setPlaysData(playsData);
      setListenersData(mappedListeners);

      if (playsData.length === 0 && mappedListeners.length === 0) {
        setChartError("No data available for the selected filters and date range.");
      }

    } catch (err) {
      console.error("Error fetching track analytics charts:", err);
      setChartError(err.message || "Failed to load analytics.");
      setPlaysData([]);
      setListenersData([]);
    } finally {
      setLoadingCharts(false);
    }
  }, [appliedFilters, user]);

  useEffect(() => {
    if (user && appliedFilters.dateRange.from && appliedFilters.dateRange.to) {
      fetchDataForCharts();
    } else if (!user) {
        setChartError("User not available.");
    }
  }, [fetchDataForCharts, user, appliedFilters]); 
  
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
        {!loadingCharts && chartError && data.length === 0 && <div className="flex flex-col items-center justify-center h-full text-red-400 p-4 text-center"><AlertTriangle className="w-8 h-8 mb-2" /><p className="text-sm">{chartError}</p></div>}
        {!loadingCharts && !chartError && data.length === 0 && <div className="flex items-center justify-center h-full text-gray-400"><p>No data available for this period.</p></div>}
        {!loadingCharts && !chartError && data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, left: -5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="day" tickFormatter={(tick) => isValid(new Date(tick)) ? format(new Date(tick), 'MMM d') : tick} stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 12, dx:-5 }} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,215,0,0.05)' }}/>
              <Legend wrapperStyle={{fontSize: "12px"}}/>
              <Line type="monotone" dataKey={dataKey} stroke={dataKey === "plays" ? "#8884d8" : "#82ca9d"} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5, strokeWidth: 1 }} name={yAxisLabel} />
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
          />
        </div>
      </Card>

      {!loadingCharts && chartError && (playsData.length === 0 && listenersData.length === 0) && (
         <Card className="glass-effect-light p-4 text-center">
           <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto mb-2" />
           <p className="text-yellow-400">{chartError}</p>
         </Card>
       )}


      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {renderChart("Daily Plays", playsData, "plays", "Plays", <RadioTower />)}
        {renderChart("Unique Listeners", listenersData, "count", "Listeners", <Users />)}
      </div>
    </div>
  );
}
