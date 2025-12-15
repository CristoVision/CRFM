import { supabase } from '@/lib/supabaseClient';
import { reportClientError } from './errorReporter';

const VALID_ACTIONS = ['add_funds', 'withdraw', 'redeem_code'];
const MAX_AMOUNT = 1_000_000;
const RPC_NAME = 'request_wallet_action';

export const requestWalletAction = async ({
  userId,
  actionType,
  amount,
  code,
  metadata = {},
  maxDebit,
}) => {
  if (!userId) return { success: false, error: 'User session missing.' };
  if (!VALID_ACTIONS.includes(actionType)) return { success: false, error: 'Unsupported wallet action.' };

  const normalizedMetadata = {
    ...metadata,
    client_context: 'wallet_page',
    client_time: new Date().toISOString(),
  };

  let normalizedAmount = null;
  let normalizedCode = null;

  if (actionType !== 'redeem_code') {
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return { success: false, error: 'Enter a valid amount greater than zero.' };
    }

    if (numericAmount > MAX_AMOUNT) {
      return { success: false, error: 'Amount exceeds the allowed limit.' };
    }

    if (actionType === 'withdraw' && Number.isFinite(maxDebit) && numericAmount > maxDebit) {
      return { success: false, error: 'Withdrawal exceeds available balance.' };
    }

    normalizedAmount = Number(numericAmount.toFixed(2));
  } else {
    normalizedCode = (code || '').trim();
    if (!normalizedCode) {
      return { success: false, error: 'A valid redeem code is required.' };
    }
  }

  const basePayload = {
    user_id: userId,
    action_type: actionType,
    amount: normalizedAmount,
    code: normalizedCode,
    metadata: normalizedMetadata,
    status: 'pending',
    requested_at: new Date().toISOString(),
  };

  const rpcPayload = {
    p_user_id: userId,
    p_action_type: actionType,
    p_amount: normalizedAmount,
    p_code: normalizedCode,
    p_metadata: normalizedMetadata,
  };

  try {
    const { data, error } = await supabase.rpc(RPC_NAME, rpcPayload);

    if (!error) {
      return { success: true, data, via: 'rpc' };
    }

    if (error.code !== 'PGRST202') {
      throw error;
    }
  } catch (error) {
    if (error?.code !== 'PGRST202') {
      reportClientError({
        source: 'wallet_action_request',
        message: error.message,
        context: { actionType, amount: normalizedAmount, code: normalizedCode },
      });
      return { success: false, error: error.message || 'Could not submit request.' };
    }
  }

  try {
    const { data, error } = await supabase
      .from('wallet_action_requests')
      .insert(basePayload)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data, via: 'table' };
  } catch (error) {
    reportClientError({
      source: 'wallet_action_request_fallback',
      message: error.message,
      context: { actionType, amount: normalizedAmount },
    });
    return { success: false, error: error.message || 'Could not save wallet request.' };
  }
};
