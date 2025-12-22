import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0?target=deno';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

type RouteContext = {
  path?: string;
  search?: string;
  section?: string;
  entity?: { type: string; id: string } | null;
};

type ActionPayload = {
  id?: string;
  type: string;
  label?: string;
  payload?: Record<string, unknown>;
};

type ChatRequest = {
  message?: string;
  conversationId?: string | null;
  routeContext?: RouteContext;
  role?: string;
  action?: ActionPayload | null;
};

type Profile = {
  id: string;
  is_admin?: boolean;
  is_verified_creator?: boolean;
  display_name?: string | null;
  username?: string | null;
};

type ToolContext = {
  supabase: ReturnType<typeof createClient>;
  userId: string | null;
  role: string;
  profile: Profile | null;
};

const TOOL_ALLOWLIST: Record<string, string[]> = {
  guest: ['search_help', 'list_help'],
  user: ['search_help', 'list_help', 'get_wallet_balance', 'create_playlist'],
  creator: ['search_help', 'list_help', 'get_wallet_balance', 'create_playlist', 'list_creator_tracks', 'update_track_metadata'],
  admin: [
    'search_help',
    'list_help',
    'get_wallet_balance',
    'create_playlist',
    'list_creator_tracks',
    'update_track_metadata',
    'list_beta_applications',
    'list_content_flags'
  ]
};

const HELP_INTENTS = [
  { match: ['crosscoin', 'cross coin', 'cc', 'pay-per-play', 'pay per play'], slug: 'crosscoins-pay-per-play' },
  { match: ['upload', 'subir', '10%', '100%', 'membership', 'membresia'], slug: 'upload-options' },
  { match: ['lrc', 'karaoke', 'lyrics'], slug: 'lrc-karaoke' },
  { match: ['video cover', 'cover', '5-10'], slug: 'video-cover' },
  { match: ['radio', 'station'], slug: 'radio-stations' },
  { match: ['marketplace', 'digital', 'descarga'], slug: 'marketplace-digital-downloads' },
  { match: ['standard', 'cristiano', 'christian'], slug: 'crfm-christian-standard' },
  { match: ['distrokid', 'distribution', 'distribuidor'], slug: 'integrations-upcoming' }
];

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...init.headers
    }
  });
}

function getBearerToken(req: Request) {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer (.+)$/i);
  return match?.[1] || null;
}

function resolveRole(userId: string | null, profile: Profile | null) {
  if (!userId) return 'guest';
  if (profile?.is_admin) return 'admin';
  if (profile?.is_verified_creator) return 'creator';
  return 'user';
}

function isToolAllowed(role: string, toolName: string) {
  return TOOL_ALLOWLIST[role]?.includes(toolName);
}

function isExplicitActionRequest(message: string) {
  return /(crea|crear|haz|ejecuta|actualiza|publica|despublica|borrar|elimina)/i.test(message);
}

async function fetchProfile(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, is_admin, is_verified_creator, display_name, username')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data as Profile;
}

async function ensureConversation(
  supabase: ReturnType<typeof createClient>,
  userId: string | null,
  role: string,
  conversationId: string | null | undefined,
  routeContext?: RouteContext
) {
  if (!userId) return null;
  if (conversationId) {
    const { data } = await supabase
      .from('assistant_conversations')
      .select('id')
      .eq('id', conversationId)
      .single();
    if (data?.id) return data.id as string;
  }

  const { data, error } = await supabase
    .from('assistant_conversations')
    .insert({
      user_id: userId,
      role,
      route_context: routeContext || {}
    })
    .select('id')
    .single();

  if (error) return null;
  return data?.id || null;
}

async function insertMessage(
  supabase: ReturnType<typeof createClient>,
  conversationId: string | null,
  senderRole: string,
  body: string,
  toolName?: string,
  toolPayload?: Record<string, unknown>
) {
  if (!conversationId) return;
  await supabase.from('assistant_messages').insert({
    conversation_id: conversationId,
    sender_role: senderRole,
    body,
    tool_name: toolName || null,
    tool_payload: toolPayload || null
  });
}

function buildDeniedResponse() {
  return {
    reply: 'No está permitido por tu nivel de acceso (RLS/rol). Si necesitas, puedo ayudarte a solicitar acceso.'
  };
}

async function searchHelpArticles(supabase: ReturnType<typeof createClient>, query: string) {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const { data } = await supabase
    .from('crfm_help_articles')
    .select('slug, title, body_md, tags')
    .or(`title.ilike.%${trimmed}%,body_md.ilike.%${trimmed}%`)
    .limit(3);
  return data || [];
}

