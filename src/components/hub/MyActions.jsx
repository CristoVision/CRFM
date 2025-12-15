import React, { useState, useEffect, useCallback } from 'react';
    import { supabase } from '@/lib/supabaseClient';
    import { useAuth } from '@/contexts/AuthContext';
    import { Button } from '@/components/ui/button';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { AlertTriangle, Loader2, Music, Disc, ListMusic, Edit3, MessageSquare, Eye, TrendingUp, RefreshCw, ExternalLink } from 'lucide-react';
    import { formatDistanceToNowStrict } from 'date-fns';
    import { Link } from 'react-router-dom';
    import { useToast } from "@/components/ui/use-toast";
    import { motion, AnimatePresence } from 'framer-motion';

    const MyActions = ({ onRefresh }) => {
      const { user } = useAuth();
      const { toast } = useToast();
      const [actions, setActions] = useState([]);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);
      const [activeTab, setActiveTab] = useState('uploads');

      const fetchActions = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        setError(null);
        try {
          const baseTrackSelect = `
            id, title, creator_display_name, uploader_id, audio_file_url, genre, stream_cost, 
            is_public, album_id, created_at, updated_at, is_christian_nature, is_instrumental, 
            ai_in_production, ai_in_artwork, ai_in_lyrics, cover_art_url, track_number_on_album, 
            release_date, languages, language, total_royalty_percentage_allocated, lyrics_text, 
            lrc_file_path, lyrics, sub_genre
          `;

          switch (activeTab) {
            case 'uploads':
              const { data: uploads, error: uploadsError } = await supabase
                .from('tracks')
                .select(baseTrackSelect)
                .eq('uploader_id', user.id)
                .order('created_at', { ascending: false })
                .limit(10);
              if (uploadsError) throw uploadsError;
              setActions(uploads.map(item => ({ ...item, type: 'track_upload', timestamp: item.created_at })));
              break;
            case 'edits':
              const { data: edits, error: editsError } = await supabase
                .from('tracks') 
                .select(baseTrackSelect)
                .eq('uploader_id', user.id)
                .neq('created_at', supabase.sql('updated_at')) 
                .order('updated_at', { ascending: false })
                .limit(10);
              if (editsError) throw editsError;
              setActions(edits.map(item => ({ ...item, type: 'track_edit', timestamp: item.updated_at })));
              break;
            case 'comments':
              setActions([{ id: 'placeholder-comment', title: 'Comment features coming soon!', type: 'comment_placeholder', timestamp: new Date().toISOString() }]);
              break;
            case 'views':
              setActions([{ id: 'placeholder-views', title: 'Track views analytics coming soon!', type: 'views_placeholder', timestamp: new Date().toISOString() }]);
              break;
            default:
              setActions([]);
          }
        } catch (err) {
          console.error("Error fetching actions:", err);
          setError(err.message || "Failed to load actions.");
          toast({
            title: "Error Loading Actions",
            description: err.message,
            variant: "destructive",
          });
        } finally {
          setLoading(false);
        }
      }, [user, activeTab, toast]);

      useEffect(() => {
        fetchActions();
      }, [fetchActions]);

      const handleRefresh = () => {
        fetchActions();
        if (onRefresh) onRefresh(); 
      };

      const ActionIcon = ({ type }) => {
        switch (type) {
          case 'track_upload': return <Music className="w-5 h-5 text-green-400" />;
          case 'track_edit': return <Edit3 className="w-5 h-5 text-blue-400" />;
          case 'album_create': return <Disc className="w-5 h-5 text-purple-400" />;
          case 'playlist_create': return <ListMusic className="w-5 h-5 text-yellow-400" />;
          case 'comment_placeholder': return <MessageSquare className="w-5 h-5 text-gray-400" />;
          case 'views_placeholder': return <Eye className="w-5 h-5 text-gray-400" />;
          default: return <TrendingUp className="w-5 h-5 text-indigo-400" />;
        }
      };

      const ActionItem = ({ action }) => (
        <div className="flex items-start space-x-3 p-3 hover:bg-slate-800/50 rounded-md transition-colors">
          <div className="flex-shrink-0 pt-1">
            <ActionIcon type={action.type} />
          </div>
          <div className="flex-grow">
            <p className="text-sm font-medium text-slate-200">
              {action.type === 'track_upload' && `Uploaded track: `}
              {action.type === 'track_edit' && `Edited track: `}
              <Link to={`/track/${action.id}`} className="hover:underline text-yellow-300 hover:text-yellow-200">
                {action.title}
              </Link>
            </p>
            {action.creator_display_name && <p className="text-xs text-slate-400">By: {action.creator_display_name}</p>}
            <p className="text-xs text-slate-500">
              {formatDistanceToNowStrict(new Date(action.timestamp), { addSuffix: true })}
            </p>
          </div>
          {(action.type === 'track_upload' || action.type === 'track_edit') && (
            <Button variant="ghost" size="sm" asChild className="text-xs text-slate-400 hover:text-yellow-300">
              <Link to={`/track/${action.id}`} target="_blank">
                View <ExternalLink className="w-3 h-3 ml-1" />
              </Link>
            </Button>
          )}
        </div>
      );

      return (
        <Card className="bg-slate-800/60 border-slate-700/50 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xl font-semibold text-slate-100">My Recent Actions</CardTitle>
            <Button variant="ghost" size="sm" onClick={handleRefresh} className="text-slate-400 hover:text-yellow-300">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-1 bg-slate-700/50 p-1 rounded-md mb-4">
                {['uploads', 'edits', 'comments', 'views'].map(tabName => (
                  <TabsTrigger
                    key={tabName}
                    value={tabName}
                    className="text-xs data-[state=active]:bg-slate-600/70 data-[state=active]:text-yellow-300 data-[state=active]:shadow-sm text-slate-300 hover:bg-slate-600/40 hover:text-slate-100 px-2 py-1.5 rounded-sm"
                  >
                    {tabName.charAt(0).toUpperCase() + tabName.slice(1)}
                  </TabsTrigger>
                ))}
              </TabsList>
              
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <TabsContent value={activeTab} className="mt-0">
                    {loading && (
                      <div className="flex justify-center items-center h-48">
                        <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
                      </div>
                    )}
                    {error && (
                      <div className="flex flex-col items-center justify-center h-48 bg-red-900/20 p-3 rounded-md">
                        <AlertTriangle className="w-8 h-8 text-red-500 mb-2" />
                        <p className="text-red-400 text-sm font-medium">Error: {error}</p>
                      </div>
                    )}
                    {!loading && !error && actions.length === 0 && (
                      <div className="text-center py-10 text-slate-500">
                        <p>No actions found for this category.</p>
                      </div>
                    )}
                    {!loading && !error && actions.length > 0 && (
                      <ScrollArea className="h-[300px] pr-2">
                        <div className="space-y-1">
                          {actions.map((action) => (
                            <ActionItem key={`${action.type}-${action.id}-${action.timestamp}`} action={action} />
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </TabsContent>
                </motion.div>
              </AnimatePresence>
            </Tabs>
          </CardContent>
        </Card>
      );
    };

    export default MyActions;
