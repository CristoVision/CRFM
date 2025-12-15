import { supabase } from '@/lib/supabaseClient';
import { reportClientError } from './errorReporter';

export const redeemCode = async ({ code, metadata = {} }) => {
  const normalizedCode = (code || '').trim().toUpperCase();
  if (!normalizedCode) return { success: false, error: 'A valid code is required.' };

  const payload = {
    p_code: normalizedCode,
    p_metadata: {
      ...metadata,
      client_context: 'wallet_page',
      client_time: new Date().toISOString(),
    },
  };

  try {
    const { data, error } = await supabase.rpc('redeem_code', payload);
    if (!error) return { success: true, data, via: 'rpc' };

    if (error.code !== 'PGRST202') throw error;
    return { success: false, error: 'Redeem codes are not enabled on this deployment yet.' };
  } catch (error) {
    reportClientError({
      source: 'redeem_code',
      message: error.message || 'RPC error',
      context: { code: normalizedCode },
    });
    return { success: false, error: error.message || 'Could not redeem code.' };
  }
};

export const purchaseCreatorMembership = async ({ creatorId, tierId, code, metadata = {} }) => {
  if (!creatorId || !tierId) return { success: false, error: 'Missing creator or tier.' };

  const payload = {
    p_creator_id: creatorId,
    p_tier_id: tierId,
    p_code: code ? String(code).trim().toUpperCase() : null,
    p_metadata: {
      ...metadata,
      client_context: 'creator_membership',
      client_time: new Date().toISOString(),
    },
  };

  try {
    const { data, error } = await supabase.rpc('purchase_creator_membership', payload);
    if (!error) return { success: true, data, via: 'rpc' };

    if (error.code !== 'PGRST202') throw error;
    return { success: false, error: 'Membership purchases are not enabled on this deployment yet.' };
  } catch (error) {
    reportClientError({
      source: 'purchase_creator_membership',
      message: error.message || 'RPC error',
      context: { creatorId, tierId, code: payload.p_code },
    });
    return { success: false, error: error.message || 'Could not complete membership purchase.' };
  }
};

