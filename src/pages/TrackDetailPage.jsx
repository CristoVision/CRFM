import React, { useState, useEffect, useContext } from 'react';
    import { useParams, Link, useNavigate } from 'react-router-dom';
    import { supabase } from '@/lib/supabaseClient';
    import { toast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
import { usePlayer } from '@/contexts/PlayerContext';
import { QueueContext } from '@/contexts/QueueContext';
import { Play, Pause, Star, Flag, Music, Calendar, Tag, Languages, CheckCircle, XCircle, Brain, Palette, FileText, DollarSign, Disc as AlbumIcon, Coins, Loader2, Mic2, Share2 as ShareIcon, Eye, EyeOff } from 'lucide-react';
    import FlagFormModal from '@/components/common/FlagFormModal';
    import ShareModal from '@/components/ShareModal';
import { useAuth } from '@/contexts/AuthContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Helmet } from 'react-helmet-async';
import CoverArtMedia from '@/components/common/CoverArtMedia';

    const DEFAULT_COVER_ART = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YXVkaW98ZW58MHx8MHx8fDA%3D&w=1000&q=80';

    function TrackDetailPage() {
      const { id } = useParams();
      const navigate = useNavigate();
      const [track, setTrack] = useState(null);
      const [albumInfo, setAlbumInfo] = useState(null);
      const [loading, setLoading] = useState(true);
      const { currentTrack, isPlaying, playTrack, togglePlay, isProcessingPayment } = usePlayer();
      const queueContext = useContext(QueueContext);
const { user, profile, favorites, addFavorite, removeFavorite } = useAuth();

      const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);
      const [selectedContentForFlag, setSelectedContentForFlag] = useState(null);
      const [isShareModalOpen, setIsShareModalOpen] = useState(false);
      const [isFavorite, setIsFavorite] = useState(false);
const [loadingFavorite, setLoadingFavorite] = useState(false);
const [visibilityUpdating, setVisibilityUpdating] = useState(false);

      const isCurrentPlayingTrack = currentTrack?.id === track?.id;
      const isPaymentProcessingForThisTrack = isProcessingPayment && currentTrack?.id === track?.id;

      useEffect(() => {
        if (track && Array.isArray(favorites)) {
          setIsFavorite(favorites.some(fav => fav.content_type === 'track' && fav.content_id === track.id));
        }
      }, [favorites, track]);

      const handleToggleFavorite = async () => {
        if (!track) return;
        if (!user) {
          toast({ title: "Login Required", description: "Please log in to add to favorites.", variant: "destructive" });
          return;
        }
        if (loadingFavorite) return;

        if (typeof addFavorite !== 'function' || typeof removeFavorite !== 'function') {
            toast({ title: "Feature not available", description: "Favorites functionality is currently unavailable.", variant: "destructive" });
            return;
        }

        setLoadingFavorite(true);
        try {
          if (isFavorite) {
            await removeFavorite('track', track.id);
            toast({ title: "Removed from favorites", variant: 'success' });
          } else {
            await addFavorite('track', track.id);
            toast({ title: "Added to favorites", variant: 'success' });
          }
        } catch (error) {
          toast({ title: 'Error updating favorites', description: error.message, variant: 'destructive' });
        } finally {
          setLoadingFavorite(false);
        }
      };

const handleOpenFlagModal = () => {
  if (!user) {
    toast({ title: "Authentication Required", description: "Please log in to flag content.", variant: "destructive" });
    return;
  }
        if (!track) return;
        setSelectedContentForFlag({
          id: track.id,
          type: 'track',
          uploaderId: track.uploader_id,
          title: track.title,
        });
  setIsFlagModalOpen(true);
};

  const handleSetVisibility = async (isPublic) => {
    if (!profile?.is_admin || !track) return;
    setVisibilityUpdating(true);
    try {
      const { error } = await supabase.rpc('rpc_admin_set_content_visibility', {
        p_admin_id: profile.id,
        p_content_id: track.id,
        p_content_type: 'track',
        p_is_public: isPublic,
        p_reason: isPublic ? 'admin_make_public' : 'admin_hide',
      });
      if (error) throw error;
      setTrack(prev => prev ? { ...prev, is_public: isPublic } : prev);
      toast({
        title: isPublic ? 'Track is now public' : 'Track hidden',
        className: 'bg-green-600 text-white'
      });
    } catch (err) {
      toast({ title: 'Visibility update failed', description: err.message, variant: 'destructive' });
    } finally {
      setVisibilityUpdating(false);
    }
  };

      useEffect(() => {
        const fetchTrackAndAlbum = async () => {
          setLoading(true);
          try {
            const trackSelectFields = `
              id, title, creator_display_name, uploader_id, audio_file_url, genre, stream_cost, 
              is_public, album_id, created_at, updated_at, is_christian_nature, is_instrumental, 
              ai_in_production, ai_in_artwork, ai_in_lyrics, cover_art_url, video_cover_art_url, track_number_on_album, 
              release_date, languages, total_royalty_percentage_allocated, lyrics_text, 
              lrc_file_path, sub_genre, albums(id, title, video_cover_art_url, cover_art_url)
            `;
            const { data: trackData, error: trackError } = await supabase
              .from('tracks')
              .select(trackSelectFields) 
              .eq('id', id)
              .single();

            if (trackError) throw trackError;
            setTrack(trackData);

            if (trackData && trackData.album_id && trackData.albums) {
              setAlbumInfo(trackData.albums);
            } else if (trackData && trackData.album_id) {
              const { data: albumData, error: albumError } = await supabase
                .from('albums')
                .select('id, title')
                .eq('id', trackData.album_id)
                .single();
              if (albumError) console.warn("Error fetching album info separately:", albumError.message);
              else setAlbumInfo(albumData);
            }

          } catch (error) {
            console.error("Error fetching track details in TrackDetailPage:", error);
            toast({
              title: 'Error fetching track details',
              description: error.message,
              variant: 'destructive',
            });
            setTrack(null);
          } finally {
            setLoading(false);
          }
        };

        if (id) {
          fetchTrackAndAlbum();
        }
      }, [id]);

      const handleInitiatePlay = () => {
        if (!track || isPaymentProcessingForThisTrack) return;
        if (currentTrack?.id === track.id) {
          togglePlay(); 
        } else if (queueContext) {
          const enrichedTrack = {
            ...track,
            album_video_cover_art_url: track.albums?.video_cover_art_url || null,
            cover_art_url: track.cover_art_url || track.albums?.cover_art_url || track.cover_art_url,
          };
          queueContext.setPlaybackQueue([enrichedTrack], 0);
        }
      };
      
      const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      };

      const getLyricsPreview = (lyricsText) => {
        if (!lyricsText) return "No lyrics preview available.";
        const lines = lyricsText.split('\n');
        return lines.slice(0, 4).join('\n') + (lines.length > 4 ? '\n...' : '');
      };

      const DeclarationItem = ({ icon, label, value, isPositive = true }) => (
        <div className="flex items-center space-x-2 p-3 bg-white/5 rounded-lg">
          {React.cloneElement(icon, { className: `w-5 h-5 ${isPositive ? 'text-green-400' : 'text-red-400'}` })}
          <span className="text-sm text-gray-300">{label}:</span>
          <span className={`text-sm font-semibold ${isPositive ? 'text-green-300' : 'text-red-300'}`}>
            {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}
          </span>
        </div>
      );

      if (loading) {
        return (
          <div className="min-h-[calc(100vh-80px)] flex items-center justify-center">
            <Helmet>
                <title>Loading Track... - CRFM</title>
            </Helmet>
            <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        );
      }

      if (!track) {
        return (
          <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center text-center">
            <Helmet>
                <title>Track Not Found - CRFM</title>
            </Helmet>
            <Music className="w-24 h-24 text-gray-600 mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">Track Not Found</h1>
            <p className="text-gray-400 mb-6">The track you are looking for could not be found.</p>
            <Button asChild className="golden-gradient text-black font-semibold">
              <Link to="/">Go Back Home</Link>
            </Button>
          </div>
        );
      }

      return (
        <div className="container mx-auto px-4 py-12 pt-8">
          <Helmet>
            <title>{`${track.title} by ${track.creator_display_name} - CRFM`}</title>
            <meta name="description" content={`Listen to ${track.title} by ${track.creator_display_name} on CRFM. Genre: ${track.genre}. Released: ${formatDate(track.release_date)}.`} />
            <meta property="og:title" content={`${track.title} by ${track.creator_display_name} - CRFM`} />
            <meta property="og:description" content={`Listen to ${track.title} by ${track.creator_display_name} on CRFM.`} />
            <meta property="og:image" content={track.cover_art_url || DEFAULT_COVER_ART} />
            <meta property="og:type" content="music.song" />
            <meta property="og:url" content={window.location.href} />
            {track.audio_file_url && <meta property="og:audio" content={track.audio_file_url} />}
            {track.creator_display_name && <meta property="music:musician_description" content={track.creator_display_name} />}
            {albumInfo && albumInfo.title && <meta property="music:album:title" content={albumInfo.title} />}
            {track.track_number_on_album && albumInfo && <meta property="music:album:track" content={track.track_number_on_album.toString()} />}
          </Helmet>
          <div className="md:flex md:space-x-12 glass-effect-light p-6 sm:p-8 rounded-xl shadow-2xl">
            <div className="md:w-1/3 flex-shrink-0 mb-8 md:mb-0">
              <CoverArtMedia
                videoUrl={track.video_cover_art_url || albumInfo?.video_cover_art_url}
                imageUrl={track.cover_art_url || albumInfo?.cover_art_url || DEFAULT_COVER_ART}
                className="w-full aspect-square shadow-xl border-2 border-yellow-400/50"
                roundedClass="rounded-lg"
                showBadge={!!(track.video_cover_art_url || albumInfo?.video_cover_art_url)}
              />
              <div className="flex items-center space-x-2 mt-6">
                <Button 
                  onClick={handleInitiatePlay}
                  className="w-full golden-gradient text-black font-bold py-3 text-lg hover:opacity-90 transition-opacity flex items-center justify-center"
                  disabled={isPaymentProcessingForThisTrack}
                >
                  {isPaymentProcessingForThisTrack ? 
                    <Loader2 className="w-6 h-6 mr-2 animate-spin" /> : 
                    (isCurrentPlayingTrack && isPlaying ? <Pause className="w-6 h-6 mr-2" /> : <Play className="w-6 h-6 mr-2" />)
                  }
                  {isPaymentProcessingForThisTrack ? 'Processing...' : (isCurrentPlayingTrack && isPlaying ? 'Pause' : 'Play Track')}
                </Button>
                {track.stream_cost > 0 && (
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center justify-center p-3 h-[48px] bg-yellow-400/20 text-yellow-300 rounded-md cursor-default">
                           <Coins className="w-5 h-5 mr-1.5 flex-shrink-0" />
                           <span className="font-semibold">{track.stream_cost}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Cost per play: {track.stream_cost} CrossCoins</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4">
                <Button 
                    variant="outline" 
                    className={`w-full bg-white/10 border-white/20 text-white hover:bg-white/20 ${isFavorite ? 'border-yellow-400 text-yellow-400' : ''}`}
                    onClick={handleToggleFavorite}
                    disabled={!user || loadingFavorite}
                    title={isFavorite ? "Favorited" : "Favorite"}
                >
                  {loadingFavorite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className={`w-4 h-4 ${isFavorite ? 'text-yellow-400 fill-current' : 'text-gray-400'}`} />} 
                </Button>
                <Button onClick={() => setIsShareModalOpen(true)} variant="outline" className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20" title="Share">
                  <ShareIcon className="w-4 h-4 text-blue-400" />
                </Button>
        <Button onClick={handleOpenFlagModal} variant="outline" className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20" title="Report">
          <Flag className="w-4 h-4 text-yellow-400" />
        </Button>
        {profile?.is_admin && (
          <>
            <Button
              onClick={() => handleSetVisibility(false)}
              variant="outline"
              className="w-full bg-red-500/10 border-red-500/40 text-red-200 hover:bg-red-500/20"
              disabled={visibilityUpdating}
              title="Hide track"
            >
              <EyeOff className="w-4 h-4 mr-1" />
            </Button>
            <Button
              onClick={() => handleSetVisibility(true)}
              variant="outline"
              className="w-full bg-emerald-500/10 border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/20"
              disabled={visibilityUpdating}
              title="Make track public"
            >
              <Eye className="w-4 h-4 mr-1" />
            </Button>
          </>
        )}
      </div>
            </div>

            <div className="md:w-2/3">
              <h1 className="text-4xl sm:text-5xl font-bold golden-text mb-2">{track.title}</h1>
              {track.uploader_id && (
                <Link to={`/creator/${track.uploader_id}`} className="text-xl text-gray-300 hover:text-yellow-400 transition-colors mb-1 block">
                  {track.creator_display_name}
                </Link>
              )}
              {albumInfo && albumInfo.id && (
                <Link to={`/album/${albumInfo.id}`} className="text-md text-gray-400 hover:text-yellow-300 transition-colors mb-6 block flex items-center">
                  <AlbumIcon className="w-4 h-4 mr-2" /> From album: {albumInfo.title}
                </Link>
              )}


              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="flex items-center space-x-2 p-3 bg-white/5 rounded-lg">
                  <Tag className="w-5 h-5 text-yellow-400" />
                  <span className="text-sm text-gray-300">Genre:</span>
                  <span className="text-sm font-semibold text-white">{track.genre || 'N/A'}</span>
                </div>
                <div className="flex items-center space-x-2 p-3 bg-white/5 rounded-lg">
                  <Calendar className="w-5 h-5 text-yellow-400" />
                  <span className="text-sm text-gray-300">Released:</span>
                  <span className="text-sm font-semibold text-white">{formatDate(track.release_date)}</span>
                </div>
                <div className="flex items-center space-x-2 p-3 bg-white/5 rounded-lg col-span-1 sm:col-span-2">
                  <Languages className="w-5 h-5 text-yellow-400" />
                  <span className="text-sm text-gray-300">Language(s):</span>
                  <span className="text-sm font-semibold text-white">{(track.languages && track.languages.length > 0) ? track.languages.join(', ') : 'N/A'}</span>
                </div>
              </div>
              
              <h2 className="text-2xl font-semibold text-white mt-8 mb-4">Content Declarations</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                <DeclarationItem icon={<CheckCircle />} label="Christian Nature" value={track.is_christian_nature} isPositive={track.is_christian_nature}/>
                <DeclarationItem icon={<Mic2 />} label="Instrumental" value={track.is_instrumental} isPositive={track.is_instrumental}/>
                <DeclarationItem icon={<Palette />} label="AI in Artwork" value={track.ai_in_artwork} isPositive={!track.ai_in_artwork}/>
                <DeclarationItem icon={<Brain />} label="AI in Production" value={track.ai_in_production} isPositive={!track.ai_in_production}/>
                <DeclarationItem icon={<FileText />} label="AI in Lyrics" value={track.ai_in_lyrics} isPositive={!track.ai_in_lyrics}/>
              </div>

              {track.stream_cost != null && track.stream_cost > 0 && (
                 <div className="flex items-center space-x-2 p-3 bg-yellow-400/10 rounded-lg mb-6">
                  <DollarSign className="w-5 h-5 text-yellow-300" />
                  <span className="text-sm text-yellow-200">Stream Cost:</span>
                  <span className="text-sm font-semibold text-yellow-100">{track.stream_cost} CrossCoins</span>
                </div>
              )}

              <h2 className="text-2xl font-semibold text-white mt-8 mb-4">Lyrics Preview</h2>
              <div className="p-4 bg-white/5 rounded-lg whitespace-pre-wrap text-gray-300 text-sm leading-relaxed max-h-40 overflow-y-auto lyrics-container mb-4">
                {getLyricsPreview(track.lyrics_text)}
              </div>
              <Button variant="outline" className="w-full sm:w-auto bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={() => toast({ title: "Feature Coming Soon!", description: "Full lyrics view will be available soon."})}>
                View Full Lyrics (Soon)
              </Button>
            </div>
          </div>
          {selectedContentForFlag && (
            <FlagFormModal
              isOpen={isFlagModalOpen}
              onOpenChange={setIsFlagModalOpen}
              contentId={selectedContentForFlag.id}
              contentType={selectedContentForFlag.type}
              originalUploaderId={selectedContentForFlag.uploaderId}
              contentTitle={selectedContentForFlag.title}
            />
          )}
          {track && (
            <ShareModal
              entityType="track"
              entityId={track.id}
              isOpen={isShareModalOpen}
              onClose={() => setIsShareModalOpen(false)}
            />
          )}
        </div>
      );
    }

    export default TrackDetailPage;
