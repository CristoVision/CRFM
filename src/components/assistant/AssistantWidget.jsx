import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, X, MessageSquare, Loader2 } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabaseClient';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';

import { cn } from '@/lib/utils';

/**
 * CRFM Assistant Widget
 * - Widget flotante que no invade; aparece como burbuja
 * - Respeta RLS: solo muestra/actúa según permisos de usuario en Supabase
 * - Evita solaparse con el music player usando CSS var: --crfm-player-offset
 *
 * NOTA: Este widget asume que existen:
 * - useAuth() => { user, profile }
 * - useLanguage() => { t, language }
 * - cn() utility
 * - UI components: Button, Input, Badge
 */

const DEFAULT_SUGGESTIONS = {
  guest: [
    '¿Cómo creo una cuenta?',
    '¿Cómo subo música?',
    '¿Qué es CRFM?',
  ],
  user: [
    'Muéstrame mis playlists',
    '¿Cómo actualizo mi perfil?',
    '¿Dónde veo mi wallet?',
  ],
  creator: [
    '¿Cómo subo un track?',
    '¿Cómo creo un álbum?',
    '¿Cómo funciona la monetización?',
  ],
  admin: [
    '¿Cómo reviso reportes?',
    'Llévame al Admin',
    '¿Qué puedo moderar hoy?',
  ],
};

function safeId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function formatMessageBody(text) {
  if (!text) return null;

  // Render muy simple: respetar saltos de línea
  const parts = String(text).split('\n');
  return (
    <div className="space-y-2">
      {parts.map((p, idx) => (
        <p key={idx} className="whitespace-pre-wrap break-words">
          {p}
        </p>
      ))}
    </div>
  );
}

/**
 * Normaliza “rol” de acuerdo a tu profile.
 * Ajusta aquí si tu schema usa otro campo.
 */
function deriveRole(profile) {
  // Preferencias comunes:
  // - profile.role: 'admin' | 'creator' | 'user'
  // - profile.is_admin boolean
  // - profile.account_type
  if (!profile) return 'guest';

  if (profile.is_admin) return 'admin';
  if (profile.role) return profile.role; // si ya viene 'admin'/'creator'/'user'
  if (profile.account_type) return profile.account_type;

  return 'user';
}

function roleBadgeMeta(role, t) {
  const fallback = {
    label: role,
    className: 'border-white/20 text-white/80',
  };

  if (role === 'admin') {
    return {
      label: t?.('services.admin.tabLabel') ? t('services.admin.tabLabel') : 'Admin',
      className: 'border-yellow-500/40 text-yellow-200 bg-yellow-500/10',
    };
  }
  if (role === 'creator') {
    return {
      label: 'Creator',
      className: 'border-emerald-500/40 text-emerald-200 bg-emerald-500/10',
    };
  }
  if (role === 'user') {
    return {
      label: 'User',
      className: 'border-blue-500/40 text-blue-200 bg-blue-500/10',
    };
  }
  if (role === 'guest') {
    return {
      label: 'Guest',
      className: 'border-white/20 text-white/70 bg-white/5',
    };
  }

  return fallback;
}

/**
 * Intenta llamar un RPC si existe.
 * Si no existe, cae a un mensaje “mock” para no romper el build.
 */
async function tryAssistantRpc({ message, role, user_id }) {
  // Puedes reemplazar este RPC por el tuyo real si existe, ejemplo:
  // supabase.rpc('crfm_assistant', { message, role })
  // Aquí hacemos “best effort”.
  try {
    const { data, error } = await supabase.rpc('crfm_assistant', {
      message,
      role,
      user_id,
    });
    if (error) throw error;
    return data;
  } catch (_e) {
    return null;
  }
}

