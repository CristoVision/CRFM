import React, { useState, useEffect } from 'react';
    import { useParams, Link as RouterLink } from 'react-router-dom';
    import { supabase } from '@/lib/supabaseClient';
    import { Button } from '@/components/ui/button';
    import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
    import { User, ExternalLink, Loader2, AlertTriangle, Music, Disc, ListMusic } from 'lucide-react';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { Helmet } from 'react-helmet-async';

    const DEFAULT_AVATAR = 'https://bcrjrlafzqudmdzbcruz.supabase.co/storage/v1/object/public/images/embed_fallback_creator.webp';
    const MAX_ITEMS_DISPLAY = 5;
    const CRFM_LOGO_URL = 'https://bcrjrlafzqudmdzbcruz.supabase.co/storage/v1/object/public/logo/crfm-logo-icon-white.png';

    const EmbedPlayerSpinner = () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-black/70 text-white p-4">
        <Loader2 className="w-12 h-12 text-yellow-400 animate-spin mb-4" />
        <p className="text-lg">Loading Creator...</p>
      </div>
    );

    const EmbedPlayerError = ({ message }) => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-red-900/80 text-white p-4">
        <AlertTriangle className="w-12 h-12 text-yellow-300 mb-4" />
        <p className="text-lg font-semibold">Error Loading Creator</p>
        <p className="text-sm text-red-200">{message}</p>
      </div>
    );

    const ItemCard = ({ item, type }) => (
      <RouterLink to={`/${type}/${item.id}`} target="_blank" className="block p-2 bg-white/5 hover:bg-white/10 rounded-md transition-colors">
        <div className="flex items-center space-x-2">
          {type === 'track' && <Music className="w-4 h-4 text-yellow-400 flex-shrink-0" />}
          {type === 'album' && <Disc className="w-4 h-4 text-green-400 flex-shrink-0" />}
          {type === 'playlist' && <ListMusic className="w-4 h-4 text-purple-400 flex-shrink-0" />}
          <p className="text-xs text-white truncate flex-grow">{item.title}</p>
        </div>
      </RouterLink>
    );

    function EmbedCreatorPage() {
      const { id } = useParams();
      const [creatorData, setCreatorData] = useState(null);
      const [tracks, setTracks] = useState([]);
      const [albums, setAlbums] = useState([]);
      const [playlists, setPlaylists] = useState([]);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);

      useEffect(() => {
        const fetchCreator = async () => {
          setLoading(true);
          setError(null);
          try {
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('id, username, full_name, avatar_url, bio')
              .eq('id', id)
              .single();

            if (profileError) {
              if (profileError.code === 'PGRST116' || profileError.details?.includes('0 rows')) {
                throw new Error("This embed is unavailable or the creator was not found.");
              }
              throw profileError;
            }
            if (!profile) throw new Error("This embed is unavailable or the creator was not found.");
            setCreatorData(profile);
            document.title = `${profile.username || 'CRFM Creator'} - Embed`;

            const commonSelect = 'id, title';
            const commonOrder = { column: 'created_at', ascending: false };
            
            const [
              { data: tracksData, error: tracksError },
              { data: albumsData, error: albumsError },
              { data: playlistsData, error: playlistsError }
            ] = await Promise.all([
              supabase.from('tracks').select(commonSelect).eq('uploader_id', id).eq('is_public', true).order(commonOrder.column, commonOrder).limit(MAX_ITEMS_DISPLAY),
              supabase.from('albums').select(commonSelect).eq('uploader_id', id).eq('is_public', true).order(commonOrder.column, commonOrder).limit(MAX_ITEMS_DISPLAY),
              supabase.from('playlists').select(commonSelect).eq('creator_id', id).eq('is_public', true).order(commonOrder.column, commonOrder).limit(MAX_ITEMS_DISPLAY)
            ]);

            if (tracksError) console.warn("Error fetching tracks for embed:", tracksError.message);
            else setTracks(tracksData || []);
            if (albumsError) console.warn("Error fetching albums for embed:", albumsError.message);
            else setAlbums(albumsData || []);
            if (playlistsError) console.warn("Error fetching playlists for embed:", playlistsError.message);
            else setPlaylists(playlistsData || []);

          } catch (err) {
            if (err.message.includes("Failed to fetch") || err.status === 400) {
              setError("This embed is unavailable.");
            } else {
              setError(err.message || "An unexpected error occurred.");
            }
            document.title = "Error Loading Creator - CRFM Embed";
          } finally {
            setLoading(false);
          }
        };
        fetchCreator();
      }, [id]);

      if (loading) return <EmbedPlayerSpinner />;
      if (error) return <EmbedPlayerError message={error} />;
      if (!creatorData) return <EmbedPlayerError message="Creator data could not be loaded." />;

      const hasContent = tracks.length > 0 || albums.length > 0 || playlists.length > 0;
      const actualAvatarUrl = creatorData.avatar_url || DEFAULT_AVATAR;

      return (
        <>
          <Helmet>
            <title>{`${creatorData.username || 'CRFM Creator'} - CRFM Embed`}</title>
            <meta name="description" content={`Check out ${creatorData.username || 'this CRFM Creator'} and their music.`} />
            <meta property="og:title" content={`${creatorData.username || 'CRFM Creator'}`} />
            <meta property="og:description" content={`Discover music by ${creatorData.username || 'this CRFM Creator'}.`} />
            <meta property="og:image" content={actualAvatarUrl} />
            <meta property="og:type" content="profile" />
            <meta property="og:url" content={`${window.location.origin}/creator/${creatorData.id}`} />
            <meta name="twitter:card" content="summary" />
          </Helmet>
          <div className="w-full h-screen flex flex-col bg-gradient-to-br from-slate-800 to-slate-900 text-white font-sans overflow-hidden">
            <div className="flex items-center p-3 space-x-3 flex-shrink-0 border-b border-white/10">
              <Avatar className="w-16 h-16 border-2 border-yellow-400">
                <AvatarImage 
                  src={actualAvatarUrl} 
                  alt={creatorData.username} 
                  onError={(e) => e.target.src = DEFAULT_AVATAR}
                />
                <AvatarFallback className="bg-gray-700 text-xl">
                  {creatorData.username ? creatorData.username.charAt(0).toUpperCase() : <User />}
                </AvatarFallback>
              </Avatar>
              <div className="flex-grow min-w-0">
                <h1 className="text-lg font-semibold truncate" title={creatorData.username}>{creatorData.username}</h1>
                {creatorData.full_name && <p className="text-sm text-gray-400 truncate" title={creatorData.full_name}>{creatorData.full_name}</p>}
              </div>
              <Button variant="ghost" size="icon" asChild className="text-gray-300 hover:text-yellow-400">
                <RouterLink to={`/creator/${creatorData.id}`} target="_blank" title="View Profile on CRFM">
                  <ExternalLink className="w-5 h-5" />
                </RouterLink>
              </Button>
            </div>
            
            {creatorData.bio && (
              <p className="text-xs text-gray-300 p-3 border-b border-white/5 flex-shrink-0 max-h-20 overflow-y-auto">
                {creatorData.bio}
              </p>
            )}

            <ScrollArea className="flex-grow p-3">
              {!hasContent && (
                <p className="text-center text-sm text-gray-500 py-4">This creator hasn't published any public content yet.</p>
              )}
              {tracks.length > 0 && (
                <div className="mb-3">
                  <h3 className="text-xs font-semibold text-yellow-400 mb-1 uppercase">Latest Tracks</h3>
                  <div className="space-y-1">
                    {tracks.map(track => <ItemCard key={track.id} item={track} type="track" />)}
                  </div>
                </div>
              )}
              {albums.length > 0 && (
                <div className="mb-3">
                  <h3 className="text-xs font-semibold text-green-400 mb-1 uppercase">Latest Albums</h3>
                  <div className="space-y-1">
                    {albums.map(album => <ItemCard key={album.id} item={album} type="album" />)}
                  </div>
                </div>
              )}
              {playlists.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-purple-400 mb-1 uppercase">Latest Playlists</h3>
                  <div className="space-y-1">
                    {playlists.map(playlist => <ItemCard key={playlist.id} item={playlist} type="playlist" />)}
                  </div>
                </div>
              )}
            </ScrollArea>

            <div className="text-center py-2 border-t border-white/10 flex-shrink-0 flex items-center justify-center space-x-2">
              <RouterLink to={`/creator/${creatorData.id}`} target="_blank" className="text-xs text-yellow-400 hover:text-yellow-300 hover:underline">
                View Full Profile on CRFM
              </RouterLink>
              <RouterLink to="/" target="_blank" title="Powered by CRFM">
                <img src={CRFM_LOGO_URL} alt="CRFM" className="w-4 h-4 opacity-70 hover:opacity-100 transition-opacity" />
              </RouterLink>
            </div>
          </div>
        </>
      );
    }

    export default EmbedCreatorPage;
