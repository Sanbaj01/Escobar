import { useState, useCallback } from 'react';
import supabase from '../lib/supabase';
import { type Message } from '../components/Chat/MessageThread';

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load chat history from Supabase
  const loadMessages = useCallback(async (convId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('messages')
        .select('id, role, content, mood_state, corrections, created_at')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;
      
      // Map database columns to Message interface
      const mapped: Message[] = (data || []).map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        mood_state: m.mood_state,
        corrections: m.corrections,
        created_at: m.created_at,
      }));

      setMessages(mapped);
      setConversationId(convId);
    } catch (err: any) {
      console.error('Error loading messages:', err);
      setError(err.message || 'Error al cargar el historial.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    setError(null);
    const userMsg: Message = { role: 'user', content };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // 1. Retrieve session token
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;
      if (!token) {
        throw new Error('No se encontró una sesión activa.');
      }

      // 2. Call serverless API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          message: content,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Error al enviar el mensaje.');
      }

      if (!response.body) {
        throw new Error('El canal de respuesta está vacío.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentAssistantMsgContent = '';
      let hasAddedAssistantMsg = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.substring(6));

              if (data.type === 'meta') {
                if (data.conversation_id && data.conversation_id !== conversationId) {
                  setConversationId(data.conversation_id);
                }
              } else if (data.type === 'text_delta') {
                currentAssistantMsgContent += data.content;

                if (!hasAddedAssistantMsg) {
                  hasAddedAssistantMsg = true;
                  setMessages((prev) => [
                    ...prev,
                    { role: 'assistant', content: currentAssistantMsgContent },
                  ]);
                } else {
                  setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last && last.role === 'assistant') {
                      last.content = currentAssistantMsgContent;
                    }
                    return updated;
                  });
                }
              } else if (data.type === 'done') {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'assistant') {
                    last.id = data.message_id;
                    last.mood_state = data.mood;
                    last.corrections = data.corrections;
                  }
                  return updated;
                });
                setIsLoading(false);
              } else if (data.type === 'error') {
                setError(data.error);
                setIsLoading(false);
              }
            } catch (err) {
              console.error('Error parsing SSE event chunk:', err);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(err.message || 'Error al comunicarse con Escobar.');
      setIsLoading(false);
    }
  }, [conversationId]);

  return {
    messages,
    isLoading,
    conversationId,
    error,
    sendMessage,
    loadMessages,
    setMessages,
  };
}
export default useChat;
