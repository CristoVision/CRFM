import React, { useState, useEffect, useContext } from 'react';
    import { useParams, Link, useNavigate } from 'react-router-dom';
    import { supabase } from '@/lib/supabaseClient';
    import { toast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
import { usePlayer } from '@/contexts/PlayerContext';
import { QueueContext } from '@/contexts/QueueContext';
import { Play, Pause, Heart, Flag, ListMusic, Calendar, Languages, User, Music, Globe, Lock, Share2 as ShareIcon, Eye, EyeOff } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import FlagFormModal from '@/components/common/FlagFormModal';
import ShareModal from '@/components/ShareModal';
import { useAuth } from '@/contexts/AuthContext';
import CoverArtMedia from '@/components/common/CoverArtMedia';
import { useLanguage } from '@/contexts/LanguageContext';

    const DEFAULT_PLAYLIST_COVER = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8bXVzaWMlMjBwbGF5bGlzdHxlbnwwfHwwfHx8MA%3D%3D&w=1000&q=80';
    const DEFAULT_TRACK_COVER = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YXVkaW98ZW58MHx8MHx8fDA%3D&w=1000&q=80';

    function PlaylistDetailPage() {
      const { id } = useParams();
      const navigate = useNavigate();
      const { t, language } = useLanguage();
      const [playlist, setPlaylist] = useState(null);
      const [tracks, setTracks] = useState([]);
      const [creatorProfile, setCreatorProfile] = useState(null);
      const [loading, setLoading] = useState(true);
      const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayer();
      const queueContext = useContext(QueueContext);
const { user, profile } = useAuth();

      const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);
      const [selectedContentForFlag, setSelectedContentForFlag] = useState(null);
const [isShareModalOpen, setIsShareModalOpen] = useState(false);
const [visibilityUpdating, setVisibilityUpdating] = useState(false);

const handleOpenFlagModal = () => {
  if (!user) {
    toast({ title: t('playlistDetail.toasts.authRequiredTitle'), description: t('playlistDetail.toasts.authRequiredBody'), variant: "destructive" });
    return;
  }
        if (!playlist) return;
        setSelectedContentForFlag({
          id: playlist.id,
          type: 'playlist',
          uploaderId: playlist.creator_id,
          title: playlist.title,
        });
  setIsFlagModalOpen(true);
};

  const handleSetVisibility = async (isPublic) => {
    if (!profile?.is_admin || !playlist) return;
    setVisibilityUpdating(true);
    try {
      const { error } = await supabase.rpc('rpc_admin_set_content_visibility', {
        p_admin_id: profile.id,
        p_content_id: playlist.id,
        p_content_type: 'playlist',
        p_is_public: isPublic,
        p_reason: isPublic ? 'admin_make_public' : 'admin_hide',
      });
      if (error) throw error;
      setPlaylist(prev => prev ? { ...prev, is_public: isPublic } : prev);
      toast({ title: isPublic ? t('playlistDetail.toasts.playlistPublic') : t('playlistDetail.toasts.playlistHidden'), className: 'bg-green-600 text-white' });
    } catch (err) {
      toast({ title: t('playlistDetail.toasts.visibilityFailed'), description: err.message, variant: 'destructive' });
    } finally {
      setVisibilityUpdating(false);
    }
  };

      useEffect(() => {
        const fetchPlaylistDetails = async () => {
          setLoading(true);
          try {
            const { data: playlistData, error: playlistError } = await supabase
              .from('playlists')
              .select('id, title, description, cover_art_url, video_cover_art_url, created_at, creator_id, is_public, languages, profiles(id, username, avatar_url)') 
              .eq('id', id)
              .single();

            if (playlistError) throw playlistError;
            setPlaylist(playlistData);
            if (playlistData && playlistData.profiles) {
              setCreatorProfile(playlistData.profiles);
            }
            
            const { data: playlistTracksData, error: playlistTracksError } = await supabase
              .from('playlist_tracks')
              .select('order_in_playlist, tracks(id, title, creator_display_name, cover_art_url, video_cover_art_url, stream_cost, albums(id, title, video_cover_art_url, cover_art_url))') 
              .eq('playlist_id', id)
              .order('order_in_playlist', { ascending: true });

            if (playlistTracksError) throw playlistTracksError;
            
            const fetchedTracks = playlistTracksData ? playlistTracksData.map(pt => ({...pt.tracks, order_in_playlist: pt.order_in_playlist})).filter(t => t.id) : [];
            setTracks(fetchedTracks);

          } catch (error) {
            console.error("Error fetching playlist details:", error);
            toast({
              title: t('playlistDetail.toasts.fetchErrorTitle'),
              description: error.message,
              variant: 'destructive',
            });
            setPlaylist(null);
            setTracks([]);
          } finally {
            setLoading(false);
          }
        };

        if (id) {
          fetchPlaylistDetails();
        }
      }, [id, t]);

      const handlePlayPlaylist = () => {
        if (!playlist || tracks.length === 0 || !queueContext) return;
        const queueReady = tracks.map(t => ({ ...t, album_id: playlist.id, playlist_video_cover_art_url: playlist.video_cover_art_url || null, cover_art_url: t.cover_art_url || playlist.cover_art_url }));
        if (currentTrack?.id === tracks[0].id && currentTrack.album_id === playlist.id) {
          togglePlay();
        } else {
          queueContext.setPlaybackQueue(queueReady, 0);
        }
      };
      
      const handlePlaySingleTrack = (trackToPlay) => {
        if (!queueContext) return;
        if (currentTrack?.id === trackToPlay.id && currentTrack.album_id === playlist.id) {
          togglePlay();
        } else {
          const trackIndex = tracks.findIndex(t => t.id === trackToPlay.id);
          if (trackIndex === -1) return;
          const queueReady = tracks.map(t => ({ ...t, album_id: playlist.id, playlist_video_cover_art_url: playlist.video_cover_art_url || null, cover_art_url: t.cover_art_url || playlist.cover_art_url }));
          queueContext.setPlaybackQueue(queueReady, trackIndex);
        }
      };

      const formatDate = (dateString) => {
        if (!dateString) return t('common.na');
        return new Date(dateString).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      };

      const isPlaylistPlaying = () => {
        if (!isPlaying || !currentTrack || tracks.length === 0) return false;
        return tracks.some(track => track.id === currentTrack.id && currentTrack.album_id === playlist.id);
      };

      if (loading) {
        return (
          <div className="min-h-[calc(100vh-80px)] flex items-center justify-center">
            <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        );
      }

      if (!playlist) {
        return (
          <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center text-center">
            <ListMusic className="w-24 h-24 text-gray-600 mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">{t('playlistDetail.notFoundHeading')}</h1>
            <p className="text-gray-400 mb-6">{t('playlistDetail.notFoundBody')}</p>
            <Button asChild className="golden-gradient text-black font-semibold">
              <Link to="/">{t('playlistDetail.backHome')}</Link>
            </Button>
          </div>
        );
      }

      return (
        <div className="container mx-auto px-4 py-12 pt-8">
          <div className="md:flex md:space-x-12 glass-effect-light p-6 sm:p-8 rounded-xl shadow-2xl">
            <div className="md:w-1/3 flex-shrink-0 mb-8 md:mb-0">
              <CoverArtMedia
                videoUrl={playlist.video_cover_art_url}
                imageUrl={playlist.cover_art_url || DEFAULT_PLAYLIST_COVER}
                className="w-full aspect-square shadow-xl border-2 border-yellow-400/50"
                roundedClass="rounded-lg"
                showBadge={!!playlist.video_cover_art_url}
              />
              <Button 
                onClick={handlePlayPlaylist}
                disabled={tracks.length === 0}
                className="w-full mt-6 golden-gradient text-black font-bold py-3 text-lg hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-50"
              >
                {isPlaylistPlaying() ? <Pause className="w-6 h-6 mr-2" /> : <Play className="w-6 h-6 mr-2" />}
                {isPlaylistPlaying() ? t('playlistDetail.player.pausePlaylist') : (tracks.length > 0 ? t('playlistDetail.player.playPlaylist') : t('playlistDetail.player.noTracks'))}
              </Button>
              <div className="grid grid-cols-3 gap-2 mt-4">
                <Button variant="outline" className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20" title={t('playlistDetail.actions.favoriteSoon')}>
                  <Heart className="w-4 h-4 text-red-400" />
                </Button>
                <Button onClick={() => setIsShareModalOpen(true)} variant="outline" className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20" title={t('playlistDetail.actions.share')}>
                  <ShareIcon className="w-4 h-4 text-blue-400" />
                </Button>
                <Button onClick={handleOpenFlagModal} variant="outline" className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20" title={t('playlistDetail.actions.report')}>
                  <Flag className="w-4 h-4 text-yellow-400" />
                </Button>
                {profile?.is_admin && (
                  <>
                    <Button
                      onClick={() => handleSetVisibility(false)}
                      variant="outline"
                      className="w-full bg-red-500/10 border-red-500/40 text-red-200 hover:bg-red-500/20"
                      disabled={visibilityUpdating}
                      title={t('playlistDetail.actions.hidePlaylist')}
                    >
                      <EyeOff className="w-4 h-4 mr-1" />
                    </Button>
                    <Button
                      onClick={() => handleSetVisibility(true)}
                      variant="outline"
                      className="w-full bg-emerald-500/10 border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/20"
                      disabled={visibilityUpdating}
                      title={t('playlistDetail.actions.makePublic')}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="md:w-2/3">
              <h1 className="text-4xl sm:text-5xl font-bold golden-text mb-2">{playlist.title}</h1>
              {creatorProfile && (
                <Link to={`/creator/${creatorProfile.id}`} className="flex items-center space-x-2 text-lg text-gray-300 hover:text-yellow-400 transition-colors mb-1">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={creatorProfile.avatar_url || `https://avatar.vercel.sh/${creatorProfile.username}.png?text=${creatorProfile.username?.charAt(0).toUpperCase() || 'C'}`} />
                    <AvatarFallback>{creatorProfile.username ? creatorProfile.username.charAt(0).toUpperCase() : <User />}</AvatarFallback>
                  </Avatar>
                  <span>{creatorProfile.username || t('playlistDetail.labels.unknownCreator')}</span>
                </Link>
              )}
              <p className="text-gray-400 mb-6 text-sm">{playlist.description || t('playlistDetail.labels.noDescription')}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="flex items-center space-x-2 p-3 bg-white/5 rounded-lg">
                  {playlist.is_public ? <Globe className="w-5 h-5 text-green-400" /> : <Lock className="w-5 h-5 text-gray-400" />}
                  <span className="text-sm text-gray-300">{t('playlistDetail.labels.visibility')}</span>
                  <span className={`text-sm font-semibold ${playlist.is_public ? 'text-green-300' : 'text-gray-300'}`}>{playlist.is_public ? t('playlistDetail.labels.public') : t('playlistDetail.labels.private')}</span>
                </div>
                <div className="flex items-center space-x-2 p-3 bg-white/5 rounded-lg">
                  <Calendar className="w-5 h-5 text-yellow-400" />
                  <span className="text-sm text-gray-300">{t('playlistDetail.labels.created')}</span>
                  <span className="text-sm font-semibold text-white">{formatDate(playlist.created_at)}</span>
                </div>
                {playlist.languages && playlist.languages.length > 0 && (
                  <div className="flex items-center space-x-2 p-3 bg-white/5 rounded-lg col-span-1 sm:col-span-2">
                    <Languages className="w-5 h-5 text-yellow-400" />
                    <span className="text-sm text-gray-300">{t('playlistDetail.labels.languages')}</span>
                    <span className="text-sm font-semibold text-white">{playlist.languages.join(', ')}</span>
                  </div>
                )}
              </div>
              
              <h2 className="text-2xl font-semibold text-white mt-8 mb-4 flex items-center">
                <Music className="w-6 h-6 mr-3 text-yellow-400" /> {t('playlistDetail.labels.tracksInPlaylist')}
              </h2>
              {tracks.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto lyrics-container pr-2">
                  {tracks.map((track, index) => (
                    <div key={track.id} className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors group">
                      <div className="flex items-center space-x-3 flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/track/${track.id}`)}>
                        <span className="text-sm text-gray-400 w-6 text-right">{track.order_in_playlist || index + 1}.</span>
                        <img src={track.cover_art_url || DEFAULT_TRACK_COVER} alt={track.title} className="w-10 h-10 rounded object-cover"/>
                        <div className="flex-1 min-w-0">
                           <p className="text-base font-medium text-white truncate group-hover:text-yellow-400">
                            {track.title}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{track.creator_display_name}</p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-gray-400 hover:text-yellow-400 group-hover:opacity-100 opacity-70 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); handlePlaySingleTrack(track);}}
                      >
                        {currentTrack?.id === track.id && currentTrack.album_id === playlist.id && isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 p-4 bg-white/5 rounded-lg text-center">{t('playlistDetail.labels.noPublicTracks')}</p>
              )}
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
          {playlist && (
            <ShareModal
              entityType="playlist"
              entityId={playlist.id}
              isOpen={isShareModalOpen}
              onClose={() => setIsShareModalOpen(false)}
            />
          )}
        </div>
      );
    }

    export default PlaylistDetailPage;
