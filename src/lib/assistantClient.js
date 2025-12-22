import { supabase } from '@/lib/supabaseClient';

export async function sendAssistantMessage({
  message,
  conversationId,
  routeContext,
  role,
  action
}) {
  const { data, error } = await supabase.functions.invoke('assistant-chat', {
    body: {
      message,
      conversationId,
      routeContext,
      role,
      action
    }
  });

  if (error) throw error;
  return data;
}

export async function deleteAssistantConversation(conversationId) {
  if (!conversationId) return { ok: true };
  const { error } = await supabase.from('assistant_conversations').delete().eq('id', conversationId);
  if (error) throw error;
  return { ok: true };
}
