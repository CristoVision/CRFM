import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tag, User, Edit3, Loader2, Search, AlertTriangle, Inbox, MessageSquare, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import EditCreatorTagsModal from '@/components/creatorTags/EditCreatorTagsModal.jsx';
import ReviewTagRequestModal from '@/components/creatorTags/ReviewTagRequestModal.jsx';

const AdminCreatorTagsTab = () => {
  const [creators, setCreators] = useState([]);
  const [tagRequests, setTagRequests] = useState([]);
  const [isLoadingCreators, setIsLoadingCreators] = useState(true);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [searchTermCreators, setSearchTermCreators] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
      const { profile } = useAuth();

      const fetchCreators = useCallback(async () => {
        setIsLoadingCreators(true);
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, username, full_name, creator_tags, bio, is_verified_creator, created_at')
            .eq('is_verified_creator', true)
            .order('username', { ascending: true });
          if (error) throw error;
          setCreators(data);
        } catch (error) {
          toast({ title: "Error Fetching Creators", description: error.message, variant: "error" });
        } finally {
          setIsLoadingCreators(false);
        }
      }, []);

      const fetchTagRequests = useCallback(async () => {
        setIsLoadingRequests(true);
        try {
            const { data: requests, error } = await supabase
                .from('creator_tag_requests')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: true });
            if (error) throw error;

            // Fetch requester profiles separately to avoid ambiguous relationships
            const requesterIds = Array.from(new Set((requests || []).map(r => r.user_id).filter(Boolean)));
            let profilesMap = {};
            if (requesterIds.length > 0) {
              const { data: requesterProfiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, username, full_name')
                .in('id', requesterIds);
              if (profilesError) throw profilesError;
              profilesMap = Object.fromEntries((requesterProfiles || []).map(p => [p.id, p]));
            }

            const merged = (requests || []).map(req => ({
              ...req,
              requester_profile: profilesMap[req.user_id] || null,
            }));
            setTagRequests(merged);
        } catch (error) {
            toast({ title: "Error Fetching Tag Requests", description: error.message, variant: "error" });
        } finally {
            setIsLoadingRequests(false);
        }
      }, []);

  useEffect(() => {
    if (profile?.is_admin) {
      fetchCreators();
      fetchTagRequests();
    }
  }, [profile, fetchCreators, fetchTagRequests]);

      const handleUpdateCreator = (updatedCreator) => {
        setCreators(prevCreators => prevCreators.map(c => c.id === updatedCreator.id ? updatedCreator : c));
      };

      const handleOpenReviewModal = (request) => {
        setSelectedRequest(request);
        setIsReviewModalOpen(true);
      };

      const handleRequestReviewed = () => {
        fetchTagRequests(); // Refresh the list of pending requests
        fetchCreators(); // Also refresh creators list as one might have been verified
      };
      
      const filteredCreators = creators.filter(creator => {
        const searchLower = searchTermCreators.toLowerCase();
        return (
          creator.username?.toLowerCase().includes(searchLower) ||
          creator.full_name?.toLowerCase().includes(searchLower) ||
          creator.bio?.toLowerCase().includes(searchLower) ||
          (creator.creator_tags && creator.creator_tags.some(tag => tag.toLowerCase().includes(searchLower)))
        );
      });

      if (!profile?.is_admin) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8 glass-effect rounded-xl">
                <ShieldAlert className="w-16 h-16 text-yellow-400 mb-6 opacity-70" />
                <h2 className="text-3xl font-bold golden-text mb-4">Access Denied</h2>
                <p className="text-lg text-gray-300">You do not have permission to view this page.</p>
            </div>
        );
      }

      return (
        <div className="space-y-10">
          {/* Section for Pending Tag Requests */}
          <section>
            <h2 className="text-3xl font-semibold golden-text mb-6 flex items-center">
                <Inbox className="w-8 h-8 mr-3 text-yellow-400/80"/> Pending Creator Tag Requests
            </h2>
            {isLoadingRequests && (
                <div className="min-h-[20vh] flex items-center justify-center">
                    <Loader2 className="w-10 h-10 text-yellow-400 animate-spin" />
                    <p className="ml-3 text-lg text-gray-300">Loading Requests...</p>
                </div>
            )}
            {!isLoadingRequests && tagRequests.length === 0 && (
                <div className="text-center py-10 glass-effect rounded-xl">
                    <MessageSquare className="w-12 h-12 text-yellow-400 mx-auto mb-4 opacity-70" />
                    <h3 className="text-xl font-semibold golden-text mb-1">No Pending Requests</h3>
                    <p className="text-gray-400">All creator tag requests have been reviewed.</p>
                </div>
            )}
            {!isLoadingRequests && tagRequests.length > 0 && (
                <div className="space-y-4">
                    {tagRequests.map(request => (
                        <Card key={request.id} className="glass-effect-light">
                            <CardHeader>
                                <CardTitle className="flex justify-between items-center text-lg">
                                    Request from: <span className="text-yellow-300">{request.requester_profile?.username || request.user_id}</span>
                                    <Badge variant="outline" className="text-xs border-yellow-400/50 text-yellow-300">Pending</Badge>
                                </CardTitle>
                                <p className="text-xs text-gray-400">
                                    Requested on: {format(new Date(request.created_at), 'MMM d, yyyy HH:mm')}
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div>
                                    <p className="text-sm font-medium text-gray-300">Requested Tags:</p>
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                        {request.requested_tags.map(tag => (
                                            <Badge key={tag} variant="secondary" className="text-xs bg-yellow-400/10 text-yellow-300 border-yellow-400/30">{tag}</Badge>
                                        ))}
                                    </div>
                                </div>
                                {request.additional_info && (
                                    <div>
                                        <p className="text-sm font-medium text-gray-300">Additional Info:</p>
                                        <p className="text-xs text-gray-400 bg-black/10 p-2 rounded-md whitespace-pre-wrap">{request.additional_info}</p>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter>
                                <Button onClick={() => handleOpenReviewModal(request)} className="golden-gradient text-black font-semibold w-full">
                                    <Edit3 className="mr-2 h-4 w-4" /> Review Request
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
          </section>

          {/* Section for Managing Existing Creator Tags */}
          <section>
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
              <h2 className="text-3xl font-semibold golden-text mb-4 sm:mb-0 flex items-center">
                <Tag className="w-8 h-8 mr-3 text-yellow-400/80"/> Manage Verified Creators' Tags
              </h2>
              <div className="relative w-full sm:w-auto sm:max-w-xs">
                  <Input 
                      type="text"
                      placeholder="Search creators or tags..."
                      value={searchTermCreators}
                      onChange={(e) => setSearchTermCreators(e.target.value)}
                      className="pl-10 bg-black/20 border-white/10 text-white focus:border-yellow-400 w-full"
                  />
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-yellow-400/70" />
              </div>
            </div>

            {isLoadingCreators && creators.length === 0 && (
                <div className="min-h-[40vh] flex items-center justify-center">
                    <Loader2 className="w-12 h-12 text-yellow-400 animate-spin" />
                    <p className="ml-4 text-xl text-gray-300">Loading Verified Creators...</p>
                </div>
            )}

            {!isLoadingCreators && filteredCreators.length === 0 ? (
              <div className="min-h-[30vh] flex flex-col items-center justify-center text-center p-8 glass-effect rounded-xl">
                  <User className="w-16 h-16 text-yellow-400 mb-6 opacity-70" />
                  <h3 className="text-2xl font-semibold golden-text mb-2">No Creators Found</h3>
                  <p className="text-gray-400">
                      {searchTermCreators ? "No creators match your search criteria." : "There are no verified creators to display."}
                  </p>
              </div>
            ) : (
              <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence>
                  {filteredCreators.map(creator => (
                    <motion.div
                      key={creator.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card className="glass-effect-hoverable h-full flex flex-col">
                        <CardHeader>
                          <CardTitle className="flex justify-between items-center">
                            <span className="truncate mr-2">{creator.full_name || creator.username}</span>
                            <Badge variant="success" className="text-xs">Verified</Badge>
                          </CardTitle>
                          <p className="text-xs text-yellow-400">@{creator.username}</p>
                        </CardHeader>
                        <CardContent className="flex-grow space-y-3">
                          {creator.bio && <p className="text-sm text-gray-400 line-clamp-2">{creator.bio}</p>}
                          <div>
                            <p className="text-sm font-semibold text-gray-300 mb-1">Tags:</p>
                            {creator.creator_tags && creator.creator_tags.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {creator.creator_tags.map(tag => (
                                  <Badge key={tag} variant="secondary" className="text-xs bg-yellow-400/10 text-yellow-300 border-yellow-400/30">{tag}</Badge>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-500">No tags assigned.</p>
                            )}
                          </div>
                           <p className="text-xs text-gray-500 pt-2">
                              Joined: {new Date(creator.created_at).toLocaleDateString()}
                          </p>
                        </CardContent>
                        <CardFooter>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" className="w-full golden-gradient text-black font-semibold hover:opacity-90 proximity-glow-button">
                                <Edit3 className="mr-2 h-4 w-4" /> Edit Tags
                              </Button>
                            </DialogTrigger>
                            <EditCreatorTagsModal creator={creator} onUpdate={handleUpdateCreator} />
                          </Dialog>
                        </CardFooter>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </section>
          {selectedRequest && (
            <ReviewTagRequestModal
                request={selectedRequest}
                isOpen={isReviewModalOpen}
                onClose={() => setIsReviewModalOpen(false)}
                onReviewed={handleRequestReviewed}
            />
          )}
        </div>
      );
    };

    export default AdminCreatorTagsTab;
