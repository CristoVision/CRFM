import { toast } from '@/components/ui/use-toast';

export const loadStateFromLocalStorage = () => {
  try {
    const saved = localStorage.getItem('crfm_player_state');
    return saved ? JSON.parse(saved) : {};
  } catch (error) {
    console.error('Error loading player state:', error);
    return {};
  }
};

export const saveStateToLocalStorage = (state) => {
  try {
    localStorage.setItem('crfm_player_state', JSON.stringify(state));
  } catch (error) {
    console.error('Error saving player state:', error);
  }
};

export const handleStreamPayment = async (spendCrossCoinsFunc, user, track, refreshUserProfile, onSuccess, onFailure) => {
  if (!user) {
    toast({
      title: "Login Required",
      description: "Please log in to play this track.",
      variant: "destructive",
    });
    if (onFailure) onFailure();
    return false;
  }
  
  if (!track.stream_cost || track.stream_cost <= 0) {
    if (onSuccess) onSuccess();
    return true;
  }

  const paymentSuccess = await spendCrossCoinsFunc(track.id);

  if (paymentSuccess) {
    toast({
      title: "Track Unlocked",
      description: `${track.stream_cost} CrossCoins spent to play "${track.title}"`,
      className: "bg-green-600 border-green-700 text-white",
    });
    if (onSuccess) onSuccess();
    return true;
  } else {
    // Error toast is handled inside spendCrossCoins function
    if (onFailure) onFailure();
    return false;
  }
};
