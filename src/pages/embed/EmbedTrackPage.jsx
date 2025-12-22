import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, ExternalLink, Music, AlertTriangle } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Helmet } from 'react-helmet-async';
import CoverArtMedia from '@/components/common/CoverArtMedia';
import { pickImageFallback, pickVideoUrl } from '@/lib/mediaFallbacks';
import { useLanguage } from '@/contexts/LanguageContext';

const DEFAULT_COVER_ART = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YXVkaW98ZW58MHx8MHx8fDA%3D&w=1000&q=80';
const CRFM_LOGO_URL = '/favicon-32x32.png';

const EmbedTrackPage = () => {
      const { id } = useParams();
      const { t } = useLanguage();
      const [track, setTrack] = useState(null);
      const [audio, setAudio] = useState(null);
      const [isPlaying, setIsPlaying] = useState(false);
      const [volume, setVolume] = useState(0.75);
      const [currentTime, setCurrentTime] = useState(0);
      const [duration, setDuration] = useState(0);
      const [isMuted, setIsMuted] = useState(false);
      const [isLoading, setIsLoading] = useState(true);
      const [error, setError] = useState(null);
      const [isFullScreen, setIsFullScreen] = useState(false);

      useEffect(() => {
        const fetchTrack = async () => {
          setIsLoading(true);
          setError(null);
          try {
            const { data, error: fetchError } = await supabase
              .from('tracks')
              .select(`
                id, title, creator_display_name, audio_file_url, cover_art_url, video_cover_art_url, 
                genre, release_date, is_christian_nature, is_instrumental, lrc_file_path,
                albums (title, id, video_cover_art_url, cover_art_url)
              `)
              .eq('id', id)
              .single();

            if (fetchError) throw fetchError;
            if (!data) throw new Error(t('embed.track.notFound'));
            
            setTrack(data);
            const newAudio = new Audio(data.audio_file_url);
            newAudio.volume = volume;
            setAudio(newAudio);

          } catch (err) {
            console.error('Error fetching track:', err);
            setError(err.message || t('embed.track.loadError'));
          } finally {
            setIsLoading(false);
          }
        };

        if (id) {
          fetchTrack();
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
        const handleEnded = () => setIsPlaying(false);
        const handleCanPlay = () => setIsLoading(false);
        const handleError = (e) => {
          console.error("Audio Error:", e);
          setError(t('embed.track.audioError'));
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

      const togglePlayPause = () => {
        if (!audio || isLoading || error) return;
        if (isPlaying) {
          audio.pause();
        } else {
          audio.play().catch(e => {
            console.error("Error playing audio:", e);
            setError(t('embed.track.playError'));
          });
        }
        setIsPlaying(!isPlaying);
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


      if (isLoading && !track) {
        return (
          <div className="w-full h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-gray-800 text-white p-4">
            <Music className="w-16 h-16 text-yellow-400 animate-pulse mb-4" />
            <p className="text-lg">{t('embed.track.loading')}</p>
          </div>
        );
      }

      if (error) {
        return (
          <div className="w-full h-screen flex flex-col items-center justify-center bg-gradient-to-br from-red-900 to-red-700 text-white p-4 text-center">
            <AlertTriangle className="w-16 h-16 text-yellow-300 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">{t('embed.track.playbackErrorTitle')}</h2>
            <p className="text-sm mb-4">{error}</p>
            <Button 
              variant="outline" 
              className="border-yellow-300 text-yellow-300 hover:bg-yellow-300/10"
              onClick={() => window.location.reload()}
            >
              {t('embed.track.tryAgain')}
            </Button>
          </div>
        );
      }

      if (!track) {
         return (
          <div className="w-full h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-gray-800 text-white p-4">
            <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
            <p className="text-lg">{t('embed.track.dataNotFound')}</p>
          </div>
        );
      }

      return (
        <>
        <Helmet>
            <title>{track ? t('embed.track.metaTitle', { title: track.title, creator: track.creator_display_name }) : t('embed.track.metaTitleFallback')} - CRFM</title>
            <meta name="description" content={track ? t('embed.track.metaDescription', { title: track.title, creator: track.creator_display_name }) : t('embed.track.metaDescriptionFallback')} />
            {track && <meta property="og:title" content={`${track.title} - ${track.creator_display_name}`} />}
            {track && <meta property="og:description" content={t('embed.track.ogDescription', { title: track.title, creator: track.creator_display_name })} />}
            {track && <meta property="og:image" content={pickImageFallback([track.cover_art_url, track.albums?.cover_art_url], DEFAULT_COVER_ART)} />}
            {track && <meta property="og:type" content="music.song" />}
            {track && <meta property="og:audio" content={track.audio_file_url} />}
        </Helmet>
        <div className={`w-full ${isFullScreen ? 'h-screen' : 'max-w-md mx-auto h-[180px] sm:h-[150px]'} flex flex-col bg-gradient-to-br from-slate-800 to-gray-900 text-white shadow-2xl rounded-lg overflow-hidden transition-all duration-300`}>
          <div className="flex items-center p-3 space-x-3 flex-grow min-h-0">
            <div className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0">
              <CoverArtMedia
                videoUrl={pickVideoUrl(track.video_cover_art_url || track.albums?.video_cover_art_url)}
                imageUrl={pickImageFallback([track.cover_art_url, track.albums?.cover_art_url], DEFAULT_COVER_ART)}
                className="w-full h-full shadow-lg border border-white/10"
                roundedClass="rounded-md"
                showBadge={false}
              />
            </div>
            <div className="flex flex-col justify-between flex-grow min-w-0 h-full">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold truncate" title={track.title}>{track.title}</h2>
                <p className="text-xs sm:text-sm text-gray-400 truncate" title={track.creator_display_name}>{track.creator_display_name}</p>
                {track.albums && <p className="text-xs text-gray-500 truncate" title={track.albums.title}>{t('embed.track.fromAlbum', { album: track.albums.title })}</p>}
              </div>
              <div className="flex items-center space-x-2 mt-auto">
                <Button variant="ghost" size="icon" onClick={togglePlayPause} className="text-yellow-400 hover:text-yellow-300 w-10 h-10 sm:w-12 sm:h-12">
                  {isLoading ? <Music className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" /> : (isPlaying ? <Pause className="w-5 h-5 sm:w-6 sm:h-6" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6" />)}
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
                    className="w-full max-w-[80px] sm:max-w-[100px]"
                    aria-label={t('embed.track.volumeLabel')}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="px-3 pb-2 pt-1">
            <div className="flex items-center space-x-2 text-xs text-gray-400 mb-0.5">
              <span>{formatTime(currentTime)}</span>
              <Slider
                value={[currentTime]}
                max={duration || 0}
                step={1}
                onValueChange={handleSeek}
                className="w-full"
                aria-label={t('embed.track.seekLabel')}
                disabled={!audio || duration === 0}
              />
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="bg-black/20 px-3 py-1.5 flex justify-between items-center text-xs">
            <a href={`https://crfm.app/track/${id}`} target="_blank" rel="noopener noreferrer" className="flex items-center text-yellow-400 hover:text-yellow-300 transition-colors">
              <img src={CRFM_LOGO_URL} alt={t('embed.common.crfmLogoAlt')} className="w-4 h-4 mr-1.5"/>
              {t('embed.common.openOnCrfm')} <ExternalLink className="w-3 h-3 ml-1" />
            </a>
            <Button variant="ghost" size="icon" onClick={toggleFullScreen} className="text-gray-400 hover:text-white w-6 h-6">
              {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
        </>
      );
    };

    export default EmbedTrackPage;
