import React, { useState, useEffect, useCallback } from 'react';
    import { supabase } from '@/lib/supabaseClient';
    import { useAuth } from '@/contexts/AuthContext';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Textarea } from '@/components/ui/textarea';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Badge } from '@/components/ui/badge';
    import { toast } from '@/components/ui/use-toast';
    import { format } from 'date-fns';
import { Flag, Edit3, Search, Loader2, AlertTriangle, Eye, EyeOff } from 'lucide-react';

    const ITEMS_PER_PAGE = 10;

    const FlagReviewModal = ({ flag, isOpen, onClose, onSave }) => {
      const [currentStatus, setCurrentStatus] = useState(flag?.status || 'pending');
      const [currentAdminFeedback, setCurrentAdminFeedback] = useState(flag?.admin_feedback || '');

      useEffect(() => {
        if (flag) {
          setCurrentStatus(flag.status || 'pending');
          setCurrentAdminFeedback(flag.admin_feedback || '');
        }
      }, [flag]);

      const handleSave = async () => {
        if (!flag) return;
        const updates = {
          status: currentStatus,
          admin_feedback: currentAdminFeedback,
        };
        await onSave(flag.id, updates);
      };

      if (!flag) return null;

      return (
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className="sm:max-w-[525px] glass-effect text-white font-montserrat">
            <DialogHeader>
              <DialogTitle className="golden-text text-2xl">Review Content Flag #{flag.id}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <span className="text-right text-gray-400">Content Type:</span>
                <span className="col-span-3 font-semibold">{flag.flagged_content_type}</span>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <span className="text-right text-gray-400">Content ID:</span>
                <span className="col-span-3 font-semibold">{flag.flagged_content_id}</span>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <span className="text-right text-gray-400">Content Title:</span>
                <span className="col-span-3 font-semibold">{flag.content_title || 'N/A'}</span>
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <span className="text-right text-gray-400 pt-1">Reason:</span>
                <p className="col-span-3 text-sm bg-black/20 p-2 rounded-md border border-yellow-400/20">{flag.flag_reason}</p>
              </div>
               <div className="grid grid-cols-4 items-start gap-4">
                <span className="text-right text-gray-400 pt-1">Uploader Notes:</span>
                <p className="col-span-3 text-sm bg-black/20 p-2 rounded-md border border-yellow-400/20">{flag.uploader_correction_notes || 'No uploader notes provided.'}</p>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <span className="text-right text-gray-400">Status:</span>
                <Select value={currentStatus} onValueChange={setCurrentStatus}>
                  <SelectTrigger className="col-span-3 bg-black/20 border-yellow-400/30 text-white focus:border-yellow-400">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="glass-effect border-yellow-400/30 text-white">
                    {['pending', 'in_review', 'resolved', 'rejected', 'action_needed'].map(s => (
                      <SelectItem key={s} value={s} className="hover:bg-yellow-400/10 focus:bg-yellow-400/20">{s.replace('_', ' ').toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <span className="text-right text-gray-400 pt-1">Admin Feedback:</span>
                <Textarea
                  id="adminFeedback"
                  value={currentAdminFeedback}
                  onChange={(e) => setCurrentAdminFeedback(e.target.value)}
                  className="col-span-3 bg-black/20 border-yellow-400/30 text-white focus:border-yellow-400 min-h-[100px]"
                  placeholder="Provide feedback for the uploader or internal notes..."
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" className="text-gray-300 border-gray-500 hover:border-yellow-400 hover:text-yellow-300">
                  Cancel
                </Button>
              </DialogClose>
              <Button onClick={handleSave} className="golden-gradient text-black font-semibold">
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    };
    
    const AdminContentFlagsTab = () => {
      const { profile } = useAuth();
      const [flags, setFlags] = useState([]);
      const [isLoading, setIsLoading] = useState(true);
      const [searchTerm, setSearchTerm] = useState('');
      const [selectedFlag, setSelectedFlag] = useState(null);
      const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
      const [currentPage, setCurrentPage] = useState(1);
      const [totalFlags, setTotalFlags] = useState(0);
      const [actioningFlagId, setActioningFlagId] = useState(null);

      const fetchContentDetails = useCallback(async (contentType, contentId) => {
        let tableName = '';
        if (contentType === 'track') tableName = 'tracks';
        else if (contentType === 'album') tableName = 'albums';
        else if (contentType === 'playlist') tableName = 'playlists';
        else return 'N/A';

        const { data, error } = await supabase
          .from(tableName)
          .select('title')
          .eq('id', contentId)
          .single();
        
        if (error) {
          console.error(`Error fetching ${contentType} title:`, error);
          return 'Error loading title';
        }
        return data?.title || 'Unknown Title';
      }, []);

      const fetchFlags = useCallback(async (page = 1, search = '') => {
        setIsLoading(true);
        const from = (page - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;

        let query = supabase
          .from('content_flags')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, to);
        
        if (search) {
          query = query.or(`flag_reason.ilike.%${search}%,flagged_content_type.ilike.%${search}%,status.ilike.%${search}%`);
        }

        const { data, error, count } = await query;

        if (error) {
          toast({ title: "Error fetching flags", description: error.message, variant: "destructive" });
          setFlags([]);
        } else {
          const flagsWithTitles = await Promise.all(
            data.map(async (flag) => ({
              ...flag,
              content_title: await fetchContentDetails(flag.flagged_content_type, flag.flagged_content_id),
            }))
          );
          setFlags(flagsWithTitles);
          setTotalFlags(count || 0);
        }
        setIsLoading(false);
      }, [fetchContentDetails]);

      useEffect(() => {
        if (!profile?.is_admin) return;
        fetchFlags(currentPage, searchTerm);
      }, [fetchFlags, currentPage, searchTerm, profile]);

      if (!profile?.is_admin) {
        return (
          <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-8 glass-effect rounded-xl">
            <AlertTriangle className="w-12 h-12 text-yellow-400 mb-4" />
            <h3 className="text-2xl font-semibold text-yellow-300 mb-2">Admin access required</h3>
            <p className="text-gray-400">Only administrators can review content flags.</p>
          </div>
        );
      }

      const handleOpenReviewModal = (flag) => {
        setSelectedFlag(flag);
        setIsReviewModalOpen(true);
      };

      const handleSaveFlagReview = async (flagId, updates) => {
        const { error } = await supabase
          .from('content_flags')
          .update(updates)
          .eq('id', flagId);

        if (error) {
          toast({ title: "Error updating flag", description: error.message, variant: "destructive" });
        } else {
          toast({ title: "Flag updated successfully", className: "bg-green-600 text-white" });
          setIsReviewModalOpen(false);
          fetchFlags(currentPage, searchTerm); // Refresh list
        }
      };

      const handleSetVisibility = async (flag, isPublic) => {
        if (!flag) return;
        setActioningFlagId(flag.id);
        try {
          const { error } = await supabase.rpc('rpc_admin_set_content_visibility', {
            p_admin_id: profile.id,
            p_content_id: flag.flagged_content_id,
            p_content_type: flag.flagged_content_type,
            p_is_public: isPublic,
            p_reason: `flag_${flag.id}_${isPublic ? 'make_public' : 'hide'}`,
          });
          if (error) throw error;
          toast({
            title: isPublic ? 'Content made public' : 'Content hidden',
            description: `${flag.flagged_content_type} visibility updated.`,
            className: 'bg-green-600 text-white',
          });
        } catch (error) {
          toast({ title: 'Visibility change failed', description: error.message, variant: 'destructive' });
        } finally {
          setActioningFlagId(null);
        }
      };
      
      const handleSearchChange = (event) => {
        setSearchTerm(event.target.value);
        setCurrentPage(1); 
      };

      const totalPages = Math.ceil(totalFlags / ITEMS_PER_PAGE);

      const getStatusBadgeVariant = (status) => {
        switch (status) {
          case 'pending': return 'default';
          case 'in_review': return 'secondary';
          case 'resolved': return 'destructive'; // using destructive to make it stand out as green (shadcn default)
          case 'rejected': return 'outline';
          case 'action_needed': return 'default'; // Using default for yellow/gold
          default: return 'secondary';
        }
      };
       const getStatusBadgeClass = (status) => {
        switch (status) {
          case 'pending': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
          case 'in_review': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
          case 'resolved': return 'bg-green-500/20 text-green-300 border-green-500/30';
          case 'rejected': return 'bg-red-500/20 text-red-300 border-red-500/30';
          case 'action_needed': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
          default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
        }
      };


      return (
        <div className="space-y-6 p-1 md:p-4 font-montserrat text-white">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-3xl font-bold golden-text">Content Flag Management</h2>
            <div className="relative w-full sm:w-auto">
              <Input 
                type="search" 
                placeholder="Search flags (reason, type, status)..." 
                value={searchTerm}
                onChange={handleSearchChange}
                className="pl-10 bg-black/20 border-yellow-400/30 focus:border-yellow-400 w-full sm:min-w-[300px]" 
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-yellow-400/70" />
            </div>
          </div>

          {isLoading && (
            <div className="flex justify-center items-center min-h-[300px]">
              <Loader2 className="w-12 h-12 text-yellow-400 animate-spin" />
              <p className="ml-4 text-lg">Loading flags...</p>
            </div>
          )}

          {!isLoading && flags.length === 0 && (
            <div className="text-center py-12 glass-effect rounded-xl">
              <AlertTriangle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
              <h3 className="text-2xl font-semibold mb-2">No Flags Found</h3>
              <p className="text-gray-400">
                {searchTerm ? "No flags match your search criteria." : "There are currently no content flags."}
              </p>
            </div>
          )}

          {!isLoading && flags.length > 0 && (
            <div className="overflow-x-auto glass-effect rounded-xl p-1 sm:p-4">
              <table className="min-w-full divide-y divide-yellow-400/20">
                <thead className="bg-black/30">
                  <tr>
                    {['ID', 'Type', 'Content ID', 'Title', 'Reason', 'Status', 'Admin Feedback', 'Created', 'Actions'].map(header => (
                       <th key={header} scope="col" className="px-4 py-3.5 text-left text-sm font-semibold text-yellow-300">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-yellow-400/10 bg-black/10">
                  {flags.map((flag) => (
                    <tr key={flag.id} className="hover:bg-yellow-400/5 transition-colors">
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-300">{flag.id}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-300 capitalize">{flag.flagged_content_type}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-300">{flag.flagged_content_id}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-300 max-w-[150px] truncate" title={flag.content_title}>{flag.content_title}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-400 max-w-[200px] truncate" title={flag.flag_reason}>{flag.flag_reason}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <Badge variant={getStatusBadgeVariant(flag.status)} className={getStatusBadgeClass(flag.status) + " cursor-default"}>
                          {flag.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-400 max-w-[200px] truncate" title={flag.admin_feedback}>{flag.admin_feedback || 'N/A'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-400">{format(new Date(flag.created_at), 'PPpp')}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm space-y-1">
                        <div className="flex flex-wrap gap-2">
                          <Button onClick={() => handleOpenReviewModal(flag)} size="sm" variant="outline" className="text-yellow-400 border-yellow-400/50 hover:border-yellow-400 hover:bg-yellow-400/10">
                            <Edit3 className="w-4 h-4 mr-1.5" /> Review
                          </Button>
                          <Button
                            onClick={() => handleSetVisibility(flag, false)}
                            size="sm"
                            variant="destructive"
                            disabled={actioningFlagId === flag.id}
                            className="bg-red-600/80 hover:bg-red-600 text-white"
                          >
                            <EyeOff className="w-4 h-4 mr-1" /> Hide
                          </Button>
                          <Button
                            onClick={() => handleSetVisibility(flag, true)}
                            size="sm"
                            variant="secondary"
                            disabled={actioningFlagId === flag.id}
                            className="bg-emerald-600/80 hover:bg-emerald-600 text-white"
                          >
                            <Eye className="w-4 h-4 mr-1" /> Make public
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {totalFlags > ITEMS_PER_PAGE && !isLoading && flags.length > 0 && (
            <div className="flex justify-between items-center mt-6">
              <Button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                disabled={currentPage === 1}
                variant="outline" className="text-gray-300 border-gray-500 hover:border-yellow-400 hover:text-yellow-300"
              >
                Previous
              </Button>
              <span className="text-sm text-gray-400">Page {currentPage} of {totalPages}</span>
              <Button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                disabled={currentPage === totalPages}
                variant="outline" className="text-gray-300 border-gray-500 hover:border-yellow-400 hover:text-yellow-300"
              >
                Next
              </Button>
            </div>
          )}
          {selectedFlag && (
            <FlagReviewModal
              flag={selectedFlag}
              isOpen={isReviewModalOpen}
              onClose={() => setIsReviewModalOpen(false)}
              onSave={handleSaveFlagReview}
            />
          )}
        </div>
      );
    };

    export default AdminContentFlagsTab;
