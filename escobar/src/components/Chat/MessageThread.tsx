import React, { useEffect, useRef } from 'react';
import MessageBubble, { type Correction } from './MessageBubble';
import TypingIndicator from './TypingIndicator';

export interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  mood_state?: string;
  corrections?: Correction[];
  created_at?: string;
}

interface MessageThreadProps {
  messages: Message[];
  isLoading: boolean;
}

export const MessageThread: React.FC<MessageThreadProps> = ({ messages, isLoading }) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 flex flex-col">
      {messages.length === 0 ? (
        <div className="flex flex-grow flex-col items-center justify-center text-center py-16">
          <p className="font-nunito italic text-sm text-muted">
            ¡Hola maje! Empieza a hablar conmigo.
          </p>
        </div>
      ) : (
        messages.map((msg, index) => (
          <MessageBubble
            key={msg.id || index}
            role={msg.role}
            content={msg.content}
            corrections={msg.corrections}
            mood={msg.mood_state}
          />
        ))
      )}

      {isLoading && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
};

export default MessageThread;
