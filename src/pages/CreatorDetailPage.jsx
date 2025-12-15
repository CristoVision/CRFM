import React, { useState, useEffect } from 'react';
    import { useParams, Link, useNavigate } from 'react-router-dom';
    import { supabase } from '@/lib/supabaseClient';
    import { toast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Mail, Link as LinkIconExt, Music, Disc, ListMusic, Globe, Twitter, Instagram, Youtube, Twitch, ExternalLink, Flag, Share2 as ShareIcon, Heart, Eye, EyeOff } from 'lucide-react';
    import TracksTab from '@/components/dashboard/TracksTab';
    import AlbumsTab from '@/components/dashboard/AlbumsTab';
    import PlaylistsTab from '@/components/dashboard/PlaylistsTab';
import MembershipPanel from '@/components/creator/MembershipPanel';
    import FlagFormModal from '@/components/common/FlagFormModal';
    import ShareModal from '@/components/ShareModal';
    import { useAuth } from '@/contexts/AuthContext';

    const DEFAULT_AVATAR = 'https://avatar.vercel.sh/creator.png?text=CR';

    const SocialLinkButton = ({ url, platform }) => {
      if (!url) return null;
      let IconComponent = ExternalLink;
      let platformName = "Website";

      if (url.includes('twitter.com') || url.includes('x.com')) { IconComponent = Twitter; platformName = "Twitter/X"; }
      else if (url.includes('instagram.com')) { IconComponent = Instagram; platformName = "Instagram"; }
      else if (url.includes('youtube.com') || url.includes('youtu.be')) { IconComponent = Youtube; platformName = "YouTube"; }
      else if (url.includes('twitch.tv')) { IconComponent = Twitch; platformName = "Twitch"; }
      
      return (
        <Button variant="outline" size="sm" asChild className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-yellow-400 transition-colors">
          <a href={url} target="_blank" rel="noopener noreferrer" title={platformName}>
            <IconComponent className="w-4 h-4 mr-2" /> {platformName}
          </a>
        </Button>
      );
    };

    function CreatorDetailPage() {
      const { id } = useParams();
      const navigate = useNavigate();
      const [creator, setCreator] = useState(null);
      const [loading, setLoading] = useState(true);
      const [searchQuery, setSearchQuery] = useState(''); 
const { user, profile } = useAuth();
      
      const [tracks, setTracks] = useState([]);
      const [albums, setAlbums] = useState([]);
      const [playlists, setPlaylists] = useState([]);

      const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);
      const [selectedContentForFlag, setSelectedContentForFlag] = useState(null);