export default function AssistantWidget() {
  const { user, profile } = useAuth();
  const { t } = useLanguage();

  const role = useMemo(() => deriveRole(profile), [profile]);
  const roleBadge = useMemo(() => roleBadgeMeta(role, t), [role, t]);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const scrollRef = useRef(null);

  const visibleSuggestions = useMemo(() => {
    if (isOpen) return [];
    return (DEFAULT_SUGGESTIONS[role] || DEFAULT_SUGGESTIONS.guest).slice(0, 3);
  }, [role, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    // Reset contador al abrir
    setUnreadCount(0);
  }, [isOpen]);

  useEffect(() => {
    // Scroll al final cuando llegan mensajes
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isOpen]);

  const handleDeleteConversation = () => {
    setMessages([]);
    setInputValue('');
    setUnreadCount(0);
    toast?.({
      title: 'Conversación eliminada',
      description: 'La conversación del asistente fue reiniciada.',
    });
  };

  const pushAssistantMessage = (text, actions = []) => {
    setMessages((prev) => [
      ...prev,
      {
        id: safeId(),
        sender: 'assistant',
        text,
        actions: actions?.map((a) => ({
          id: a.id || safeId(),
          label: a.label || 'Acción',
          clientAction: a.clientAction,
          payload: a.payload,
        })),
      },
    ]);
    if (!isOpen) setUnreadCount((n) => n + 1);
  };

  const pushUserMessage = (text) => {
    setMessages((prev) => [
      ...prev,
      { id: safeId(), sender: 'user', text: String(text || '') },
    ]);
  };

  const sendMessage = async (text, action = null) => {
    const trimmed = String(text || '').trim();
    if (!trimmed && !action) return;

    if (trimmed) pushUserMessage(trimmed);

    setIsSending(true);
    try {
      // 1) Si hay acción “local” (clientAction)
      if (action?.clientAction) {
        // Handlers locales: navegar, etc.
        if (action.clientAction === 'navigate' && action?.payload?.path) {
          window.location.assign(action.payload.path);
          return;
        }
      }

      // 2) Intentar RPC real si existe
      const rpcData = await tryAssistantRpc({
        message: trimmed || '',
        role,
        user_id: user?.id || null,
      });

      // Si tu RPC devuelve { reply, actions }
      if (rpcData && typeof rpcData === 'object') {
        const reply =
          rpcData.reply ||
          rpcData.message ||
          'Listo. ¿Qué más necesitas?';

        const actions = Array.isArray(rpcData.actions) ? rpcData.actions : [];
        pushAssistantMessage(reply, actions);
        return;
      }

      // 3) Fallback: respuestas básicas para no romper experiencia
      if (!user) {
        pushAssistantMessage(
          'Para ayudarte con tu cuenta y datos (protegidos por RLS), primero inicia sesión.'
        );
        return;
      }

      // Respuestas rápidas por palabras clave
      const lower = (trimmed || '').toLowerCase();

      if (lower.includes('admin')) {
        pushAssistantMessage('Te llevo al panel de Admin.', [
          { label: 'Abrir Admin', clientAction: 'navigate', payload: { path: '/admin' } },
        ]);
        return;
      }

      if (lower.includes('servicio') || lower.includes('services') || lower.includes('proyecto')) {
        pushAssistantMessage('Aquí tienes tu portal de servicios.', [
          { label: 'Abrir Services', clientAction: 'navigate', payload: { path: '/services' } },
        ]);
        return;
      }

      if (lower.includes('perfil') || lower.includes('profile')) {
        pushAssistantMessage('Te llevo a tu perfil.', [
          { label: 'Abrir Perfil', clientAction: 'navigate', payload: { path: '/profile' } },
        ]);
        return;
      }

      if (lower.includes('wallet') || lower.includes('billetera')) {
        pushAssistantMessage('Te llevo a tu wallet.', [
          { label: 'Abrir Wallet', clientAction: 'navigate', payload: { path: '/wallet' } },
        ]);
        return;
      }

      pushAssistantMessage(
        'Estoy aquí para ayudarte con tareas y preguntas de CRFM. Tu acceso está protegido por RLS. Dime qué quieres hacer (por ejemplo: “abrir services”, “ir a perfil”, “abrir admin”).'
      );
    } catch (error) {
      console.error('AssistantWidget sendMessage error:', error);
      pushAssistantMessage('Ocurrió un error procesando tu solicitud. Intenta de nuevo.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const msg = inputValue;
    setInputValue('');
    await sendMessage(msg);
  };

  const handleActionClick = (action) => {
    if (action?.clientAction === 'navigate' && action?.payload?.path) {
      window.location.assign(action.payload.path);
      return;
    }
    // si en el futuro agregas acciones remotas
    sendMessage('', action);
  };

  // IMPORTANTE: offset para no chocar con el music player
  // Si tu player define la altura, setea en CSS (o en el componente player):
  // document.documentElement.style.setProperty('--crfm-player-offset', '88px');
  const bottomOffset =
    'calc(env(safe-area-inset-bottom) + 1rem + var(--crfm-player-offset, 0px))';

  return (
    <div className="fixed right-4 z-50" style={{ bottom: bottomOffset }}>
      {isOpen && (
        <div
          className="w-[min(360px,calc(100vw-2rem))] h-[min(520px,calc(100vh-8rem))] bg-black/80 border border-white/10 rounded-2xl shadow-xl backdrop-blur-xl flex flex-col overflow-hidden"
          role="dialog"
          aria-label="CRFM Assistant"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">CRFM Assistant</span>
              <Badge className={cn('text-xs border', roleBadge.className)}>
                {roleBadge.label}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-white/70 hover:text-white"
                onClick={handleDeleteConversation}
                aria-label="Eliminar conversación"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-white/70 hover:text-white"
                onClick={() => setIsOpen(false)}
                aria-label="Minimizar asistente"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 px-4 py-3 overflow-y-auto">
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-sm text-gray-300">
                  Estoy aquí para ayudarte con tareas y preguntas de CRFM. Tu acceso está protegido por RLS.
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'rounded-xl px-3 py-2 text-sm leading-relaxed',
                    msg.sender === 'user'
                      ? 'bg-yellow-500/20 text-yellow-100 self-end'
                      : 'bg-white/10 text-white'
                  )}
                >
                  {formatMessageBody(msg.text)}

                  {msg.sender === 'assistant' && msg.actions?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {msg.actions.map((action) => (
                        <Button
                          key={action.id}
                          type="button"
                          size="sm"
                          className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-100"
                          onClick={() => handleActionClick(action)}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {visibleSuggestions.length > 0 && (
            <div className="px-4 pb-2">
              <div className="flex flex-wrap gap-2">
                {visibleSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="text-xs px-2 py-1 rounded-full border border-white/10 text-white/80 hover:text-white hover:border-white/30"
                    onClick={() => {
                      setIsOpen(true);
                      // dispara el mensaje luego de abrir
                      setTimeout(() => sendMessage(suggestion), 0);
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="border-t border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <Input
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="Escribe tu pregunta o tarea..."
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                aria-label="Mensaje para el asistente"
              />
              <Button type="submit" size="icon" disabled={isSending}>
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MessageSquare className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {!isOpen && (
        <button
          type="button"
          className="relative h-12 w-12 rounded-full bg-yellow-500 text-black shadow-lg hover:shadow-xl flex items-center justify-center"
          onClick={() => setIsOpen(true)}
          aria-label="Abrir asistente"
        >
          <MessageSquare className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
              {Math.min(unreadCount, 9)}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
