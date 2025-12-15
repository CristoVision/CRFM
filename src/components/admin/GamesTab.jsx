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
import { PlusCircle, Edit, Trash2, Eye, EyeOff, Gamepad2 as GameIcon, Users, Loader2, AlertTriangle, Info, PlayCircle } from 'lucide-react';
import GameFormModal from './GameFormModal'; 
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

const GamesTab = () => {
  const { user, profile } = useAuth();
  const [games, setGames] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const [profilesCache, setProfilesCache] = useState({});
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [gameToDelete, setGameToDelete] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalGames, setTotalGames] = useState(0);

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

  const fetchGames = useCallback(async (page = 1) => {
    setIsLoading(true);
    const from = (page - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    try {
      const { data, error, count } = await supabase
        .from('games')
        .select('id, title, description, media_url, site_url, is_public, created_by, updated_by, created_at, updated_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      const gamesWithUsernames = await Promise.all(
        data.map(async (game) => ({
          ...game,
          created_by_username: await fetchUsername(game.created_by),
          updated_by_username: await fetchUsername(game.updated_by),
        }))
      );
      setGames(gamesWithUsernames);
      setTotalGames(count || 0);
    } catch (error) {
      toast({ title: "Error Fetching Games", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [fetchUsername]);

  useEffect(() => {
    if (profile?.is_admin) {
      fetchGames(currentPage);
    } else {
      setIsLoading(false);
      setGames([]);
    }
  }, [profile, fetchGames, currentPage]);

  const handleCreateGame = () => {
    setSelectedGame(null);
    setIsModalOpen(true);
  };

  const handleEditGame = (game) => {
    setSelectedGame(game);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedGame(null);
  };

  const handleModalSuccess = () => {
    handleModalClose();
    fetchGames(currentPage); 
  };

  const promptDeleteGame = (game) => {
    setGameToDelete(game);
    setIsConfirmDeleteDialogOpen(true);
  };

  const handleDeleteGame = async () => {
    if (!gameToDelete || !profile?.is_admin) return;
    try {
      const { error } = await supabase.from('games').delete().eq('id', gameToDelete.id);
      if (error) throw error;
      toast({ title: "Game Deleted", description: `${gameToDelete.title} has been successfully deleted.`, className: "bg-green-600 text-white" });
      fetchGames(currentPage);
    } catch (error) {
      toast({ title: "Error Deleting Game", description: error.message, variant: "destructive" });
    } finally {
      setIsConfirmDeleteDialogOpen(false);
      setGameToDelete(null);
    }
  };

  const handleTogglePublic = async (game, newPublicState) => {
    if (!profile?.is_admin) return;
    try {
      const { error } = await supabase
        .from('games')
        .update({ is_public: newPublicState, updated_by: user.id, updated_at: new Date().toISOString() })
        .eq('id', game.id);
      if (error) throw error;
      toast({ title: "Visibility Updated", description: `${game.title}'s visibility set to ${newPublicState ? 'Public' : 'Private'}.`, className: "bg-blue-600 text-white" });
      fetchGames(currentPage);
    } catch (error) {
      toast({ title: "Error Updating Visibility", description: error.message, variant: "destructive" });
    }
  };
  
  const totalPages = Math.ceil(totalGames / ITEMS_PER_PAGE);

  if (!profile?.is_admin) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8 glass-effect rounded-xl">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-6 opacity-70" />
        <h2 className="text-3xl font-bold text-red-400 mb-4">Access Denied</h2>
        <p className="text-xl text-gray-300">You do not have permission to manage games.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6 font-montserrat text-white">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold golden-text flex items-center">
          <GameIcon className="w-8 h-8 mr-3" /> Game Management
        </h2>
        <Button onClick={handleCreateGame} className="golden-gradient text-black font-semibold proximity-glow-button">
          <PlusCircle className="w-5 h-5 mr-2" /> Create New Game
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center items-center min-h-[300px]">
          <Loader2 className="w-12 h-12 text-yellow-400 animate-spin" />
          <p className="ml-4 text-lg">Loading games...</p>
        </div>
      )}

      {!isLoading && games.length === 0 && (
        <div className="text-center py-12 glass-effect rounded-xl">
          <AlertTriangle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h3 className="text-2xl font-semibold mb-2">No Games Found</h3>
          <p className="text-gray-400">Get started by creating a new game.</p>
        </div>
      )}

      {!isLoading && games.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {games.map((game) => (
            <Card key={game.id} className="glass-effect-light flex flex-col justify-between">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl golden-text mb-2">{game.title}</CardTitle>
                  <Badge variant={game.is_public ? 'success' : 'secondary'} className="text-xs whitespace-nowrap">
                    {game.is_public ? <Eye className="w-3 h-3 mr-1" /> : <EyeOff className="w-3 h-3 mr-1" />}
                    {game.is_public ? 'Public' : 'Private'}
                  </Badge>
                </div>
                <p className="text-sm text-gray-400 line-clamp-3 min-h-[60px]">{game.description || 'No description available.'}</p>
                {game.media_url && (
                  <div className="mt-2">
                    <img-replace src={game.media_url} alt={game.title} className="rounded-md object-cover h-40 w-full" />
                  </div>
                )}
                 {game.site_url && (
                  <a 
                    href={game.site_url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="inline-flex items-center mt-3 text-sm text-yellow-300 hover:text-yellow-200 transition-colors font-semibold proximity-glow-link-xs"
                  >
                    <PlayCircle className="w-4 h-4 mr-1.5" /> Play Game
                  </a>
                )}
              </CardHeader>
              <CardContent className="pt-2 text-xs text-gray-500 space-y-1">
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center cursor-default">
                        <Info size={14} className="mr-1.5 text-yellow-400/70" />
                        <span>Created: {formatDistanceToNow(new Date(game.created_at), { addSuffix: true })} by {game.created_by_username}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="glass-effect text-white border-yellow-400/30">
                      <p>Created At: {format(new Date(game.created_at), 'PPpp')}</p>
                      <p>By: {game.created_by_username || 'System'}</p>
                      {game.updated_at && game.updated_by && (
                        <>
                          <p className="mt-1 pt-1 border-t border-yellow-400/20">Last Updated: {format(new Date(game.updated_at), 'PPpp')}</p>
                          <p>By: {game.updated_by_username || 'System'}</p>
                        </>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardContent>
              <CardFooter className="flex justify-between items-center p-4 border-t border-yellow-400/10">
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={() => handleEditGame(game)} className="text-blue-400 border-blue-400/50 hover:border-blue-400 hover:bg-blue-400/10">
                    <Edit className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => promptDeleteGame(game)} className="text-red-400 border-red-400/50 hover:border-red-400 hover:bg-red-400/10">
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                  </Button>
                </div>
                <div className="flex items-center space-x-2">
                  <Label htmlFor={`public-switch-${game.id}`} className="text-xs text-gray-400 select-none">Public</Label>
                  <Switch
                    id={`public-switch-${game.id}`}
                    checked={game.is_public}
                    onCheckedChange={(checked) => handleTogglePublic(game, checked)}
                    className="data-[state=checked]:bg-yellow-400"
                  />
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && totalGames > ITEMS_PER_PAGE && (
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
        <GameFormModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
          gameData={selectedGame}
          currentUserId={user?.id}
        />
      )}

      <AlertDialog open={isConfirmDeleteDialogOpen} onOpenChange={setIsConfirmDeleteDialogOpen}>
        <AlertDialogContent className="glass-effect text-white font-montserrat">
          <AlertDialogHeader>
            <AlertDialogTitle className="golden-text">Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              Are you sure you want to delete the game "<strong>{gameToDelete?.title}</strong>"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-gray-300 border-gray-500 hover:border-yellow-400 hover:text-yellow-300">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGame} className="bg-red-600 hover:bg-red-700 text-white">
              Delete Game
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default GamesTab;
