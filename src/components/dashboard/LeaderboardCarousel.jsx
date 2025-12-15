// src/components/dashboard/LeaderboardCarousel.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from '@/components/ui/carousel';
import LeaderboardCard from './LeaderboardCard';
import { Loader2, Trophy, AlertTriangle } from 'lucide-react';
import { subDays } from 'date-fns';

const LeaderboardCarousel = ({ itemType, timeframe = 'weekly' }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Protege contra respuestas de requests viejos
  const requestIdRef = useRef(0);
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  const rpcNameFor = (type) => (type === 'music_video' ? 'get_top_music_videos_leaderboard'
    : `get_top_${type}s_leaderboard`);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Reintento exponencial simple para errores transitorios
  const rpcWithRetry = async (name, args) => {
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase.rpc(name, args);
      if (!error) return data || [];
      lastErr = error;

      // Errores transitorios típicos: red, 5xx, timeouts
      const msg = String(error.message || '').toLowerCase();
      const transient = msg.includes('fetch') || msg.includes('timeout') || msg.includes('502') || msg.includes('503') || msg.includes('504') || msg.includes('connection');
      if (!transient) break; // si no parece transitorio, no insistas

      await sleep(250 * (attempt + 1)); // 250ms, 500ms
    }
    throw lastErr;
  };

  const callLeaderboardRpc = async (rpcName) => {
    const payloads = [
      { p_timeframe: timeframe },
      { timeframe },
    ];

    let lastErr = null;
    for (const args of payloads) {
      try {
        return await rpcWithRetry(rpcName, args);
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr;
  };

  const fallbackTrackLeaderboard = async () => {
    const now = new Date();
    const fromDate =
      timeframe === 'weekly' ? subDays(now, 7)
      : timeframe === 'monthly' ? subDays(now, 30)
      : null;

    let streamQuery = supabase.from('track_streams').select('track_id').limit(10000);
    if (fromDate) {
      streamQuery = streamQuery.gte('streamed_at', fromDate.toISOString());
    }
    const { data: streamRows, error: streamErr } = await streamQuery;
    if (streamErr) throw streamErr;
    if (!streamRows || streamRows.length === 0) return [];

    const counts = streamRows.reduce((acc, row) => {
      if (row.track_id) acc[row.track_id] = (acc[row.track_id] || 0) + 1;
      return acc;
    }, {});

    const topIds = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([id]) => id);

    const { data: tracks, error: tracksErr } = await supabase
      .from('tracks')
      .select('id, title, cover_art_url, uploader_id, creator_display_name')
      .in('id', topIds);
    if (tracksErr) throw tracksErr;

    return topIds
      .map((id) => {
        const track = tracks.find((t) => t.id === id) || { id, title: 'Unknown Track' };
        return { ...track, total_streams: counts[id] || 0 };
      })
      .filter(Boolean);
  };

  const fetchLeaderboardData = useCallback(async () => {
    const myId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const rpcName = rpcNameFor(itemType);
      let result;
      try {
        result = await callLeaderboardRpc(rpcName);
      } catch (rpcErr) {
        // Fallback solo para tracks si el RPC no existe o devuelve 400
        const msg = String(rpcErr?.message || '').toLowerCase();
        const code = String(rpcErr?.code || '');
        const status = rpcErr?.status ?? rpcErr?.statusCode ?? rpcErr?.httpStatus;
        const isClientError = typeof status === 'number' && status >= 400 && status < 500;
        const looksLikeRpcIssue =
          code.startsWith('PGRST') ||
          msg.includes('function') ||
          msg.includes('rpc') ||
          msg.includes('schema cache') ||
          msg.includes('parameter') ||
          msg.includes('unexpected');

        const fallbackAllowed = itemType === 'track' && (isClientError || looksLikeRpcIssue);
        if (fallbackAllowed) {
          result = await fallbackTrackLeaderboard();
        } else {
          throw rpcErr;
        }
      }

      // Ignora si no es el request más reciente o el componente se desmontó
      if (!aliveRef.current || myId !== requestIdRef.current) return;

      setData(result);
    } catch (err) {
      if (!aliveRef.current || myId !== requestIdRef.current) return;
      setError(err.message || 'Unknown error');
      toast({
        title: `Error fetching ${itemType} leaderboard`,
        description: err.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      if (aliveRef.current && myId === requestIdRef.current) setLoading(false);
    }
  }, [itemType, timeframe]);

  useEffect(() => {
    fetchLeaderboardData();
  }, [fetchLeaderboardData]);

  const getTitle = () => (itemType === 'music_video' ? 'Music Videos' : itemType.charAt(0).toUpperCase() + itemType.slice(1) + 's');

  return (
    <div className="mb-12">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4">
        <h2 className="text-2xl font-bold golden-text flex items-center mb-3 sm:mb-0">
          <Trophy className="w-6 h-6 mr-2 text-yellow-400" />
          Top {getTitle()}
        </h2>
        <div className="text-xs text-gray-400 glass-effect px-3 py-1 rounded-lg">
          Showing: {timeframe === 'all' ? 'All time' : timeframe.charAt(0).toUpperCase() + timeframe.slice(1)}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
        </div>
      )}

      {error && !loading && (
        <div className="flex flex-col items-center justify-center h-32 text-red-400 bg-red-500/10 rounded-lg">
          <AlertTriangle className="w-8 h-8 mb-2" />
          <p>Failed to load leaderboard.</p>
        </div>
      )}

      {!loading && !error && data.length === 0 && (
        <div className="flex items-center justify-center h-32 text-gray-400 bg-white/5 rounded-lg">
          <p>No leaderboard data available for this period.</p>
        </div>
      )}

      {!loading && !error && data.length > 0 && (
        <Carousel opts={{ align: 'start', loop: false }} className="w-full">
          <CarouselContent>
            {data.map((item, index) => (
              <CarouselItem key={item.id} className="md:basis-1/2 lg:basis-1/3">
                <div className="p-1">
                  <LeaderboardCard item={item} itemType={itemType} rank={index + 1} />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden sm:flex bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-yellow-300" />
          <CarouselNext className="hidden sm:flex bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-yellow-300" />
        </Carousel>
      )}
    </div>
  );
};

export default LeaderboardCarousel;
