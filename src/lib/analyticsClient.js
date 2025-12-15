import { supabase } from '@/lib/supabaseClient';

const sessionKey = 'crfm_analytics_session';
const lastTrackLog = new Map(); // trackId -> timestamp ms

const getSessionId = () => {
  let sid = null;
  try {
    sid = localStorage.getItem(sessionKey);
  } catch {
    /* noop */
  }
  if (!sid) {
    const generated = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    try {
      localStorage.setItem(sessionKey, generated);
    } catch {
      /* noop */
    }
    sid = generated;
  }
  return sid;
};

export const logTrackPlay = async ({
  trackId,
  userId = null,
  isPaid = false,
  amountCreatorCents = 0,
  amountOrgCents = 0,
  currencyCode = 'USD',
  source = 'web',
  country = null,
  city = null,
  playMs = 0,
  completed = false,
}) => {
  if (!trackId) return;

  // basic dedupe: avoid logging same track within 10s window
  const now = Date.now();
  const last = lastTrackLog.get(trackId);
  if (!completed && last && now - last < 10000) return;
  lastTrackLog.set(trackId, now);

  const payload = {
    track_id: trackId,
    user_id: userId,
    is_paid: !!isPaid,
    amount_creator_cents: amountCreatorCents || 0,
    amount_org_cents: amountOrgCents || 0,
    currency_code: currencyCode || 'USD',
    source,
    country,
    city,
    play_ms: Math.max(0, Math.floor(playMs || 0)),
    completed: !!completed,
    client_session_id: getSessionId(),
  };

  const { error } = await supabase.from('track_streams').insert(payload);
  if (error) {
    console.error('logTrackPlay error', error);
  }
};

export const logContentView = async ({
  resourceType,
  resourceId = null,
  path = null,
  referrer = null,
  userId = null,
  country = null,
  city = null,
  source = 'web',
  medium = null,
  campaign = null,
}) => {
  if (!resourceType) return;
  const payload = {
    user_id: userId,
    session_id: getSessionId(),
    resource_type: resourceType,
    resource_id: resourceId,
    path,
    referrer,
    country,
    city,
    source,
    medium,
    campaign,
  };
  const { error } = await supabase.from('content_view_events').insert(payload);
  if (error) {
    console.error('logContentView error', error);
  }
};