async function fetchHelpBySlug(supabase: ReturnType<typeof createClient>, slug: string) {
  const { data } = await supabase
    .from('crfm_help_articles')
    .select('slug, title, body_md, tags')
    .eq('slug', slug)
    .single();
  return data || null;
}

async function toolGetWalletBalance(context: ToolContext) {
  if (!context.userId) return buildDeniedResponse();
  const { data, error } = await context.supabase
    .from('profiles')
    .select('wallet_balance, withdrawable_balance')
    .eq('id', context.userId)
    .single();
  if (error) return buildDeniedResponse();
  const wallet = Number(data?.wallet_balance || 0);
  const withdrawable = Number(data?.withdrawable_balance || 0);
  return {
    reply: `Tu saldo actual es ${wallet.toFixed(2)} CC. Retirable: ${withdrawable.toFixed(2)} CC.`
  };
}

async function toolCreatePlaylist(context: ToolContext, payload?: Record<string, unknown>) {
  if (!context.userId) return buildDeniedResponse();
  const title = String(payload?.title || '').trim();
  if (!title) {
    return { reply: 'Necesito el título de la playlist para crearla.' };
  }
  const description = String(payload?.description || '').trim() || null;
  const { data, error } = await context.supabase
    .from('playlists')
    .insert({
      creator_id: context.userId,
      title,
      description,
      is_public: false
    })
    .select('id')
    .single();
  if (error) return buildDeniedResponse();
  return {
    reply: `Listo. Creé la playlist "${title}".`,
    actions: [
      {
        id: `open-playlist-${data?.id}`,
        label: 'Abrir playlist',
        clientAction: 'navigate',
        payload: { path: `/playlist/${data?.id}` }
      }
    ]
  };
}

async function toolListCreatorTracks(context: ToolContext) {
  if (!context.userId) return buildDeniedResponse();
  const { data, error } = await context.supabase
    .from('tracks')
    .select('id, title, is_public, created_at')
    .eq('uploader_id', context.userId)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) return buildDeniedResponse();
  if (!data || data.length === 0) {
    return { reply: 'No encuentro tracks aún. ¿Quieres subir uno nuevo desde el Hub?' };
  }
  const lines = data.map((row) => `• ${row.title} (${row.is_public ? 'publico' : 'borrador'})`).join('\n');
  return {
    reply: `Estos son tus últimos tracks:\n${lines}`
  };
}

async function toolUpdateTrackMetadata(context: ToolContext, payload?: Record<string, unknown>) {
  if (!context.userId) return buildDeniedResponse();
  const trackId = String(payload?.trackId || '').trim();
  if (!trackId) return { reply: 'Necesito el ID del track para actualizarlo.' };

  const allowedPatch: Record<string, unknown> = {};
  for (const field of ['title', 'genre', 'is_public', 'lyrics_text', 'cover_art_url']) {
    if (payload && field in payload) {
      allowedPatch[field] = payload[field];
    }
  }

  if (Object.keys(allowedPatch).length === 0) {
    return { reply: 'No encontré cambios válidos para aplicar.' };
  }

  const { data: trackRow, error: trackError } = await context.supabase
    .from('tracks')
    .select('uploader_id')
    .eq('id', trackId)
    .single();
  if (trackError || trackRow?.uploader_id !== context.userId) {
    return buildDeniedResponse();
  }

  const { error } = await context.supabase
    .from('tracks')
    .update(allowedPatch)
    .eq('id', trackId);
  if (error) return buildDeniedResponse();
  return { reply: 'Track actualizado.' };
}

async function toolListBetaApplications(context: ToolContext) {
  if (!context.userId) return buildDeniedResponse();
  const { data, error } = await context.supabase
    .from('beta_applications')
    .select('id, created_at, name, artist_name, status')
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) return buildDeniedResponse();
  if (!data || data.length === 0) return { reply: 'No hay beta applications recientes.' };
  const lines = data.map((row) => `• ${row.artist_name || row.name} — ${row.status || 'pending'}`).join('\n');
  return { reply: `Últimas beta applications:\n${lines}` };
}

