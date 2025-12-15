import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Trophy, Loader2, AlertTriangle, CheckCircle, Bell, BellOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const AchievementsPanel = ({ userId }) => {
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAchievements = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('user_achievements')
        .select(`
          id,
          unlocked_at,
          notified_followers,
          achievement:achievements (name, description, icon_url, is_milestone),
          track:tracks (id, title)
        `)
        .eq('user_id', userId)
        .order('unlocked_at', { ascending: false });

      if (fetchError) throw fetchError;
      setAchievements(data || []);
    } catch (err) {
      setError(err.message);
      toast({ title: "Error Loading Achievements", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  const handleToggleNotifyFollowers = async (userAchievementId, currentValue) => {
    try {
      const { error: updateError } = await supabase
        .from('user_achievements')
        .update({ notified_followers: !currentValue })
        .eq('id', userAchievementId)
        .eq('user_id', userId); // Extra security check

      if (updateError) throw updateError;
      
      toast({ 
        title: "Notification Preference Updated", 
        description: `Follower notifications for this milestone are now ${!currentValue ? 'ON' : 'OFF'}.`,
        className: !currentValue ? "bg-green-600 text-white" : "bg-blue-600 text-white"
      });
      fetchAchievements(); // Refresh the list
      
      // Here you would typically trigger a Supabase Edge Function or RPC 
      // to actually send notifications if `!currentValue` is true (i.e., toggled ON)
      // For now, this is just a UI toggle.
      if (!currentValue) {
        // Example: await supabase.functions.invoke('notify-followers-of-milestone', { body: { userAchievementId } })
        console.log("Placeholder: Notify followers for achievement ID:", userAchievementId);
      }

    } catch (err) {
      toast({ title: "Error Updating Preference", description: err.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <Card className="glass-effect-light min-h-[200px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-yellow-400 animate-spin mr-3" />
        <p className="text-gray-300">Loading Achievements...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="glass-effect-light min-h-[200px] flex flex-col items-center justify-center p-4">
        <AlertTriangle className="w-10 h-10 text-red-500 mb-3" />
        <h4 className="text-lg font-semibold text-red-400 mb-1">Error Loading Achievements</h4>
        <p className="text-sm text-gray-400 text-center">{error}</p>
      </Card>
    );
  }

  if (achievements.length === 0) {
    return (
      <Card className="glass-effect-light min-h-[200px] flex flex-col items-center justify-center p-4">
        <Trophy className="w-12 h-12 text-yellow-400/70 mb-4" />
        <h4 className="text-xl font-semibold text-gray-200 mb-2">No Achievements Unlocked Yet</h4>
        <p className="text-sm text-gray-400 text-center">Keep creating and sharing awesome content!</p>
      </Card>
    );
  }

  return (
    <Card className="glass-effect-light">
      <CardHeader>
        <CardTitle className="golden-text flex items-center"><Trophy className="mr-2 h-6 w-6 text-yellow-400"/>Unlocked Achievements</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
          {achievements.map((ua) => (
            <li key={ua.id} className="p-4 rounded-lg border border-yellow-400/20 bg-black/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex-grow">
                <div className="flex items-center mb-1">
                  {ua.achievement.icon_url ? (
                    <img-replace src={ua.achievement.icon_url} alt={ua.achievement.name} className="w-6 h-6 mr-2 rounded-full" />
                  ) : (
                    <CheckCircle className="w-6 h-6 mr-2 text-green-400" />
                  )}
                  <h5 className="font-semibold text-yellow-300">{ua.achievement.name}</h5>
                </div>
                <p className="text-xs text-gray-400 ml-8 sm:ml-0">{ua.achievement.description} 
                  {ua.track && ` for "${ua.track.title}"`}
                </p>
                <p className="text-xs text-gray-500 mt-1 ml-8 sm:ml-0">Unlocked {formatDistanceToNow(new Date(ua.unlocked_at), { addSuffix: true })}</p>
              </div>
              
              {ua.achievement.is_milestone && (
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center space-x-2 mt-2 sm:mt-0 self-start sm:self-center">
                        <Label htmlFor={`notify-${ua.id}`} className="text-xs text-gray-400 cursor-pointer select-none flex items-center">
                          {ua.notified_followers ? <Bell className="w-3 h-3 mr-1 text-green-400"/> : <BellOff className="w-3 h-3 mr-1 text-red-400"/>}
                           Notify Followers
                        </Label>
                        <Switch
                          id={`notify-${ua.id}`}
                          checked={ua.notified_followers}
                          onCheckedChange={() => handleToggleNotifyFollowers(ua.id, ua.notified_followers)}
                          className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="glass-effect text-white border-yellow-400/30 max-w-xs">
                      <p>Toggle this to notify your followers about this milestone. This feature is illustrative; actual follower notification requires a backend process.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

export default AchievementsPanel;
