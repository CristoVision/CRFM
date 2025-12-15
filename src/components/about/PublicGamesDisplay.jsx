import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, ExternalLink, Gamepad2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const PublicGamesDisplay = () => {
  const [games, setGames] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPublicGames = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('games')
          .select('id, title, description, media_url, site_url, is_public')
          .eq('is_public', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setGames(data || []);
      } catch (error) {
        toast({
          title: "Error Fetching Games",
          description: "Could not load public games at this time. Please try again later.",
          variant: "error",
        });
        console.error("Error fetching public games:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPublicGames();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] p-6 glass-effect rounded-xl">
        <Loader2 className="w-12 h-12 text-yellow-400 animate-spin mb-4" />
        <p className="text-lg text-gray-300">Loading Games...</p>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] p-6 glass-effect rounded-xl">
        <Gamepad2 className="w-16 h-16 text-yellow-400/70 mb-4" />
        <h3 className="text-2xl font-semibold text-gray-200 mb-2">No Public Games Available</h3>
        <p className="text-gray-400 text-center">Stay tuned for new and exciting game releases!</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
       <h3 className="text-3xl font-bold golden-text flex items-center mb-6">
        <Gamepad2 className="w-8 h-8 mr-3 text-yellow-400" /> Featured Games
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {games.map((game) => (
          <Card key={game.id} className="glass-effect-light flex flex-col justify-between overflow-hidden transform hover:scale-105 transition-transform duration-300 ease-out">
            <CardHeader className="p-0">
              {game.media_url ? (
                <img-replace src={game.media_url} alt={game.title} className="w-full h-48 object-cover" />
              ) : (
                <div className="w-full h-48 bg-gradient-to-br from-neutral-800 to-neutral-700 flex items-center justify-center">
                   <Gamepad2 className="w-16 h-16 text-yellow-400 opacity-50" />
                </div>
              )}
              <div className="p-4">
                <CardTitle className="text-xl golden-text mb-2 truncate" title={game.title}>{game.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-2 flex-grow">
              <p className="text-sm text-gray-400 line-clamp-3 min-h-[60px]">{game.description || 'No description available.'}</p>
            </CardContent>
            <CardFooter className="p-4 bg-black/20">
              {game.site_url ? (
                <Button 
                  asChild 
                  className="w-full golden-gradient text-black font-semibold proximity-glow-button"
                >
                  <a href={game.site_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" /> Play Game
                  </a>
                </Button>
              ) : (
                 <Button disabled className="w-full bg-neutral-600 text-neutral-400 cursor-not-allowed">
                  Link Unavailable
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PublicGamesDisplay;
