import React, { useState, useEffect, useContext } from 'react';
    import { useParams, Link, useNavigate } from 'react-router-dom';
    import { supabase } from '@/lib/supabaseClient';
    import { toast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { usePlayer } from '@/contexts/PlayerContext';
    import { QueueContext } from '@/contexts/QueueContext';
import { Play, Pause, Heart, Flag, Disc, Calendar, Tag, Languages, ListMusic, Music, User, Share2 as ShareIcon, Eye, EyeOff } from 'lucide-react';
import FlagFormModal from '@/components/common/FlagFormModal';
import ShareModal from '@/components/ShareModal';
import { useAuth } from '@/contexts/AuthContext';
import CoverArtMedia from '@/components/common/CoverArtMedia';
import { useLanguage } from '@/contexts/LanguageContext';

    const DEFAULT_ALBUM_COVER = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fG11c2ljJTIwYWxidW18ZW58MHx8MHx8fDA%3D&w=1000&q=80';
    const DEFAULT_TRACK_COVER = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YXVkaW98ZW58MHx8MHx8fDA%3D&w=1000&q=80';


    function AlbumDetailPage() {
      const { id } = useParams();
      const navigate = useNavigate();
      const { t, language } = useLanguage();
      const [album, setAlbum] = useState(null);
      const [tracks, setTracks] = useState([]);
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
    toast({ title: t('albumDetail.toasts.authRequiredTitle'), description: t('albumDetail.toasts.authRequiredBody'), variant: "destructive" });
    return;
  }
  if (!album) return;
  setSelectedContentForFlag({
    id: album.id,
    type: 'album',
    uploaderId: album.uploader_id,
    title: album.title,
  });
  setIsFlagModalOpen(true);
};

  const handleSetVisibility = async (isPublic) => {
    if (!profile?.is_admin || !album) return;
    setVisibilityUpdating(true);
    try {
      const { error } = await supabase.rpc('rpc_admin_set_content_visibility', {
        p_admin_id: profile.id,
        p_content_id: album.id,
        p_content_type: 'album',
        p_is_public: isPublic,
        p_reason: isPublic ? 'admin_make_public' : 'admin_hide',
      });
      if (error) throw error;
      setAlbum(prev => prev ? { ...prev, is_public: isPublic } : prev);
      toast({ title: isPublic ? t('albumDetail.toasts.albumPublic') : t('albumDetail.toasts.albumHidden'), className: 'bg-green-600 text-white' });
    } catch (err) {
      toast({ title: t('albumDetail.toasts.visibilityFailed'), description: err.message, variant: 'destructive' });
    } finally {
      setVisibilityUpdating(false);
    }
  };

      useEffect(() => {
        const fetchAlbumDetails = async () => {
          setLoading(true);
          try {
            const { data: albumData, error: albumError } = await supabase
              .from('albums')
              .select('id, title, creator_display_name, uploader_id, cover_art_url, video_cover_art_url, genre, release_date, languages, is_public')
              .eq('id', id)
              .single();

            if (albumError) throw albumError;
            setAlbum(albumData);

            const isOwnerOrAdmin = !!user && (user.id === albumData.uploader_id || profile?.is_admin);
            let tracksQuery = supabase
              .from('tracks')
              .select('id, title, creator_display_name, uploader_id, audio_file_url, cover_art_url, video_cover_art_url, stream_cost, album_id, release_date, track_number_on_album')
              .eq('album_id', id)
              .order('track_number_on_album', { ascending: true, nullsFirst: false })
              .order('release_date', { ascending: true });

            if (!isOwnerOrAdmin) {
              tracksQuery = tracksQuery.eq('is_public', true);
            }

            const { data: tracksData, error: tracksError } = await tracksQuery;
            
            if (tracksError) throw tracksError;
            setTracks(tracksData || []);

          } catch (error) {
            toast({
              title: t('albumDetail.toasts.fetchErrorTitle'),
              description: error.message,
              variant: 'destructive',
            });
            setAlbum(null);
            setTracks([]);
          } finally {
            setLoading(false);
          }
        };

        if (id) {
          fetchAlbumDetails();
        }
      }, [id, user?.id, profile?.is_admin, t]);

      const handlePlayAlbum = () => {
        if (!album || tracks.length === 0 || !queueContext) return;
        const enrichedTracks = tracks.map(t => ({
          ...t,
          album_video_cover_art_url: album.video_cover_art_url || null,
          cover_art_url: t.cover_art_url || album.cover_art_url,
        }));
        if (currentTrack?.album_id === album.id && enrichedTracks.some(t => t.id === currentTrack.id)) {
          togglePlay();
        } else {
          queueContext.setPlaybackQueue(enrichedTracks, 0);
        }
      };
      
      const handlePlaySingleTrack = (trackToPlay) => {
        if (!queueContext) return;
        if (currentTrack?.id === trackToPlay.id) {
          togglePlay();
        } else {
          const enrichedTracks = tracks.map(t => ({
            ...t,
            album_video_cover_art_url: album.video_cover_art_url || null,
            cover_art_url: t.cover_art_url || album.cover_art_url,
          }));
          const trackIndex = enrichedTracks.findIndex(t => t.id === trackToPlay.id);
          if (trackIndex === -1) return;
          queueContext.setPlaybackQueue(enrichedTracks, trackIndex);
        }
      };

      const formatDate = (dateString) => {
        if (!dateString) return t('common.na');
        return new Date(dateString).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      };
      
      const isAlbumPlaying = () => {
        if (!isPlaying || !currentTrack || tracks.length === 0) return false;
        return tracks.some(track => track.id === currentTrack.id && currentTrack.album_id === album.id);
      };


      if (loading) {
        return (
          <div className="min-h-[calc(100vh-80px)] flex items-center justify-center">
            <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        );
      }

      if (!album) {
        return (
          <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center text-center">
            <Disc className="w-24 h-24 text-gray-600 mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">{t('albumDetail.notFoundHeading')}</h1>
            <p className="text-gray-400 mb-6">{t('albumDetail.notFoundBody')}</p>
            <Button asChild className="golden-gradient text-black font-semibold">
              <Link to="/">{t('albumDetail.backHome')}</Link>
            </Button>
          </div>
        );
      }

      return (
        <div className="container mx-auto px-4 py-12 pt-8">
          <div className="md:flex md:space-x-12 glass-effect-light p-6 sm:p-8 rounded-xl shadow-2xl">
            <div className="md:w-1/3 flex-shrink-0 mb-8 md:mb-0">
              <CoverArtMedia
                videoUrl={album.video_cover_art_url}
                imageUrl={album.cover_art_url || DEFAULT_ALBUM_COVER}
                className="w-full aspect-square shadow-xl border-2 border-yellow-400/50"
                roundedClass="rounded-lg"
                showBadge={!!album.video_cover_art_url}
              />
              <Button 
                onClick={handlePlayAlbum}
                disabled={tracks.length === 0}
                className="w-full mt-6 golden-gradient text-black font-bold py-3 text-lg hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-50"
              >
                {isAlbumPlaying() ? <Pause className="w-6 h-6 mr-2" /> : <Play className="w-6 h-6 mr-2" />}
                {isAlbumPlaying() ? t('albumDetail.player.pauseAlbum') : (tracks.length > 0 ? t('albumDetail.player.playAlbum') : t('albumDetail.player.noTracks'))}
              </Button>
              <div className="grid grid-cols-3 gap-2 mt-4">
                <Button variant="outline" className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20" title={t('albumDetail.actions.favoriteSoon')}>
                  <Heart className="w-4 h-4 text-red-400" />
                </Button>
                 <Button onClick={() => setIsShareModalOpen(true)} variant="outline" className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20" title={t('albumDetail.actions.share')}>
                  <ShareIcon className="w-4 h-4 text-blue-400" />
                </Button>
                <Button onClick={handleOpenFlagModal} variant="outline" className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20" title={t('albumDetail.actions.report')}>
                  <Flag className="w-4 h-4 text-yellow-400" />
                </Button>
                {profile?.is_admin && (
                  <>
                    <Button
                      onClick={() => handleSetVisibility(false)}
                      variant="outline"
                      className="w-full bg-red-500/10 border-red-500/40 text-red-200 hover:bg-red-500/20"
                      disabled={visibilityUpdating}
                      title={t('albumDetail.actions.hideAlbum')}
                    >
                      <EyeOff className="w-4 h-4 mr-1" />
                    </Button>
                    <Button
                      onClick={() => handleSetVisibility(true)}
                      variant="outline"
                      className="w-full bg-emerald-500/10 border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/20"
                      disabled={visibilityUpdating}
                      title={t('albumDetail.actions.makePublic')}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="md:w-2/3">
              <h1 className="text-4xl sm:text-5xl font-bold golden-text mb-2">{album.title}</h1>
              {album.uploader_id && (
                <Link to={`/creator/${album.uploader_id}`} className="text-xl text-gray-300 hover:text-yellow-400 transition-colors mb-6 block flex items-center">
                  <User className="w-5 h-5 mr-2" /> {album.creator_display_name}
                </Link>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="flex items-center space-x-2 p-3 bg-white/5 rounded-lg">
                  <Tag className="w-5 h-5 text-yellow-400" />
                  <span className="text-sm text-gray-300">{t('albumDetail.labels.genre')}</span>
                  <span className="text-sm font-semibold text-white">{album.genre || t('common.na')}</span>
                </div>
                <div className="flex items-center space-x-2 p-3 bg-white/5 rounded-lg">
                  <Calendar className="w-5 h-5 text-yellow-400" />
                  <span className="text-sm text-gray-300">{t('albumDetail.labels.released')}</span>
                  <span className="text-sm font-semibold text-white">{formatDate(album.release_date)}</span>
                </div>
                <div className="flex items-center space-x-2 p-3 bg-white/5 rounded-lg col-span-1 sm:col-span-2">
                  <Languages className="w-5 h-5 text-yellow-400" />
                  <span className="text-sm text-gray-300">{t('albumDetail.labels.languages')}</span>
                  <span className="text-sm font-semibold text-white">{(album.languages && album.languages.length > 0) ? album.languages.join(', ') : t('common.na')}</span>
                </div>
              </div>
              
              <h2 className="text-2xl font-semibold text-white mt-8 mb-4 flex items-center">
                <ListMusic className="w-6 h-6 mr-3 text-yellow-400" /> {t('albumDetail.labels.tracksOnAlbum')}
              </h2>
              {tracks.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto lyrics-container pr-2">
                  {tracks.map((track, index) => (
                    <div key={track.id} className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors group">
                      <div className="flex items-center space-x-3 flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/track/${track.id}`)}>
                        <span className="text-sm text-gray-400 w-6 text-right">{index + 1}.</span>
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
                        onClick={(e) => { e.stopPropagation(); handlePlaySingleTrack(track); }}
                      >
                        {currentTrack?.id === track.id && isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 p-4 bg-white/5 rounded-lg text-center">{t('albumDetail.labels.noPublicTracks')}</p>
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
          {album && (
            <ShareModal
              entityType="album"
              entityId={album.id}
              isOpen={isShareModalOpen}
              onClose={() => setIsShareModalOpen(false)}
            />
          )}
        </div>
      );
    }

    export default AlbumDetailPage;
