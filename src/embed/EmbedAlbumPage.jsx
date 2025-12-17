import React, { useState, useEffect, useRef } from 'react';
    import { useParams, Link } from 'react-router-dom';
    import { supabase } from '@/lib/supabaseClient';
    import { Play, Pause, Volume2, VolumeX, SkipForward, SkipBack, ListMusic, ExternalLink, Music, AlertTriangle, Maximize2, Minimize2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Helmet } from 'react-helmet-async';
import CoverArtMedia from '@/components/common/CoverArtMedia';

    const DEFAULT_COVER_ART = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8YWxidW18ZW58MHx8MHx8fDA%3D&w=1000&q=80';
    const CRFM_LOGO_URL = '/favicon-32x32.png';

    const EmbedAlbumPage = () => {
      const { id } = useParams();
      const [album, setAlbum] = useState(null);
      const [tracks, setTracks] = useState([]);
      const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
      const [audio, setAudio] = useState(null);
      const [isPlaying, setIsPlaying] = useState(false);
      const [volume, setVolume] = useState(0.75);
      const [currentTime, setCurrentTime] = useState(0);
      const [duration, setDuration] = useState(0);
      const [isMuted, setIsMuted] = useState(false);
      const [showPlaylist, setShowPlaylist] = useState(false);
      const [isLoading, setIsLoading] = useState(true);
      const [error, setError] = useState(null);
      const [isFullScreen, setIsFullScreen] = useState(false);
      const currentTrackRef = useRef(null);

      useEffect(() => {
        const fetchAlbumData = async () => {
          setIsLoading(true);
          setError(null);
          try {
          const { data: albumData, error: albumError } = await supabase
            .from('albums')
            .select('id, title, cover_art_url, video_cover_art_url, creator_display_name, release_date, uploader_id')
            .eq('id', id)
            .single();

            if (albumError) throw albumError;
            if (!albumData) throw new Error("Album not found");
            setAlbum(albumData);

            const trackSelectFields = `
              id, title, audio_file_url, track_number_on_album, creator_display_name, 
              is_instrumental, lrc_file_path
            `;
            const { data: tracksData, error: tracksError } = await supabase
              .from('tracks')
              .select(trackSelectFields)
              .eq('album_id', id)
              .order('track_number_on_album', { ascending: true });

            if (tracksError) throw tracksError;
            setTracks(tracksData || []);
            
            if (tracksData && tracksData.length > 0) {
              const newAudio = new Audio(tracksData[0].audio_file_url);
              newAudio.volume = volume;
              setAudio(newAudio);
            } else {
              setError("No tracks found in this album.");
            }

          } catch (err) {
            console.error('Error fetching album data:', err);
            setError(err.message || 'Failed to load album data.');
          } finally {
            setIsLoading(false);
          }
        };

        if (id) {
          fetchAlbumData();
        }
        
        return () => {
          if (audio) {
            audio.pause();
            audio.src = '';
          }
        };
      }, [id]);

      useEffect(() => {
        if (!audio) return;

        const updateTime = () => setCurrentTime(audio.currentTime);
        const setAudioDuration = () => setDuration(audio.duration);
        const handleEnded = () => playNextTrack();
        const handleCanPlay = () => setIsLoading(false);
        const handleError = (e) => {
          console.error("Audio Error:", e);
          setError("Error playing audio. The file might be corrupted or unavailable.");
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
        if (tracks.length > 0 && audio) {
          setIsLoading(true);
          audio.src = tracks[currentTrackIndex].audio_file_url;
          audio.load();
          if (isPlaying) {
            audio.play().catch(e => console.error("Error playing new track:", e));
          }
        }
      }, [currentTrackIndex, tracks]);


      useEffect(() => {
        if (showPlaylist && currentTrackRef.current) {
          currentTrackRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, [showPlaylist, currentTrackIndex]);


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
            setError("Could not play audio. Please try again.");
          });
        }
        setIsPlaying(!isPlaying);
      };

      const playNextTrack = () => {
        setCurrentTrackIndex((prevIndex) => (prevIndex + 1) % tracks.length);
        setIsPlaying(true);
      };

      const playPrevTrack = () => {
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

      const currentTrack = tracks[currentTrackIndex];

      if (isLoading && !album) {
        return (
          <div className="w-full h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-gray-800 text-white p-4">
            <Music className="w-16 h-16 text-yellow-400 animate-pulse mb-4" />
            <p className="text-lg">Loading Album...</p>
          </div>
        );
      }
      
      if (error) {
        return (
          <div className="w-full h-screen flex flex-col items-center justify-center bg-gradient-to-br from-red-900 to-red-700 text-white p-4 text-center">
            <AlertTriangle className="w-16 h-16 text-yellow-300 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Playback Error</h2>
            <p className="text-sm mb-4">{error}</p>
            <Button 
              variant="outline" 
              className="border-yellow-300 text-yellow-300 hover:bg-yellow-300/10"
              onClick={() => window.location.reload()}
            >
              Try Again
            </Button>
          </div>
        );
      }

      if (!album) {
         return (
          <div className="w-full h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-gray-800 text-white p-4">
            <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
            <p className="text-lg">Album data not found.</p>
          </div>
        );
      }

      return (
        <>
        <Helmet>
            <title>{album ? `${album.title} by ${album.creator_display_name}` : "Embedded Album"} - CRFM</title>
            <meta name="description" content={album ? `Listen to the album ${album.title} by ${album.creator_display_name} embedded from CRFM.` : "Embedded music album player from CRFM."} />
            {album && <meta property="og:title" content={`${album.title} - ${album.creator_display_name}`} />}
            {album && <meta property="og:description" content={`Listen to the album ${album.title} by ${album.creator_display_name} on CRFM.`} />}
            {album && <meta property="og:image" content={album.cover_art_url || DEFAULT_COVER_ART} />}
            {album && <meta property="og:type" content="music.album" />}
            {currentTrack && <meta property="og:audio" content={currentTrack.audio_file_url} />}
        </Helmet>
        <div className={`w-full ${isFullScreen ? 'h-screen' : 'max-w-md mx-auto h-[280px] sm:h-[240px]'} flex flex-col bg-gradient-to-br from-slate-800 to-gray-900 text-white shadow-2xl rounded-lg overflow-hidden transition-all duration-300`}>
          <div className="flex items-center p-3 space-x-3">
            <div className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0">
              <CoverArtMedia
                videoUrl={album.video_cover_art_url}
                imageUrl={album.cover_art_url || DEFAULT_COVER_ART}
                className="w-full h-full shadow-lg border border-white/10"
                roundedClass="rounded-md"
                showBadge={false}
              />
            </div>
            <div className="flex flex-col justify-between flex-grow min-w-0 h-full">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold truncate" title={album.title}>{album.title}</h2>
                <p className="text-xs sm:text-sm text-gray-400 truncate" title={album.creator_display_name}>{album.creator_display_name}</p>
                {currentTrack && <p className="text-xs text-yellow-300 truncate" title={currentTrack.title}>Now Playing: {currentTrack.title}</p>}
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
                    aria-label="Volume"
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
                aria-label="Seek"
                disabled={!audio || duration === 0 || tracks.length === 0}
              />
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {showPlaylist && (
            <ScrollArea className="h-32 bg-black/20 p-2">
              {tracks.map((track, index) => (
                <div
                  key={track.id}
                  ref={index === currentTrackIndex ? currentTrackRef : null}
                  className={`p-1.5 rounded-md cursor-pointer text-xs hover:bg-slate-700/70 ${index === currentTrackIndex ? 'bg-yellow-500/20 text-yellow-300 font-semibold' : 'text-gray-300'}`}
                  onClick={() => playTrack(index)}
                >
                  {track.track_number_on_album}. {track.title}
                </div>
              ))}
            </ScrollArea>
          )}
          
          <div className="bg-black/30 px-3 py-1.5 flex justify-between items-center text-xs">
            <a href={`https://crfm.app/album/${id}`} target="_blank" rel="noopener noreferrer" className="flex items-center text-yellow-400 hover:text-yellow-300 transition-colors">
              <img src={CRFM_LOGO_URL} alt="CRFM Logo" className="w-4 h-4 mr-1.5"/>
              Open on CRFM <ExternalLink className="w-3 h-3 ml-1" />
            </a>
            <div className="flex items-center space-x-1">
              <Button variant="ghost" size="icon" onClick={() => setShowPlaylist(!showPlaylist)} className="text-gray-400 hover:text-white w-6 h-6" title={showPlaylist ? "Hide Tracklist" : "Show Tracklist"} disabled={tracks.length === 0}>
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

    export default EmbedAlbumPage;
