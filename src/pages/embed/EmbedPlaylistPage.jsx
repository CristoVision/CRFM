import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Play, Pause, Volume2, VolumeX, SkipForward, SkipBack, ListMusic, ExternalLink, Music, AlertTriangle, Maximize2, Minimize2, Shuffle } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Helmet } from 'react-helmet-async';
import CoverArtMedia from '@/components/common/CoverArtMedia';
import { pickImageFallback, pickVideoUrl } from '@/lib/mediaFallbacks';
import { useLanguage } from '@/contexts/LanguageContext';

const DEFAULT_COVER_ART = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8cGxheWxpc3R8ZW58MHx8MHx8fDA%3D&w=1000&q=80';
const CRFM_LOGO_URL = '/favicon-32x32.png';

const EmbedPlaylistPage = () => {
      const { id } = useParams();
      const { t } = useLanguage();
      const [playlist, setPlaylist] = useState(null);
      const [tracks, setTracks] = useState([]);
      const [originalTracks, setOriginalTracks] = useState([]);
      const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
      const [audio, setAudio] = useState(null);
      const [isPlaying, setIsPlaying] = useState(false);
      const [volume, setVolume] = useState(0.75);
      const [currentTime, setCurrentTime] = useState(0);
      const [duration, setDuration] = useState(0);
      const [isMuted, setIsMuted] = useState(false);
      const [showTracklist, setShowTracklist] = useState(false);
      const [isLoading, setIsLoading] = useState(true);
      const [error, setError] = useState(null);
      const [isFullScreen, setIsFullScreen] = useState(false);
      const [isShuffle, setIsShuffle] = useState(false);
      const currentTrackRef = useRef(null);

      useEffect(() => {
        const fetchPlaylistData = async () => {
          setIsLoading(true);
          setError(null);
          try {
            const { data: playlistData, error: playlistError } = await supabase
              .from('playlists')
              .select('id, title, description, cover_art_url, video_cover_art_url, profiles(username)')
              .eq('id', id)
              .single();

            if (playlistError) throw playlistError;
            if (!playlistData) throw new Error(t('embed.playlist.notFound'));
            setPlaylist(playlistData);

            const { data: playlistItemsData, error: itemsError } = await supabase
              .from('playlist_items')
              .select(`
                order_in_playlist,
                tracks (
                  id, title, audio_file_url, creator_display_name, cover_art_url, video_cover_art_url,
                  is_instrumental, lrc_file_path
                )
              `)
              .eq('playlist_id', id)
              .order('order_in_playlist', { ascending: true });

            if (itemsError) throw itemsError;
            
            const fetchedTracks = playlistItemsData.map(item => item.tracks).filter(Boolean);
            setTracks(fetchedTracks);
            setOriginalTracks(fetchedTracks);
            
            if (fetchedTracks.length > 0) {
              const newAudio = new Audio(fetchedTracks[0].audio_file_url);
              newAudio.volume = volume;
              setAudio(newAudio);
            } else {
              setError(t('embed.playlist.noTracks'));
            }

          } catch (err) {
            console.error('Error fetching playlist data:', err);
            setError(err.message || t('embed.playlist.loadError'));
          } finally {
            setIsLoading(false);
          }
        };

        if (id) {
          fetchPlaylistData();
        }
        
        return () => {
          if (audio) {
            audio.pause();
            audio.src = '';
          }
        };
      }, [id, t]);

      useEffect(() => {
        if (!audio) return;

        const updateTime = () => setCurrentTime(audio.currentTime);
        const setAudioDuration = () => setDuration(audio.duration);
        const handleEnded = () => playNextTrack();
        const handleCanPlay = () => setIsLoading(false);
        const handleError = (e) => {
          console.error("Audio Error:", e);
          setError(t('embed.playlist.audioError'));
          setIsLoading(false);
        };

        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('loadedmetadata', setAudioDuration);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('canplaythrough', handleCanPlay);
        audio.addEventListener('error', handleError);

        return () => {
          audio.removeEventListener('timeupdate', updateTime);
          audio.removeEventListener('loadedmetadata', setAudioDuration);
          audio.removeEventListener('ended', handleEnded);
          audio.removeEventListener('canplaythrough', handleCanPlay);
          audio.removeEventListener('error', handleError);
        };
      }, [audio]);
      
      useEffect(() => {
        if (tracks.length > 0 && audio && tracks[currentTrackIndex]) {
          setIsLoading(true);
          audio.src = tracks[currentTrackIndex].audio_file_url;
          audio.load();
          if (isPlaying) {
            audio.play().catch(e => console.error("Error playing new track:", e));
          }
        } else if (tracks.length === 0 && audio) {
          audio.pause();
          setIsPlaying(false);
        }
      }, [currentTrackIndex, tracks]);

      useEffect(() => {
        if (showTracklist && currentTrackRef.current) {
          currentTrackRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, [showTracklist, currentTrackIndex]);

      const playTrack = (index) => {
        setCurrentTrackIndex(index);
        setIsPlaying(true);
      };

      const togglePlayPause = () => {
        if (!audio || isLoading || error || tracks.length === 0) return;
        if (isPlaying) {
          audio.pause();
        } else {
          audio.play().catch(e => {
            console.error("Error playing audio:", e);
            setError(t('embed.playlist.playError'));
          });
        }
        setIsPlaying(!isPlaying);
      };

      const playNextTrack = () => {
        if (tracks.length === 0) return;
        setCurrentTrackIndex((prevIndex) => (prevIndex + 1) % tracks.length);
        setIsPlaying(true);
      };

      const playPrevTrack = () => {
        if (tracks.length === 0) return;
        setCurrentTrackIndex((prevIndex) => (prevIndex - 1 + tracks.length) % tracks.length);
        setIsPlaying(true);
      };

      const handleVolumeChange = (value) => {
        const newVolume = value[0];
        setVolume(newVolume);
        if (audio) audio.volume = newVolume;
        setIsMuted(newVolume === 0);
      };

      const toggleMute = () => {
        if (!audio) return;
        if (isMuted) {
          audio.volume = volume > 0 ? volume : 0.1;
          setVolume(volume > 0 ? volume : 0.1);
          setIsMuted(false);
        } else {
          audio.volume = 0;
          setIsMuted(true);
        }
      };
      
      const handleSeek = (value) => {
        if (!audio) return;
        audio.currentTime = value[0];
        setCurrentTime(value[0]);
      };

      const formatTime = (time) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60).toString().padStart(2, '0');
        return `${minutes}:${seconds}`;
      };

      const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen();
          setIsFullScreen(true);
        } else {
          if (document.exitFullscreen) {
            document.exitFullscreen();
            setIsFullScreen(false);
          }
        }
      };

      useEffect(() => {
        const handleFullScreenChange = () => {
          setIsFullScreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullScreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
      }, []);

      const toggleShuffle = () => {
        const newShuffleState = !isShuffle;
        setIsShuffle(newShuffleState);
        if (newShuffleState) {
          const shuffledTracks = [...originalTracks].sort(() => Math.random() - 0.5);
          setTracks(shuffledTracks);
          // If currently playing, find the current track in shuffled list or play first
          const currentPlayingTrackId = tracks[currentTrackIndex]?.id;
          const newIdx = shuffledTracks.findIndex(t => t.id === currentPlayingTrackId);
          setCurrentTrackIndex(newIdx !== -1 ? newIdx : 0);
        } else {
          setTracks(originalTracks);
           const currentPlayingTrackId = tracks[currentTrackIndex]?.id;
          const newIdx = originalTracks.findIndex(t => t.id === currentPlayingTrackId);
          setCurrentTrackIndex(newIdx !== -1 ? newIdx : 0);
        }
      };

      const currentTrack = tracks[currentTrackIndex];

      if (isLoading && !playlist) {
        return (
          <div className="w-full h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-gray-800 text-white p-4">
            <Music className="w-16 h-16 text-yellow-400 animate-pulse mb-4" />
            <p className="text-lg">{t('embed.playlist.loading')}</p>
          </div>
        );
      }
      
      if (error) {
        return (
          <div className="w-full h-screen flex flex-col items-center justify-center bg-gradient-to-br from-red-900 to-red-700 text-white p-4 text-center">
            <AlertTriangle className="w-16 h-16 text-yellow-300 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">{t('embed.playlist.playbackErrorTitle')}</h2>
            <p className="text-sm mb-4">{error}</p>
            <Button 
              variant="outline" 
              className="border-yellow-300 text-yellow-300 hover:bg-yellow-300/10"
              onClick={() => window.location.reload()}
            >
              {t('embed.playlist.tryAgain')}
            </Button>
          </div>
        );
      }

      if (!playlist) {
         return (
          <div className="w-full h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-gray-800 text-white p-4">
            <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
            <p className="text-lg">{t('embed.playlist.dataNotFound')}</p>
          </div>
        );
      }

      return (
        <>
        <Helmet>
            <title>{playlist ? t('embed.playlist.metaTitle', { title: playlist.title, creator: playlist.profiles?.username || t('embed.common.defaultUser') }) : t('embed.playlist.metaTitleFallback')} - CRFM</title>
            <meta name="description" content={playlist ? t('embed.playlist.metaDescription', { title: playlist.title }) : t('embed.playlist.metaDescriptionFallback')} />
            {playlist && <meta property="og:title" content={`${playlist.title} - ${playlist.profiles?.username || t('embed.common.defaultUser')}`} />}
            {playlist && <meta property="og:description" content={t('embed.playlist.ogDescription', { title: playlist.title })} />}
            {playlist && (
              <meta
                property="og:image"
                content={pickImageFallback([playlist.cover_art_url, currentTrack?.cover_art_url], DEFAULT_COVER_ART)}
              />
            )}
            {playlist && <meta property="og:type" content="music.playlist" />}
            {currentTrack && <meta property="og:audio" content={currentTrack.audio_file_url} />}
        </Helmet>
        <div className={`w-full ${isFullScreen ? 'h-screen' : 'max-w-md mx-auto h-[280px] sm:h-[240px]'} flex flex-col bg-gradient-to-br from-slate-800 to-gray-900 text-white shadow-2xl rounded-lg overflow-hidden transition-all duration-300`}>
          <div className="flex items-center p-3 space-x-3">
            <div className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0">
              <CoverArtMedia
                videoUrl={pickVideoUrl(playlist.video_cover_art_url || currentTrack?.video_cover_art_url)}
                imageUrl={pickImageFallback([playlist.cover_art_url, currentTrack?.cover_art_url], DEFAULT_COVER_ART)}
                className="w-full h-full shadow-lg border border-white/10"
                roundedClass="rounded-md"
                showBadge={false}
              />
            </div>
            <div className="flex flex-col justify-between flex-grow min-w-0 h-full">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold truncate" title={playlist.title}>{playlist.title}</h2>
                <p className="text-xs sm:text-sm text-gray-400 truncate" title={playlist.profiles?.username || t('embed.common.defaultUser')}>{t('embed.playlist.byLabel')} {playlist.profiles?.username || t('embed.common.defaultUser')}</p>
                {currentTrack && <p className="text-xs text-yellow-300 truncate" title={currentTrack.title}>{t('embed.playlist.nowPlaying', { title: currentTrack.title })}</p>}
              </div>
              <div className="flex items-center space-x-1 sm:space-x-2 mt-auto">
                <Button variant="ghost" size="icon" onClick={playPrevTrack} className="text-gray-400 hover:text-white w-8 h-8 sm:w-10 sm:h-10" disabled={tracks.length <= 1}>
                  <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={togglePlayPause} className="text-yellow-400 hover:text-yellow-300 w-10 h-10 sm:w-12 sm:h-12" disabled={tracks.length === 0}>
                  {isLoading && tracks.length > 0 ? <Music className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" /> : (isPlaying ? <Pause className="w-5 h-5 sm:w-6 sm:h-6" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6" />)}
                </Button>
                <Button variant="ghost" size="icon" onClick={playNextTrack} className="text-gray-400 hover:text-white w-8 h-8 sm:w-10 sm:h-10" disabled={tracks.length <= 1}>
                  <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
                <div className="flex items-center space-x-1 flex-grow">
                  <Button variant="ghost" size="icon" onClick={toggleMute} className="text-gray-400 hover:text-white w-6 h-6 sm:w-8 sm:h-8">
                    {isMuted || volume === 0 ? <VolumeX className="w-3 h-3 sm:w-4 sm:h-4" /> : <Volume2 className="w-3 h-3 sm:w-4 sm:h-4" />}
                  </Button>
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    max={1}
                    step={0.01}
                    onValueChange={handleVolumeChange}
                    className="w-full max-w-[60px] sm:max-w-[80px]"
                    aria-label={t('embed.playlist.volumeLabel')}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="px-3 pb-1 pt-0">
            <div className="flex items-center space-x-2 text-xs text-gray-400 mb-0.5">
              <span>{formatTime(currentTime)}</span>
              <Slider
                value={[currentTime]}
                max={duration || 0}
                step={1}
                onValueChange={handleSeek}
                className="w-full"
                aria-label={t('embed.playlist.seekLabel')}
                disabled={!audio || duration === 0 || tracks.length === 0}
              />
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {showTracklist && (
            <ScrollArea className="h-32 bg-black/20 p-2">
              {tracks.map((track, index) => (
                <div
                  key={track.id}
                  ref={index === currentTrackIndex ? currentTrackRef : null}
                  className={`p-1.5 rounded-md cursor-pointer text-xs hover:bg-slate-700/70 ${index === currentTrackIndex ? 'bg-yellow-500/20 text-yellow-300 font-semibold' : 'text-gray-300'}`}
                  onClick={() => playTrack(index)}
                >
                  {index + 1}. {track.title}
                </div>
              ))}
            </ScrollArea>
          )}
          
          <div className="bg-black/30 px-3 py-1.5 flex justify-between items-center text-xs">
            <a href={`https://crfm.app/playlist/${id}`} target="_blank" rel="noopener noreferrer" className="flex items-center text-yellow-400 hover:text-yellow-300 transition-colors">
              <img src={CRFM_LOGO_URL} alt={t('embed.common.crfmLogoAlt')} className="w-4 h-4 mr-1.5"/>
              {t('embed.common.openOnCrfm')} <ExternalLink className="w-3 h-3 ml-1" />
            </a>
            <div className="flex items-center space-x-1">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleShuffle} 
                className={`w-6 h-6 ${isShuffle ? 'text-yellow-400' : 'text-gray-400'} hover:text-white`} 
                title={isShuffle ? t('embed.playlist.shuffleOff') : t('embed.playlist.shuffleOn')}
                disabled={tracks.length <=1}
              >
                <Shuffle className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowTracklist(!showTracklist)} className="text-gray-400 hover:text-white w-6 h-6" title={showTracklist ? t('embed.playlist.hideTracklist') : t('embed.playlist.showTracklist')} disabled={tracks.length === 0}>
                <ListMusic className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={toggleFullScreen} className="text-gray-400 hover:text-white w-6 h-6">
                {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        </div>
        </>
      );
    };

    export default EmbedPlaylistPage;
