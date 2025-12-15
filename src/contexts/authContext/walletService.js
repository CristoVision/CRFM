import { supabase } from '@/lib/supabaseClient';
import { reportClientError } from '@/lib/errorReporter';

export const spendCrossCoinsOnStream = async (trackId) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'User not authenticated' };

  const { data, error } = await supabase.rpc('handle_stream_credit_transfer', {
    p_track_id_streamed: trackId,
    p_listener_user_id: user.id,
  });

  if (error) {
    console.error('Error spending CrossCoins:', error);
    return { success: false, error: 'An error occurred during the transaction.' };
  }

  if (data === false) {
    return { success: false, error: 'Insufficient funds or track has no cost.' };
  }

  return { success: true };
};

export const startOrResumeStream = async (trackId) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'User not authenticated' };

  const { data, error } = await supabase.rpc('start_or_resume_stream', {
    p_track_id: trackId,
    p_user_id: user.id,
    p_client_session_id: `${user.id}-${trackId}`,
  });

  if (error) {
    console.error('Error in start_or_resume_stream:', error);
    return { success: false, error: error.message };
  }

  if (data?.ok === false && data.reason === 'insufficient_funds') {
    return { success: false, error: 'Insufficient funds or track has no cost.' };
  }

  return { success: !!data?.ok, data };
};

export const spendCrossCoinsOnVideo = async (videoId, amount) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'User not authenticated' };

  const normalizedAmount = Number(amount ?? 0);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount < 0) {
    console.error('Invalid amount for video charge', { amount });
    return { success: false, error: 'Invalid amount for video charge.' };
  }

  // If video is free, allow playback without hitting RPC
  if (normalizedAmount === 0) {
    return { success: true, data: { ok: true, reason: 'free_video' } };
  }

  // Try the video-specific RPC first
  const rpcPayload = {
    p_video_id: videoId,
    p_viewer_user_id: user.id,
    p_amount: normalizedAmount,
  };

  const callVideoRpc = () => supabase.rpc('handle_video_credit_transfer', rpcPayload);
  const callStreamRpc = () => supabase.rpc('handle_stream_credit_transfer', {
    p_track_id_streamed: videoId,
    p_listener_user_id: user.id,
  });

  let data;
  let error;

  ({ data, error } = await callVideoRpc());

  // Fallback to stream RPC with same signature to support deployments where the video RPC is missing
  if (error && error.code === 'PGRST202') {
    ({ data, error } = await callStreamRpc());
  }

  if (error) {
    console.error('Error in handle_video_credit_transfer:', error);
    reportClientError({
      source: 'handle_video_credit_transfer',
      message: error.message || 'RPC error',
      context: { videoId, normalizedAmount, error },
    });
    return { success: false, error: error.message || 'RPC error', details: error };
  }

  const isOk = data === true || data?.ok === true;
  if (isOk) {
    return { success: true, data };
  }

  const reason =
    data?.reason ||
    data?.message ||
    (typeof data === 'string' ? data : 'Insufficient funds or video has no cost.');

  return { success: false, error: reason, details: data };
};
