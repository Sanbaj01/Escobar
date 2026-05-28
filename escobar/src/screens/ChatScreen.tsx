import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../hooks/useChat';
import supabase from '../lib/supabase';
import MessageThread from '../components/Chat/MessageThread';
import Avatar from '../components/Avatar';
import ScenarioMode, { type Scenario } from './ScenarioMode';

export default function ChatScreen() {
  const { user } = useAuth();
  const { messages, isLoading, error, sendMessage, loadMessages, startNewConversation } = useChat();
  const [inputVal, setInputVal] = useState('');
  const [chatView, setChatView] = useState<'chat' | 'scenarios'>('chat');
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Load user's latest conversation on mount if it exists
  useEffect(() => {
    const initChat = async () => {
      if (!user) return;
      try {
        const { data, error: fetchError } = await supabase
          .from('conversations')
          .select('id')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (fetchError) throw fetchError;

        if (data && data.length > 0) {
          await loadMessages(data[0].id);
        }
      } catch (err) {
        console.error('Error fetching conversation on mount:', err);
      }
    };

    initChat();
  }, [user, loadMessages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || isLoading) return;
    const msg = inputVal;
    setInputVal('');

    if (activeScenario) {
      await sendMessage(msg, {
        id: activeScenario.id,
        name: activeScenario.name,
        prompt: activeScenario.prompt
      });
    } else {
      await sendMessage(msg);
    }
    // Refocus input
    inputRef.current?.focus();
  };

  const handleStartScenario = async (scenario: Scenario) => {
    setActiveScenario(scenario);
    setChatView('chat');
    // Start a new conversation so the scenario is clean
    startNewConversation();

    // Trigger the initial scenario introduction
    await sendMessage(`[SYSTEM_TRIGGER: Iniciemos el reto de conversación "${scenario.name}". Háblame en tu papel de: ${scenario.prompt}]`, {
      id: scenario.id,
      name: scenario.name,
      prompt: scenario.prompt
    });
  };

  const handleExitScenario = async () => {
    setActiveScenario(null);
    // Reload their normal conversation history
    if (user) {
      try {
        const { data, error: fetchError } = await supabase
          .from('conversations')
          .select('id')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (!fetchError && data && data.length > 0) {
          await loadMessages(data[0].id);
        } else {
          startNewConversation();
        }
      } catch (err) {
        console.error('Error reloading conversation on exit scenario:', err);
      }
    }
  };

  // Find the last assistant message to determine current avatar mood
  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
  const activeMood = activeScenario 
    ? 'excited' 
    : ((lastAssistantMsg?.mood_state || 'playful') as 'playful' | 'affectionate' | 'excited' | 'annoyed');

  // Filter out system trigger messages from UI display
  const visibleMessages = messages.filter(m => !m.content.startsWith('[SYSTEM_TRIGGER:'));

  if (chatView === 'scenarios') {
    return <ScenarioMode onSelectScenario={handleStartScenario} onBack={() => setChatView('chat')} />;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#FFF8F0]">
      {/* ZONE A: Avatar & Header */}
      <div className="flex flex-col items-center pt-8 pb-4 border-b border-[#F25C8A]/10 bg-gradient-to-b from-[#FAD4E0]/20 to-transparent relative">
        {/* Scenarios Retos Trigger Button */}
        <button
          onClick={() => setChatView('scenarios')}
          className="absolute top-6 right-4 flex items-center gap-1 bg-[#FBEAF0] text-primary font-nunito font-bold text-xs px-3 py-1.5 rounded-full hover:bg-[#FBEAF0]/80 active:scale-95 transition-all shadow-sm border border-primary/10"
        >
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          <span>Retos</span>
        </button>

        {/* Dynamic Avatar Component */}
        <Avatar 
          mood={activeMood} 
          isSpeaking={isLoading} 
          size="md" 
        />
        
        <h2 className="font-serif-display text-2xl font-bold text-primary mt-3">
          {activeScenario ? activeScenario.name : 'Escobar'}
        </h2>
        <span className="font-nunito text-[12px] font-semibold text-muted tracking-wider uppercase mt-0.5">
          {activeScenario ? 'Reto de Conversación' : 'Tu Hondureña'}
        </span>
      </div>

      {/* Active Scenario Banner */}
      {activeScenario && (
        <div className="bg-[#FF8C69]/10 border-b border-[#FF8C69]/20 px-4 py-2 flex items-center justify-between text-[#FF8C69] animate-fadeIn select-none z-10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-[#FF8C69]" />
            <div className="flex flex-col">
              <span className="font-nunito font-bold text-[11px] text-text">Reto: {activeScenario.name}</span>
              <span className="font-nunito text-[9px] text-muted leading-tight">Escobar está actuando en este papel.</span>
            </div>
          </div>
          <button
            onClick={handleExitScenario}
            className="text-[10px] font-nunito font-bold bg-[#FF8C69]/20 hover:bg-[#FF8C69]/30 text-text px-2.5 py-1 rounded-[50px] active:scale-95 transition-all border border-secondary/15"
          >
            Finalizar Reto
          </button>
        </div>
      )}

      {/* ZONE B: Message Thread */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#FFF8F0]">
        {error && (
          <div className="mx-4 my-2 text-center text-secondary font-nunito text-xs font-semibold bg-surface/20 py-1.5 px-3 rounded-lg border border-primary/20">
            {error}
          </div>
        )}
        <MessageThread messages={visibleMessages} isLoading={isLoading} />
      </div>

      {/* ZONE C: Input Bar */}
      <div className="px-4 py-3 bg-[#FFF8F0] border-t border-[#F25C8A]/10">
        <form onSubmit={handleSend} className="flex items-center bg-white border-[1.5px] border-primary rounded-[50px] p-1.5 pl-5 w-full shadow-sm focus-within:ring-2 focus-within:ring-primary/45 transition-all">
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Escríbeme algo..."
            disabled={isLoading}
            className="flex-1 bg-transparent border-0 outline-none text-text placeholder-muted/50 font-nunito text-sm disabled:opacity-70"
          />
          <button
            type="submit"
            disabled={!inputVal.trim() || isLoading}
            className="w-9 h-9 bg-primary text-white rounded-full flex items-center justify-center transition-all hover:bg-primary/95 active:scale-95 disabled:opacity-50"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
