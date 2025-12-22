import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, X, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { sendAssistantMessage, deleteAssistantConversation } from '@/lib/assistantClient';
import { useAssistantContext } from '@/contexts/AssistantContext';
import { toast } from '@/components/ui/use-toast';

const UI_STORAGE_PREFIX = 'crfm_assistant_ui_v1';
const SUGGESTION_RATE_LIMIT_MS = 1000 * 60 * 60 * 12;

const PROMPTS_BY_SECTION = {
  home: [
    'Explícame cómo funciona CRFM',
    '¿Qué son las CrossCoins?',
    '¿Cómo encuentro artistas cristianos?'
  ],
  wallet: [
    'Quiero comprar CrossCoins',
    'No veo mi saldo, ¿puedes ayudar?',
    'Explícame el pay-per-play'
  ],
  hub: [
    'Quiero subir un track nuevo',
    '¿Cómo edito metadata y portada?',
    '¿Cómo creo un producto digital?'
  ],
  upload: [
    'Guíame para subir .lrc',
    '¿Cómo funciona el video cover de 5–10s?',
    '¿Tienes tips para bulk upload?'
  ],
  admin: [
    'Muéstrame las beta applications pendientes',
    '¿Hay contenido reportado?',
    '¿Qué puedo moderar aquí?'
  ],
  detail: [
    '¿Cómo sincronizo letras .lrc?',
    '¿Cómo comparto este contenido?',
    '¿Qué opciones de monetización tengo?'
  ]
};

function getStorageKey(userId) {
  return `${UI_STORAGE_PREFIX}:${userId || 'guest'}`;
}

function loadStoredState(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveStoredState(key, state) {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // ignore storage failures
  }
}

function getSuggestionKey(section, role) {
  return `crfm_assistant_prompt_v1:${section}:${role}`;
}

function shouldShowSuggestions(section, role) {
  try {
    const key = getSuggestionKey(section, role);
    const lastShown = Number(localStorage.getItem(key) || 0);
    return Date.now() - lastShown > SUGGESTION_RATE_LIMIT_MS;
  } catch {
    return true;
  }
}

function markSuggestionsShown(section, role) {
  try {
    localStorage.setItem(getSuggestionKey(section, role), String(Date.now()));
  } catch {
    // ignore storage failures
  }
}

function getRoleBadge(role) {
  switch (role) {
    case 'admin':
      return { label: 'ADMIN', className: 'bg-red-500/20 text-red-200 border-red-500/40' };
    case 'creator':
      return { label: 'CREATOR', className: 'bg-purple-500/20 text-purple-200 border-purple-500/40' };
    case 'user':
      return { label: 'USER', className: 'bg-blue-500/20 text-blue-200 border-blue-500/40' };
    default:
      return { label: 'GUEST', className: 'bg-gray-500/20 text-gray-200 border-gray-500/40' };
  }
}

function formatMessageBody(body) {
  return body?.split('\n').map((line, index) => (
    <p key={`${line}-${index}`} className={index === 0 ? '' : 'mt-2'}>
      {line}
    </p>
  ));
}

export default function AssistantWidget() {
  const { user, role, routeContext } = useAssistantContext();
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollRef = useRef(null);
  const storageKey = useMemo(() => getStorageKey(user?.id), [user?.id]);

  const roleBadge = useMemo(() => getRoleBadge(role), [role]);
  const suggestions = useMemo(() => PROMPTS_BY_SECTION[routeContext.section] || PROMPTS_BY_SECTION.detail, [routeContext.section]);

  useEffect(() => {
    const stored = loadStoredState(storageKey);
    if (stored) {
      setIsOpen(Boolean(stored.isOpen));
      setConversationId(stored.conversationId || null);
    } else {
      setIsOpen(false);
      setConversationId(null);
    }
  }, [storageKey]);

  useEffect(() => {
    saveStoredState(storageKey, { isOpen, conversationId });
  }, [storageKey, isOpen, conversationId]);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const visibleSuggestions = useMemo(() => {
    if (messages.length > 0) return [];
    if (!shouldShowSuggestions(routeContext.section, role)) return [];
    return suggestions;
  }, [messages.length, role, routeContext.section, suggestions]);

  useEffect(() => {
    if (isOpen && visibleSuggestions.length > 0) {
      markSuggestionsShown(routeContext.section, role);
    }
  }, [isOpen, visibleSuggestions.length, routeContext.section, role]);

  const sendMessage = async (text, action) => {
    if (!text && !action) return;
    setIsSending(true);
    const trimmed = text?.trim() || '';
    if (trimmed || action) {
      setHasUserInteracted(true);
    }
    if (trimmed) {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), sender: 'user', text: trimmed }]);
    }

    try {
      const response = await sendAssistantMessage({
        message: trimmed || null,
        conversationId,
        routeContext,
        role,
        action
      });

      if (response?.conversationId) setConversationId(response.conversationId);
      if (response?.reply) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            sender: 'assistant',
            text: response.reply,
            actions: response.actions || []
          }
        ]);
        if (!isOpen && hasUserInteracted) {
          setUnreadCount((count) => count + 1);
        }
      }
    } catch (err) {
      const message = err?.message || 'No pude procesar tu solicitud.';
      toast({
        title: 'Assistant',
        description: message,
        variant: 'destructive'
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const value = inputValue.trim();
    if (!value || isSending) return;
    setInputValue('');
    await sendMessage(value);
  };

  const handleDeleteConversation = async () => {
    if (!conversationId || isSending) return;
    try {
      await deleteAssistantConversation(conversationId);
      setConversationId(null);
      setMessages([]);
      setHasUserInteracted(false);
      toast({
        title: 'Assistant',
        description: 'Conversación eliminada.'
      });
    } catch (err) {
      toast({
        title: 'Assistant',
        description: err?.message || 'No se pudo eliminar la conversación.',
        variant: 'destructive'
      });
    }
  };

  const handleActionClick = (action) => {
    if (action?.clientAction === 'navigate' && action?.payload?.path) {
      window.location.assign(action.payload.path);
      return;
    }
    sendMessage('', action);
  };

  const bottomOffset = 'calc(env(safe-area-inset-bottom) + 1rem + var(--crfm-player-offset, 0px))';

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
              <Badge className={cn('text-xs border', roleBadge.className)}>{roleBadge.label}</Badge>
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
                    onClick={() => sendMessage(suggestion)}
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
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
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
