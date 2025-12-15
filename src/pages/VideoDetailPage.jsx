import React, { useState, useEffect } from 'react';
    import { useParams, useNavigate } from 'react-router-dom';
    import { supabase } from '@/lib/supabaseClient';
    import { useAuth } from '@/contexts/AuthContext';
    import { usePlayer } from '@/contexts/PlayerContext';
    import { useVideoPlayer } from '@/contexts/VideoPlayerContext';
    import { Button } from '@/components/ui/button';
    import { Badge } from '@/components/ui/badge';
    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    import { Heart, Share2, PlayCircle, Loader2, AlertTriangle, Calendar, DollarSign, User, Tag, Languages as LanguagesIcon } from 'lucide-react';
    import { toast } from '@/components/ui/use-toast';
    import ShareModal from '@/components/ShareModal';
    import { Helmet } from 'react-helmet-async';
    import { motion } from 'framer-motion';

    const DEFAULT_COVER_ART = 'https://images.unsplash.com/photo-1516280440614-3793959696b4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTV8fHZpZGVvfGVufDB8fDB8fHww&w=1000&q=80';

    const VideoDetailPage = () => {
      const { id: videoId } = useParams();
      const navigate = useNavigate();
      const { user, favorites, addFavorite, removeFavorite, spendCrossCoinsForVideo } = useAuth();
      const { pause } = usePlayer();
      const { playVideo } = useVideoPlayer();
      const [video, setVideo] = useState(null);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);
      const [isFavorited, setIsFavorited] = useState(false);
      const [loadingFavorite, setLoadingFavorite] = useState(false);
      const [isShareModalOpen, setIsShareModalOpen] = useState(false);
      const [loadingPlay, setLoadingPlay] = useState(false);

      useEffect(() => {
        const fetchVideo = async () => {
          if (!videoId) return;
          setLoading(true);
          setError(null);
          try {
            const { data, error: fetchError } = await supabase
              .from('videos')
              .select(`
                id, 
                title, 
                description, 
                storage_path, 
                cover_art_url, 
                uploader_id, 
                created_at, 
                language,
                cost_cc, 
                is_public,
                profiles (id, username, avatar_url)
              `)
              .eq('id', videoId)
              .eq('is_public', true) 
              .single();

            if (fetchError) throw fetchError;
            if (!data) throw new Error('Video not found or not public.');
            
            setVideo({
              ...data,
              creator_display_name: data.profiles?.username || 'Unknown Creator',
              creator_avatar_url: data.profiles?.avatar_url,
              creator_id: data.profiles?.id,
            });
          } catch (err) {
            console.error("Error fetching video:", err);
            setError(err.message);
            toast({ title: "Error", description: `Could not load video: ${err.message}`, variant: "destructive" });
          } finally {
            setLoading(false);
          }
        };

        fetchVideo();
      }, [videoId]);

      useEffect(() => {
        if (video?.id && Array.isArray(favorites)) {
          setIsFavorited(favorites.some(fav => fav.content_type === 'video' && fav.content_id === video.id));
        } else {
          setIsFavorited(false);
        }
      }, [favorites, video]);

      const handleToggleFavorite = async () => {
        if (!user || !video || loadingFavorite) return;
        if (typeof addFavorite !== 'function' || typeof removeFavorite !== 'function') {
          toast({ title: "Feature not available", description: "Favorites functionality is currently unavailable.", variant: "destructive" });
          return;
        }
        setLoadingFavorite(true);
        try {
          if (isFavorited) {
            await removeFavorite('video', video.id);
            toast({ title: "Removed from favorites", variant: "success" });
          } else {
            await addFavorite('video', video.id);
            toast({ title: "Added to favorites", variant: "success" });
          }
        } catch (err) {
          toast({ title: "Error updating favorites", description: err.message, variant: "destructive" });
        } finally {
          setLoadingFavorite(false);
        }
      };
      
      const handlePlayVideo = async () => {
        if (!user || !video || loadingPlay) return;
        setLoadingPlay(true);

        // Pause any playing music/queue audio before starting video playback
        try { pause?.(); } catch { /* noop */ }

        const cost = Number(video.cost_cc ?? 0);
        if (cost > 0 && typeof spendCrossCoinsForVideo === 'function') {
          const { success, error } = await spendCrossCoinsForVideo(video.id, cost);
          if (!success) {
            toast({
              title: "Cannot start playback",
              description: error || `You need ${cost} CrossCoins to watch this video.`,
              variant: "destructive",
            });
            setLoadingPlay(false);
            return;
          }
        }

        playVideo(video);
        setLoadingPlay(false);
      };


      if (loading) {
        return (
          <div className="min-h-screen gradient-bg flex items-center justify-center">
            <Loader2 className="w-16 h-16 text-yellow-400 animate-spin" />
          </div>
        );
      }

      if (error || !video) {
        return (
          <div className="min-h-screen gradient-bg flex flex-col items-center justify-center text-white p-4">
            <AlertTriangle className="w-20 h-20 text-red-500 mb-6" />
            <h1 className="text-3xl font-bold mb-2">Video Not Found</h1>
            <p className="text-red-300 text-center mb-6">{error || "The requested music video could not be found or is not public."}</p>
            <Button onClick={() => navigate('/')} className="golden-gradient text-black">
              Go to Home
            </Button>
          </div>
        );
      }

      return (
        <>
          <Helmet>
            <title>{`${video?.title || 'Music Video'} - CRFM`}</title>
            <meta name="description" content={video?.description?.substring(0, 160) || `Watch the music video ${video?.title || ''} on CRFM.`} />
          </Helmet>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-screen gradient-deep-bg text-white py-8 px-4 md:px-8"
          >
            <div className="container mx-auto max-w-5xl">
              <div className="mb-8">
                <Button variant="outline" onClick={() => navigate(-1)} className="text-gray-300 border-gray-600 hover:bg-gray-700 hover:text-white">
                  &larr; Back
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="md:col-span-2"
                >
                  <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-yellow-500/30">
                    <div className="w-full h-full relative flex items-center justify-center">
                      <img  
                          src={video.cover_art_url || DEFAULT_COVER_ART} 
                          alt={`Cover art for ${video.title}`} 
                          className="absolute inset-0 w-full h-full object-cover opacity-50"
                      />
                      <Button 
                          onClick={handlePlayVideo} 
                          disabled={loadingPlay || !user}
                          className="relative z-10 golden-gradient text-black text-lg px-8 py-4 rounded-full shadow-lg hover:scale-105 transition-transform"
                      >
                          {loadingPlay ? <Loader2 className="w-6 h-6 mr-2 animate-spin" /> : <PlayCircle className="w-6 h-6 mr-2" />}
                          Watch Video
                      </Button>
                    </div>
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="md:col-span-1 space-y-6 p-6 bg-slate-800/50 rounded-xl shadow-xl border border-slate-700/50"
                >
                  <div>
                    <h1 className="text-3xl font-bold golden-text break-words">{video.title || "Untitled Video"}</h1>
                    <Badge variant="secondary" className="mt-2 bg-yellow-500 text-black text-xs font-semibold">
                      Music Video
                    </Badge>
                  </div>
                  
                  <div className="flex items-center space-x-3 cursor-pointer" onClick={() => video.creator_id && navigate(`/creator/${video.creator_id}`)}>
                    <Avatar className="w-12 h-12 border-2 border-yellow-400/70">
                      <AvatarImage src={video.creator_avatar_url || `https://avatar.vercel.sh/${video.creator_display_name}.png?text=CR`} alt={video.creator_display_name} />
                      <AvatarFallback>{video.creator_display_name?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm text-gray-400">Created by</p>
                      <p className="text-lg font-semibold text-yellow-300 hover:underline">{video.creator_display_name}</p>
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    <Button
                      onClick={handleToggleFavorite}
                      variant="outline"
                      className={`flex-1 ${isFavorited ? 'border-red-500 text-red-500 hover:bg-red-500/10' : 'border-gray-600 text-gray-300 hover:bg-gray-700/50'}`}
                      disabled={loadingFavorite || !user}
                    >
                      {loadingFavorite ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Heart className={`w-4 h-4 mr-2 ${isFavorited ? 'fill-current' : ''}`} />}
                      {isFavorited ? 'Favorited' : 'Add to Favorites'}
                    </Button>
                    <Button 
                      onClick={() => setIsShareModalOpen(true)} 
                      variant="outline" 
                      className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700/50"
                    >
                      <Share2 className="w-4 h-4 mr-2" /> Share
                    </Button>
                  </div>

                  {!user && (
                     <div className="mt-2 text-xs text-orange-400 flex items-center justify-center p-3 bg-orange-500/10 rounded-md border border-orange-500/30">
                        <AlertTriangle className="w-4 h-4 mr-1.5 flex-shrink-0" />
                        <span>Login required to watch, favorite, or share.</span>
                    </div>
                  )}

                  {video.cost_cc > 0 && (
                    <div className="flex items-center text-yellow-400 p-3 bg-yellow-500/10 rounded-md border border-yellow-500/30">
                      <DollarSign className="w-5 h-5 mr-2" />
                      <span className="text-sm">This video costs {video.cost_cc} CrossCoin{video.cost_cc !== 1 && 's'} to watch.</span>
                    </div>
                  )}
                </motion.div>
              </div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-10 p-6 bg-slate-800/50 rounded-xl shadow-xl border border-slate-700/50"
              >
                <h2 className="text-2xl font-semibold mb-4 text-slate-100">Video Details</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start">
                    <strong className="w-32 text-gray-400 shrink-0 flex items-center"><User className="w-4 h-4 mr-2 text-yellow-400/70"/>Artist:</strong>
                    <span className="text-gray-200">{video.creator_display_name}</span>
                  </div>
                  <div className="flex items-start">
                    <strong className="w-32 text-gray-400 shrink-0 flex items-center"><Calendar className="w-4 h-4 mr-2 text-yellow-400/70"/>Published:</strong>
                    <span className="text-gray-200">{new Date(video.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                   {video.language && (
                      <div className="flex items-start">
                        <strong className="w-32 text-gray-400 shrink-0 flex items-center"><LanguagesIcon className="w-4 h-4 mr-2 text-yellow-400/70"/>Language:</strong>
                        <span className="text-gray-200">{video.language}</span>
                      </div>
                    )}
                  <div className="flex items-start">
                    <strong className="w-32 text-gray-400 shrink-0 flex items-center"><Tag className="w-4 h-4 mr-2 text-yellow-400/70"/>Description:</strong>
                    <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{video.description || "No description available."}</p>
                  </div>
                </div>
              </motion.div>

            </div>
          </motion.div>
          {video && (
            <ShareModal
              isOpen={isShareModalOpen}
              onClose={() => setIsShareModalOpen(false)}
              entityType="video"
              entityId={video.id}
            />
          )}
        </>
      );
    };

    export default VideoDetailPage;