async function toolListContentFlags(context: ToolContext) {
  if (!context.userId) return buildDeniedResponse();
  const { data, error } = await context.supabase
    .from('content_flags')
    .select('id, content_type, reason, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) return buildDeniedResponse();
  if (!data || data.length === 0) return { reply: 'No hay reportes recientes.' };
  const lines = data.map((row) => `• ${row.content_type} — ${row.reason || 'sin motivo'} (${row.status || 'open'})`).join('\n');
  return { reply: `Contenido reportado reciente:\n${lines}` };
}

async function handleToolAction(context: ToolContext, action: ActionPayload) {
  if (!isToolAllowed(context.role, action.type)) return buildDeniedResponse();
  switch (action.type) {
    case 'get_wallet_balance':
      return await toolGetWalletBalance(context);
    case 'create_playlist':
      return await toolCreatePlaylist(context, action.payload);
    case 'list_creator_tracks':
      return await toolListCreatorTracks(context);
    case 'update_track_metadata':
      return await toolUpdateTrackMetadata(context, action.payload);
    case 'list_beta_applications':
      return await toolListBetaApplications(context);
    case 'list_content_flags':
      return await toolListContentFlags(context);
    default:
      return { reply: 'Esa acción no está disponible todavía.' };
  }
}

async function handleMessage(context: ToolContext, message: string, routeContext?: RouteContext) {
  const lower = message.toLowerCase();

  if ((/saldo|balance|wallet/.test(lower)) && isToolAllowed(context.role, 'get_wallet_balance')) {
    return await toolGetWalletBalance(context);
  }

  if ((/mi?s? tracks|mis canciones|mis tracks|list[a]? tracks/.test(lower)) && isToolAllowed(context.role, 'list_creator_tracks')) {
    return await toolListCreatorTracks(context);
  }

  if ((/beta application|beta applications|beta/.test(lower)) && isToolAllowed(context.role, 'list_beta_applications')) {
    return await toolListBetaApplications(context);
  }

  if ((/reportes|contenido reportado|flags/.test(lower)) && isToolAllowed(context.role, 'list_content_flags')) {
    return await toolListContentFlags(context);
  }

  if (/playlist/.test(lower) && isToolAllowed(context.role, 'create_playlist')) {
    const quoted = message.match(/["“”']([^"“”']{2,60})["“”']/);
    if (quoted && isExplicitActionRequest(message)) {
      return await toolCreatePlaylist(context, { title: quoted[1] });
    }
    return {
      reply: 'Puedo crear una playlist por ti. Dime el nombre exacto entre comillas.',
      actions: [
        {
          id: 'open-playlists-hub',
          label: 'Ir a mis playlists',
          clientAction: 'navigate',
          payload: { path: '/hub?tab=playlists' }
        }
      ]
    };
  }

  for (const intent of HELP_INTENTS) {
    if (intent.match.some((token) => lower.includes(token))) {
      const article = await fetchHelpBySlug(context.supabase, intent.slug);
      if (article) {
        return { reply: `${article.title}\n${article.body_md}` };
      }
    }
  }

  const results = await searchHelpArticles(context.supabase, message);
  if (results.length > 0) {
    const list = results
      .map((item) => `• ${item.title}`)
      .join('\n');
    return {
      reply: `Encontré estas guías internas:\n${list}\n¿Quieres que abra alguna?`
    };
  }

  const fallback = [
    'Eso aún no está disponible o no tengo evidencia interna para responder.',
    'Puedo ayudarte con CrossCoins, uploads, marketplace y soporte básico.',
    'Si necesitas acceso extra, puedo ayudarte a solicitarlo.'
  ].join(' ');

  return { reply: fallback, context: routeContext || {} };
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });

  const supabaseUrl = Deno.env.get('SB_PROJECT_URL') || Deno.env.get('SUPABASE_PROJECT_URL') || Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey =
    Deno.env.get('SB_ANON_KEY') || Deno.env.get('SUPABASE_PROJECT_ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    return json({ error: 'Missing SB_PROJECT_URL/SB_ANON_KEY' }, { status: 500 });
  }

  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body?.message && !body?.action) {
    return json({ error: 'Missing message or action' }, { status: 400 });
  }

  const token = getBearerToken(req);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {}
  });

  const { data: userData } = token ? await supabase.auth.getUser() : { data: { user: null } };
  const userId = userData?.user?.id || null;
  const profile = userId ? await fetchProfile(supabase, userId) : null;
  const role = resolveRole(userId, profile);

  const context: ToolContext = {
    supabase,
    userId,
    role,
    profile
  };

  const conversationId = await ensureConversation(
    supabase,
    userId,
    role,
    body.conversationId,
    body.routeContext
  );

  if (body.message) {
    await insertMessage(supabase, conversationId, 'user', body.message);
  }

  const result = body.action
    ? await handleToolAction(context, body.action)
    : await handleMessage(context, body.message || '', body.routeContext);

  if (result?.reply) {
    await insertMessage(
      supabase,
      conversationId,
      'assistant',
      result.reply,
      body.action?.type,
      body.action?.payload
    );
  }

  return json({
    conversationId,
    reply: result?.reply || 'Listo.',
    actions: result?.actions || []
  });
});