const [isShareModalOpen, setIsShareModalOpen] = useState(false);
const [isFavorited, setIsFavorited] = useState(false);
const [loadingFavorite, setLoadingFavorite] = useState(true);
  const [visibilityUpdating, setVisibilityUpdating] = useState(false);


      useEffect(() => {
        const checkIfFavorited = async () => {
          if (!user || !id) {
            setLoadingFavorite(false);
            return;
          }
          setLoadingFavorite(true);
          try {
            const { data, error } = await supabase
              .from('favorites')
              .select('content_id')
              .eq('user_id', user.id)
              .eq('content_type', 'creator')
              .eq('content_id', id)
              .maybeSingle();

            if (error) throw error;
            setIsFavorited(!!data);
          } catch (error) {
            console.error('Error checking favorite status:', error);
          } finally {
            setLoadingFavorite(false);
          }
        };
        if (id && user) {
          checkIfFavorited();
        } else {
          setLoadingFavorite(false);
        }
      }, [user, id]);

      const handleToggleFavorite = async () => {
        if (!user || !id || loadingFavorite || !creator) return;
        setLoadingFavorite(true);
        try {
          if (isFavorited) {
            const { error } = await supabase
              .from('favorites')
              .delete()
              .eq('user_id', user.id)
              .eq('content_type', 'creator')
              .eq('content_id', id);
            if (error) throw error;
            setIsFavorited(false);
            toast({ title: "Removed from favorites", description: `${creator.username} removed from your favorites.`, className: "bg-blue-600 border-blue-700 text-white" });
          } else {
            const { error } = await supabase
              .from('favorites')
              .insert({ user_id: user.id, content_type: 'creator', content_id: id });
            if (error) throw error;
            setIsFavorited(true);
            toast({ title: "Added to favorites", description: `${creator.username} added to your favorites.`, className: "bg-green-600 border-green-700 text-white" });
          }
        } catch (error) {
          console.error('Error toggling favorite:', error);
          toast({ title: "Error", description: "Could not update favorites.", variant: "destructive" });
        } finally {
          setLoadingFavorite(false);
        }
      };


      const handleOpenFlagModal = () => {
        if (!user) {
          toast({ title: "Authentication Required", description: "Please log in to flag content.", variant: "destructive" });
          return;
        }
        if (!creator) return;
        setSelectedContentForFlag({
          id: creator.id,
          type: 'creator',
          uploaderId: creator.id, 
          title: creator.username,
        });
        setIsFlagModalOpen(true);
      };

      const handleSetVisibility = async (isPublic) => {
        if (!profile?.is_admin || !creator) return;
        setVisibilityUpdating(true);
        try {
          const { error } = await supabase.rpc('rpc_admin_set_content_visibility', {
            p_admin_id: profile.id,
            p_content_id: creator.id,
            p_content_type: 'creator',
            p_is_public: isPublic,
            p_reason: isPublic ? 'admin_make_public' : 'admin_hide',
          });
          if (error) throw error;
          setCreator(prev => prev ? { ...prev, is_public: isPublic } : prev);
          toast({ title: isPublic ? 'Creator is now public' : 'Creator hidden', className: 'bg-green-600 text-white' });
        } catch (err) {
          toast({ title: 'Visibility update failed', description: err.message, variant: 'destructive' });
        } finally {
          setVisibilityUpdating(false);
        }
      };

      useEffect(() => {
        const fetchCreatorDetails = async () => {
          setLoading(true);
          try {
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', id)
              .single();

            if (profileError) throw profileError;
            setCreator(profileData);

            const { data: tracksData, error: tracksError } = await supabase
              .from('tracks')
              .select('*')
              .eq('uploader_id', id)
              .eq('is_public', true)
              .order('created_at', { ascending: false });
            if (tracksError) console.warn("Error fetching tracks:", tracksError.message);
            else setTracks(tracksData || []);

            const { data: albumsData, error: albumsError } = await supabase
              .from('albums')
              .select('*')
              .eq('uploader_id', id)
              .eq('is_public', true)
              .order('created_at', { ascending: false });
            if (albumsError) console.warn("Error fetching albums:", albumsError.message);
            else setAlbums(albumsData || []);
            
            const { data: playlistsData, error: playlistsError } = await supabase
              .from('playlists')
              .select('*')
              .eq('creator_id', id)
              .eq('is_public', true)
              .order('created_at', { ascending: false });
            if (playlistsError) console.warn("Error fetching playlists:", playlistsError.message);
            else setPlaylists(playlistsData || []);

          } catch (error) {
            toast({
              title: 'Error fetching creator details',
              description: error.message,
              variant: 'destructive',
            });
            setCreator(null);
          } finally {
            setLoading(false);
          }
        };

        if (id) {
          fetchCreatorDetails();
        }
      }, [id]);


      if (loading) {
        return (
          <div className="min-h-[calc(100vh-80px)] flex items-center justify-center">
            <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        );
      }

      if (!creator) {
        return (
          <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center text-center">
            <User className="w-24 h-24 text-gray-600 mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">Creator Not Found</h1>
            <p className="text-gray-400 mb-6">The creator profile you are looking for could not be found.</p>
            <Button asChild className="golden-gradient text-black font-semibold">
              <Link to="/">Go Back Home</Link>
            </Button>
          </div>
        );
      }

      return (
        <div className="container mx-auto px-4 py-12 pt-8">
          <div className="glass-effect-light p-6 sm:p-8 rounded-xl shadow-2xl mb-12">
            <div className="md:flex md:space-x-8 items-start">
              <div className="md:w-1/4 flex-shrink-0 mb-6 md:mb-0 flex flex-col items-center">
                <Avatar className="w-32 h-32 sm:w-40 sm:h-40 border-4 border-yellow-400 shadow-xl">
                  <AvatarImage src={creator.avatar_url || DEFAULT_AVATAR} alt={creator.username} />
                  <AvatarFallback className="text-5xl bg-gray-700 text-white">
                    {creator.username ? creator.username.charAt(0).toUpperCase() : <User />}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-wrap gap-2 w-full mt-4">
                  <Button 
                    onClick={handleToggleFavorite} 
                    variant="outline" 
                    className={`flex-1 ${isFavorited ? 'bg-red-500/20 border-red-500/40 text-red-300 hover:bg-red-500/30 hover:text-red-200' : 'bg-gray-500/10 border-gray-500/30 text-gray-300 hover:bg-gray-500/20 hover:text-gray-200'}`} 
                    title={isFavorited ? "Remove from Favorites" : "Add to Favorites"}
                    disabled={loadingFavorite}
                  >
                    <Heart className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`} />
                  </Button>
                  <Button onClick={handleOpenFlagModal} variant="outline" className="flex-1 bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20 hover:text-red-200" title="Report Creator">
                    <Flag className="w-4 h-4" />
                  </Button>
                  <Button onClick={() => setIsShareModalOpen(true)} variant="outline" className="flex-1 bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20 hover:text-blue-200" title="Share Creator Profile">
                    <ShareIcon className="w-4 h-4" />
                  </Button>
                  {profile?.is_admin && (
                    <>
                      <Button
                        onClick={() => handleSetVisibility(false)}
                        variant="outline"
                        className="flex-1 bg-red-500/10 border-red-500/40 text-red-200 hover:bg-red-500/20"
                        disabled={visibilityUpdating}
                        title="Hide creator"
                      >
                        <EyeOff className="w-4 h-4 mr-1" />
                      </Button>
                      <Button
                        onClick={() => handleSetVisibility(true)}
                        variant="outline"
                        className="flex-1 bg-emerald-500/10 border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/20"
                        disabled={visibilityUpdating}
                        title="Make creator public"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                      </Button>
                    </>
                  )}
                </div>
                <div className="w-full mt-4">
                  <MembershipPanel creatorId={id} />
                </div>
              </div>
              <div className="md:w-3/4">
                <h1 className="text-4xl sm:text-5xl font-bold golden-text mb-1">{creator.username}</h1>
                {creator.full_name && <p className="text-xl text-gray-300 mb-3">{creator.full_name}</p>}
                {creator.bio && <p className="text-gray-400 mb-4 text-sm leading-relaxed">{creator.bio}</p>}
                
                {creator.creator_tags && creator.creator_tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {creator.creator_tags.map(tag => (
                      <span key={tag} className="bg-yellow-400/20 text-yellow-300 px-3 py-1 text-xs font-medium rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <SocialLinkButton url={creator.social_link_1} platform="Social 1" />
                  <SocialLinkButton url={creator.social_link_2} platform="Social 2" />
                </div>
              </div>
            </div>
          </div>

          <Tabs defaultValue="tracks" className="w-full">
            <TabsList className="grid w-full grid-cols-3 gap-2 mb-8 glass-effect p-2rounded-lg">
              <TabsTrigger value="tracks" className="tab-button"><Music className="w-4 h-4 mr-2"/>Tracks ({tracks.length})</TabsTrigger>
              <TabsTrigger value="albums" className="tab-button"><Disc className="w-4 h-4 mr-2"/>Albums ({albums.length})</TabsTrigger>
              <TabsTrigger value="playlists" className="tab-button"><ListMusic className="w-4 h-4 mr-2"/>Playlists ({playlists.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="tracks">
              <TracksTab initialTracks={tracks} searchQuery={searchQuery} viewMode="grid" isCreatorPageContext={true} />
            </TabsContent>
            <TabsContent value="albums">
              <AlbumsTab initialAlbums={albums} searchQuery={searchQuery} viewMode="grid" isCreatorPageContext={true} />
            </TabsContent>
            <TabsContent value="playlists">
              <PlaylistsTab initialPlaylists={playlists} searchQuery={searchQuery} viewMode="grid" isCreatorPageContext={true} />
            </TabsContent>
          </Tabs>

          {selectedContentForFlag && (
            <FlagFormModal
              isOpen={isFlagModalOpen}
              onClose={() => setIsFlagModalOpen(false)}
              contentId={selectedContentForFlag.id}
              contentType={selectedContentForFlag.type}
              contentTitle={selectedContentForFlag.title}
              originalUploaderId={selectedContentForFlag.uploaderId}
              onFlagSubmitted={() => {
                setIsFlagModalOpen(false);
                toast({ title: "Content Flagged", description: `${selectedContentForFlag.title} has been flagged and will be reviewed.`});
                if (selectedContentForFlag.type === 'creator' && selectedContentForFlag.id === creator?.id) {
                  setCreator(prev => prev ? ({ ...prev, is_public: false }) : null);
                  toast({ title: "Creator Profile Hidden", description: "This creator's profile is now hidden pending review.", variant: "destructive" });
                  navigate('/'); 
                }
              }}
            />
          )}
          {creator && (
            <ShareModal
              entityType="creator"
              entityId={creator.id}
              isOpen={isShareModalOpen}
              onClose={() => setIsShareModalOpen(false)}
            />
          )}
        </div>
      );
    }
    export default CreatorDetailPage;
