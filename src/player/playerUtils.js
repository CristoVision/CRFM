import { toast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';
import React from 'react';

export const LOCAL_STORAGE_KEY = 'crfm_player_state';

export const loadStateFromLocalStorage = () => {
  const savedState = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (savedState) {
    try {
      return JSON.parse(savedState);
    } catch (e) {
      console.error("Failed to parse player state from localStorage", e);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }
  return {};
};

export const saveStateToLocalStorage = (state) => {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
};

export const handleStreamPayment = async (supabase, user, trackToPlay, refreshUserProfile, onPaymentSuccess, onPaymentFailure) => {
  if (!user) {
    toast({ title: "Login Required", description: "Please log in to play this track.", variant: "destructive" });
    onPaymentFailure?.();
    return false;
  }

  try {
    const { data, error } = await supabase.rpc(
      'handle_stream_credit_transfer',
      {
        p_listener_user_id: user.id,
        p_track_id_streamed: trackToPlay.id
      }
    );

    if (error) {
      console.error("RPC Error:", error);
      toast({ title: "Error", description: "Unable to process play. Please try again.", variant: "destructive" });
      onPaymentFailure?.();
      return false;
    }

    if (data === true) {
      toast({ title: "Success", description: `-${trackToPlay.stream_cost} CC deducted for ${trackToPlay.title}`, className: "bg-green-600 text-white" });
      await refreshUserProfile();
      onPaymentSuccess?.();
      return true;
    } else {
      let description = "Unable to process play. Please try again.";
      if (typeof data === 'string' && data.includes('Insufficient funds')) {
        description = (
          <span>
            You need more CrossCoins to play this track. {}
            <Link to="/wallet" className="underline text-yellow-400 hover:text-yellow-300">
              Top-up Now
            </Link>
          </span>
        );
      } else if (typeof data === 'string') {
        description = data;
      }
      toast({ title: "Playback Failed", description, variant: "destructive" });
      onPaymentFailure?.();
      return false;
    }
  } catch (rpcError) {
    console.error("Unexpected RPC Error:", rpcError);
    toast({ title: "Error", description: "An unexpected error occurred. Please try again.", variant: "destructive" });
    onPaymentFailure?.();
    return false;
  }
};
