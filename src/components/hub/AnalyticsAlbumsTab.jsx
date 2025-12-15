import React, { useState, useEffect, useCallback } from 'react';
    import { supabase } from '@/lib/supabaseClient';
    import { useAuth } from '@/contexts/AuthContext';
    import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import { DatePickerWithRange } from '@/components/ui/date-picker'; 
    import { Button } from '@/components/ui/button';
    import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
    import { subDays, format } from 'date-fns';
    import { useToast } from "@/components/ui/use-toast";

    const AnalyticsAlbumsTab = () => {
      const { user } = useAuth();
      const { toast } = useToast();
      const [albumData, setAlbumData] = useState([]);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);
      const [dateRange, setDateRange] = useState({
        from: subDays(new Date(), 29),
        to: new Date(),
      });

      const fetchAlbumAnalytics = useCallback(async () => {
        if (!user || !dateRange.from || !dateRange.to) return;

        setLoading(true);
        setError(null);

        try {
          const creatorId = user.id;
          const startTs = dateRange.from;
          const endTs = dateRange.to;
          
          const { data, error: rpcError } = await supabase
            .rpc('get_top_albums_by_creator', {
              p_creator_id: creatorId,
              p_end_ts: endTs.toISOString(),
              p_start_ts: startTs.toISOString()
            });

          if (rpcError) {
            console.error('Error fetching album analytics:', rpcError);
            throw rpcError;
          }
          
          setAlbumData(data || []);

        } catch (err) {
          console.error('Detailed error in fetchAlbumAnalytics:', err);
          setError(err.message || 'Failed to fetch album analytics.');
          toast({
            title: "Error Fetching Album Data",
            description: err.message,
            variant: "destructive",
          });
        } finally {
          setLoading(false);
        }
      }, [user, dateRange, toast]);

      useEffect(() => {
        fetchAlbumAnalytics();
      }, [fetchAlbumAnalytics]);

      const handleDateRangeChange = (newRange) => {
        if (newRange?.from && newRange?.to) {
          setDateRange(newRange);
        } else if (!newRange?.from && !newRange?.to) {
           setDateRange({ from: subDays(new Date(), 29), to: new Date() });
        } else {
           setDateRange(prevRange => ({ ...prevRange, ...newRange }));
        }
      };
      
      const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
          return (
            <div className="bg-slate-800/90 text-white p-3 rounded-md border border-slate-700 shadow-lg">
              <p className="font-semibold text-yellow-400">{`${label}`}</p>
              <p className="text-sm">{`Plays: ${payload[0].value}`}</p>
            </div>
          );
        }
        return null;
      };

      return (
        <Card className="bg-slate-800/60 border-slate-700/50 shadow-xl text-white">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-xl font-semibold text-slate-100">Top Albums by Plays</CardTitle>
            <div className="flex items-center space-x-2">
              <DatePickerWithRange 
                date={dateRange} 
                onDateChange={handleDateRangeChange} 
                className="bg-slate-700 border-slate-600 text-white"
              />
              <Button variant="ghost" size="sm" onClick={fetchAlbumAnalytics} className="text-slate-400 hover:text-yellow-300">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading && (
              <div className="flex justify-center items-center h-72">
                <Loader2 className="w-12 h-12 animate-spin text-yellow-400" />
              </div>
            )}
            {error && !loading && (
              <div className="flex flex-col items-center justify-center h-72 bg-red-900/20 p-4 rounded-md">
                <AlertTriangle className="w-10 h-10 text-red-500 mb-3" />
                <p className="text-red-400 font-medium">Error: {error}</p>
                <p className="text-red-500 text-sm mt-1">Could not load album analytics. Please try again.</p>
              </div>
            )}
            {!loading && !error && albumData.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <p className="text-lg">No album play data available for the selected period.</p>
                <p className="text-sm">Try adjusting the date range or check back later.</p>
              </div>
            )}
            {!loading && !error && albumData.length > 0 && (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={albumData} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="album_title" 
                    tick={{ fill: '#9ca3af', fontSize: 12 }} 
                    angle={-30} 
                    textAnchor="end" 
                    height={60}
                    interval={0}
                  />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(250, 204, 21, 0.1)' }}/>
                  <Legend wrapperStyle={{ color: '#d1d5db', paddingTop: '10px' }} />
                  <Bar dataKey="play_count" name="Total Plays" fill="#FACC15" radius={[4, 4, 0, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      );
    };

    export default AnalyticsAlbumsTab;
