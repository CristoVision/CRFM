import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/components/ui/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { PlusCircle, Edit, Trash2, Eye, EyeOff, Package, Loader2, AlertTriangle, Info, ExternalLink } from 'lucide-react';
import AppFormModal from './AppFormModal'; 
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ITEMS_PER_PAGE = 9; 

const AppsTab = () => {
  const { user, profile } = useAuth();
  const [apps, setApps] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [profilesCache, setProfilesCache] = useState({});
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [appToDelete, setAppToDelete] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalApps, setTotalApps] = useState(0);

  const fetchUsername = useCallback(async (userId) => {
    if (!userId) return 'System';
    if (profilesCache[userId]) return profilesCache[userId];

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .single();
      if (error) throw error;
      if (data) {
        setProfilesCache(prev => ({ ...prev, [userId]: data.username }));
        return data.username;
      }
    } catch (error) {
      console.error('Error fetching username:', error);
      return 'Unknown User';
    }
    return 'Unknown User';
  }, [profilesCache]);

  const fetchApps = useCallback(async (page = 1) => {
    setIsLoading(true);
    const from = (page - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    try {
      const { data, error, count } = await supabase
        .from('apps')
        .select('id, title, description, media_url, site_url, is_public, created_by, updated_by, created_at, updated_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      const appsWithUsernames = await Promise.all(
        data.map(async (app) => ({
          ...app,
          created_by_username: await fetchUsername(app.created_by),
          updated_by_username: await fetchUsername(app.updated_by),
        }))
      );
      setApps(appsWithUsernames);
      setTotalApps(count || 0);
    } catch (error) {
      toast({ title: "Error Fetching Apps", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [fetchUsername]);

  useEffect(() => {
    if (profile?.is_admin) {
      fetchApps(currentPage);
    } else {
      setIsLoading(false);
      setApps([]);
    }
  }, [profile, fetchApps, currentPage]);

  const handleCreateApp = () => {
    setSelectedApp(null);
    setIsModalOpen(true);
  };

  const handleEditApp = (app) => {
    setSelectedApp(app);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedApp(null);
  };

  const handleModalSuccess = () => {
    handleModalClose();
    fetchApps(currentPage); 
  };

  const promptDeleteApp = (app) => {
    setAppToDelete(app);
    setIsConfirmDeleteDialogOpen(true);
  };

  const handleDeleteApp = async () => {
    if (!appToDelete || !profile?.is_admin) return;
    try {
      const { error } = await supabase.from('apps').delete().eq('id', appToDelete.id);
      if (error) throw error;
      toast({ title: "App Deleted", description: `${appToDelete.title} has been successfully deleted.`, className: "bg-green-600 text-white" });
      fetchApps(currentPage);
    } catch (error) {
      toast({ title: "Error Deleting App", description: error.message, variant: "destructive" });
    } finally {
      setIsConfirmDeleteDialogOpen(false);
      setAppToDelete(null);
    }
  };

  const handleTogglePublic = async (app, newPublicState) => {
    if (!profile?.is_admin || !user?.id) return;
    try {
      const { error } = await supabase
        .from('apps')
        .update({ 
          is_public: newPublicState, 
          updated_by: user.id, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', app.id);
      if (error) throw error;
      toast({ title: "Visibility Updated", description: `${app.title}'s visibility set to ${newPublicState ? 'Public' : 'Private'}.`, className: "bg-blue-600 text-white" });
      fetchApps(currentPage);
    } catch (error) {
      toast({ title: "Error Updating Visibility", description: error.message, variant: "destructive" });
    }
  };
  
  const totalPages = Math.ceil(totalApps / ITEMS_PER_PAGE);

  if (!profile?.is_admin) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8 glass-effect rounded-xl">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-6 opacity-70" />
        <h2 className="text-3xl font-bold text-red-400 mb-4">Access Denied</h2>
        <p className="text-xl text-gray-300">You do not have permission to manage apps.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6 font-montserrat text-white">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold golden-text flex items-center">
          <Package className="w-8 h-8 mr-3" /> App Management
        </h2>
        <Button onClick={handleCreateApp} className="golden-gradient text-black font-semibold proximity-glow-button">
          <PlusCircle className="w-5 h-5 mr-2" /> Create New App
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center items-center min-h-[300px]">
          <Loader2 className="w-12 h-12 text-yellow-400 animate-spin" />
          <p className="ml-4 text-lg">Loading apps...</p>
        </div>
      )}

      {!isLoading && apps.length === 0 && (
        <div className="text-center py-12 glass-effect rounded-xl">
          <AlertTriangle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h3 className="text-2xl font-semibold mb-2">No Apps Found</h3>
          <p className="text-gray-400">Get started by creating a new app.</p>
        </div>
      )}

      {!isLoading && apps.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {apps.map((app) => (
            <Card key={app.id} className="glass-effect-light flex flex-col justify-between">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl golden-text mb-2">{app.title}</CardTitle>
                  <Badge variant={app.is_public ? 'success' : 'secondary'} className={`text-xs whitespace-nowrap ${app.is_public ? 'bg-green-500/30 text-green-300 border-green-500/40' : 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                    {app.is_public ? <Eye className="w-3 h-3 mr-1" /> : <EyeOff className="w-3 h-3 mr-1" />}
                    {app.is_public ? 'Public' : 'Private'}
                  </Badge>
                </div>
                <p className="text-sm text-gray-400 line-clamp-3 min-h-[60px]">{app.description || 'No description available.'}</p>
                {app.media_url && (
                  <div className="mt-2">
                    <img-replace src={app.media_url} alt={app.title} className="rounded-md object-cover h-40 w-full" />
                  </div>
                )}
                {app.site_url && (
                  <a 
                    href={app.site_url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="inline-flex items-center mt-3 text-sm text-yellow-300 hover:text-yellow-200 transition-colors font-semibold proximity-glow-link-xs"
                  >
                    <ExternalLink className="w-4 h-4 mr-1.5" /> Visit App
                  </a>
                )}
              </CardHeader>
              <CardContent className="pt-2 text-xs text-gray-500 space-y-1">
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center cursor-default">
                        <Info size={14} className="mr-1.5 text-yellow-400/70" />
                        <span>Created: {formatDistanceToNow(new Date(app.created_at), { addSuffix: true })} by {app.created_by_username}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="glass-effect text-white border-yellow-400/30">
                      <p>Created At: {format(new Date(app.created_at), 'PPpp')}</p>
                      <p>By: {app.created_by_username || 'System'}</p>
                      {app.updated_at && app.updated_by && (
                        <>
                          <p className="mt-1 pt-1 border-t border-yellow-400/20">Last Updated: {format(new Date(app.updated_at), 'PPpp')}</p>
                          <p>By: {app.updated_by_username || 'System'}</p>
                        </>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardContent>
              <CardFooter className="flex justify-between items-center p-4 border-t border-yellow-400/10">
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={() => handleEditApp(app)} className="text-blue-400 border-blue-400/50 hover:border-blue-400 hover:bg-blue-400/10">
                    <Edit className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => promptDeleteApp(app)} className="text-red-400 border-red-400/50 hover:border-red-400 hover:bg-red-400/10">
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                  </Button>
                </div>
                <div className="flex items-center space-x-2">
                  <Label htmlFor={`public-switch-${app.id}`} className="text-xs text-gray-400 select-none">Public</Label>
                  <Switch
                    id={`public-switch-${app.id}`}
                    checked={app.is_public}
                    onCheckedChange={(checked) => handleTogglePublic(app, checked)}
                    className="data-[state=checked]:bg-yellow-400"
                  />
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && totalApps > ITEMS_PER_PAGE && (
        <div className="flex justify-center items-center mt-8 space-x-2">
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

      {isModalOpen && (
        <AppFormModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
          appData={selectedApp}
          currentUserId={user?.id}
        />
      )}

      <AlertDialog open={isConfirmDeleteDialogOpen} onOpenChange={setIsConfirmDeleteDialogOpen}>
        <AlertDialogContent className="glass-effect text-white font-montserrat">
          <AlertDialogHeader>
            <AlertDialogTitle className="golden-text">Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              Are you sure you want to delete the app "<strong>{appToDelete?.title}</strong>"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-gray-300 border-gray-500 hover:border-yellow-400 hover:text-yellow-300">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteApp} className="bg-red-600 hover:bg-red-700 text-white">
              Delete App
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default AppsTab;
