import React, { useState, useEffect, useCallback } from 'react';
    import { supabase } from '@/lib/supabaseClient';
    import { useAuth } from '@/contexts/AuthContext';
    import { toast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { Edit2, FileText, Search, Loader2, Music } from 'lucide-react';
    import LrcEditorModal from './LrcEditorModal';
    import { Input } from '@/components/ui/input';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import { motion, AnimatePresence } from 'framer-motion';
    import { pickImageFallback } from '@/lib/mediaFallbacks';

    const DEFAULT_TRACK_COVER = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fG11c2ljJTIwYWxidW18ZW58MHx8MHx8fDA%3D&w=1000&q=80'; // A generic music image

    const HubLyricsTab = () => {
      const { user } = useAuth();
      const [allUserTracks, setAllUserTracks] = useState([]);
      const [loading, setLoading] = useState(true);
      const [searchQuery, setSearchQuery] = useState('');
      const [selectedTrackForEditor, setSelectedTrackForEditor] = useState(null);
      const [currentTrackIndex, setCurrentTrackIndex] = useState(null);
      const [isEditorOpen, setIsEditorOpen] = useState(false);

      const fetchTracksWithLyricsInfo = useCallback(async () => {
        if (!user) {
          setLoading(false);
          setAllUserTracks([]);
          return;
        }
        setLoading(true);
        try {
          const { data, error } = await supabase
            .from('tracks')
            .select('id, title, cover_art_url, video_cover_art_url, uploader_id, lrc_file_path, lyrics_text, audio_file_url')
            .eq('uploader_id', user.id)
            .order('title', { ascending: true });

          if (error) throw error;
          setAllUserTracks(data || []);
        } catch (error) {
          toast({ title: 'Error fetching your tracks', description: error.message, variant: 'destructive' });
          setAllUserTracks([]);
        } finally {
          setLoading(false);
        }
      }, [user]);

      useEffect(() => {
        fetchTracksWithLyricsInfo();
      }, [fetchTracksWithLyricsInfo]);

      const handleEditLyrics = (track, index) => {
        setSelectedTrackForEditor(track);
        setCurrentTrackIndex(index);
        setIsEditorOpen(true);
      };
      
      const handleLyricsUpdated = (updatedTrack) => {
        setAllUserTracks(prevTracks => prevTracks.map(t => t.id === updatedTrack.id ? updatedTrack : t));
        // Update selectedTrackForEditor if it's the one being edited
        if (selectedTrackForEditor && selectedTrackForEditor.id === updatedTrack.id) {
            setSelectedTrackForEditor(updatedTrack);
        }
      };

      const handleSwitchTrackInEditor = (newIndex) => {
        if (newIndex >= 0 && newIndex < filteredTracks.length) {
            const newTrackToEdit = filteredTracks[newIndex];
            setSelectedTrackForEditor(newTrackToEdit);
            setCurrentTrackIndex(newIndex);
            // The modal will re-initialize with the new track prop
        } else {
            toast({title: "Track Switch Error", description: "Cannot switch to the requested track.", variant: "destructive"});
        }
      };


      const filteredTracks = allUserTracks.filter(track =>
        (track.title?.toLowerCase() || '').includes(searchQuery.toLowerCase())
      );

      if (loading) {
        return <div className="flex justify-center items-center min-h-[40vh]"><Loader2 className="w-16 h-16 animate-spin text-yellow-400" /></div>;
      }

      return (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="relative w-full sm:max-w-xs">
              <Input 
                type="search" 
                placeholder="Search tracks for lyrics editing..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 focus:border-yellow-400 text-white placeholder-gray-500"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            </div>
            <p className="text-sm text-gray-400">Found {filteredTracks.length} track(s)</p>
          </div>

          {filteredTracks.length === 0 ? (
            <div className="text-center py-12 glass-effect rounded-xl">
              <FileText className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-300 text-lg mb-2">No tracks found for lyrics editing.</p>
              <p className="text-gray-400 text-sm">
                {searchQuery ? "Try adjusting your search query." : "Upload tracks in the 'Content' tab to edit their lyrics."}
              </p>
            </div>
          ) : (
            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              <AnimatePresence>
                {filteredTracks.map((track, index) => (
                  <motion.div
                    key={track.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card className="h-full flex flex-col glass-effect-hoverable">
                      <CardHeader className="p-4">
                        <div className="aspect-square w-full rounded-md overflow-hidden mb-3 relative bg-black/20">
                          <img 
                            src={pickImageFallback([track.cover_art_url], DEFAULT_TRACK_COVER)}
                            alt={track.title || 'Track artwork'}
                            className="w-full h-full object-cover"
                          />
                           {!track.cover_art_url && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Music className="w-1/2 h-1/2 text-gray-500 opacity-50" />
                            </div>
                          )}
                          {track.lrc_file_path && (
                            <div className="absolute top-2 right-2 bg-green-500/80 text-white text-xs px-2 py-1 rounded-full flex items-center shadow-md">
                              <FileText size={12} className="mr-1"/> Synced
                            </div>
                          )}
                        </div>
                        <CardTitle className="text-lg truncate golden-text" title={track.title}>{track.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 flex-grow flex flex-col justify-end">
                        <Button 
                          onClick={() => handleEditLyrics(track, index)} 
                          className="w-full golden-gradient text-black font-semibold hover:opacity-90 transition-opacity proximity-glow-button"
                        >
                          <Edit2 className="w-4 h-4 mr-2" /> Edit Lyrics
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
          
          {selectedTrackForEditor && (
            <LrcEditorModal
              isOpen={isEditorOpen}
              onOpenChange={setIsEditorOpen}
              track={selectedTrackForEditor}
              allTracks={filteredTracks} 
              currentTrackIndexInList={currentTrackIndex}
              onLyricsUpdated={handleLyricsUpdated}
              onSwitchTrack={handleSwitchTrackInEditor}
            />
          )}
        </div>
      );
    };

    export default HubLyricsTab;
