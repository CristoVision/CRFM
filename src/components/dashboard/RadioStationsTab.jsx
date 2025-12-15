import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';
import { Radio, Loader2, Play, Pause } from 'lucide-react';
import { useUnauthenticatedRadio } from '@/components/player/UnauthenticatedRadio';

const StationCard = ({ station, isPlaying, onPlay, onPause }) => {
  const handlePlayClick = (e) => {
    e.stopPropagation();
    if (isPlaying) {
      onPause();
    } else {
      onPlay(station);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="glass-effect-hoverable p-5 rounded-xl cursor-pointer flex flex-col justify-between"
      onClick={() => onPlay(station)}
    >
      <div>
        <div className="flex items-start justify-between mb-3">
          <div className="p-3 bg-yellow-400/10 border border-yellow-400/20 rounded-lg">
            <Radio className="w-7 h-7 text-yellow-400" />
          </div>
        </div>
        <h3 className="text-xl font-bold text-white mb-1 group-hover:text-yellow-300 transition-colors">{station.name}</h3>
        <p className="text-sm text-gray-400 line-clamp-3">{station.description}</p>
      </div>
      <button
        onClick={handlePlayClick}
        className="mt-4 w-full golden-gradient text-black font-semibold hover:opacity-90 transition-opacity text-sm py-2.5 rounded-lg flex items-center justify-center proximity-glow-button"
      >
        {isPlaying ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
        {isPlaying ? 'Now Playing' : 'Listen Live'}
      </button>
    </motion.div>
  );
};

function RadioStationsTab({ searchQuery = '' }) {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const { playStation, pause, currentStation, isPlaying } = useUnauthenticatedRadio();

  useEffect(() => {
    const fetchStations = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('stations')
          .select('id, name, description, is_active')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setStations(data || []);
      } catch (error) {
        toast({
          title: 'Error fetching radio stations',
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStations();
  }, []);
  
  const safeSearchQuery = searchQuery || '';
  const filteredStations = stations.filter(station =>
    (station.name?.toLowerCase() || '').includes(safeSearchQuery.toLowerCase()) ||
    (station.description?.toLowerCase() || '').includes(safeSearchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <Loader2 className="w-16 h-16 text-yellow-400 animate-spin" />
      </div>
    );
  }

  return (
    <motion.div layout className="space-y-6">
      {filteredStations.length === 0 && !loading && (
        <div className="text-center py-12">
          <Radio className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">No radio stations found</p>
          <p className="text-gray-500">Try adjusting your search or check back later!</p>
        </div>
      )}

      <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filteredStations.map((station) => (
          <StationCard
            key={station.id}
            station={station}
            isPlaying={isPlaying && currentStation?.id === station.id}
            onPlay={playStation}
            onPause={pause}
          />
        ))}
      </motion.div>
    </motion.div>
  );
}

export default RadioStationsTab;
