import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Mic, BarChart2, Settings, Send, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../hooks/useChat';
import supabase, { signOut } from '../lib/supabase';
import MessageThread from '../components/Chat/MessageThread';

type Tab = 'chat' | 'habla' | 'progreso' | 'config';

export default function HomeScreen() {
  const { user } = useAuth();
  const { messages, isLoading, error, sendMessage, loadMessages } = useChat();
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [inputVal, setInputVal] = useState('');
  const [isSignoutLoading, setIsSignoutLoading] = useState(false);
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
    await sendMessage(msg);
    // Refocus input
    inputRef.current?.focus();
  };

  const handleSignOut = async () => {
    setIsSignoutLoading(true);
    try {
      await signOut();
    } catch (err) {
      console.error('Error signing out:', err);
    } finally {
      setIsSignoutLoading(false);
    }
  };

  return (
    <div className="flex justify-center w-full min-h-screen bg-[#FFF8F0]">
      {/* App frame (constrained for desktop viewing, full-width on mobile) */}
      <div className="flex flex-col w-full max-w-md bg-[#FFF8F0] shadow-2xl border-x border-[#F25C8A]/10 min-h-screen relative overflow-hidden">
        
        {/* Tab-specific Content */}
        {activeTab === 'chat' ? (
          <>
            {/* ZONE A: Avatar & Header */}
            <div className="flex flex-col items-center pt-8 pb-4 border-b border-[#F25C8A]/10 bg-gradient-to-b from-[#FAD4E0]/20 to-transparent">
              {/* Circular Avatar */}
              <div className="w-[100px] h-[100px] bg-[#FAD4E0] border-3 border-primary rounded-full flex items-center justify-center shadow-inner relative group transition-transform duration-300 hover:scale-105">
                <span className="font-serif-display text-4xl font-bold text-primary select-none">
                  E
                </span>
                {/* Micro animation pulse rings */}
                <div className="absolute inset-0 rounded-full border border-primary/40 animate-ping opacity-25 pointer-events-none"></div>
              </div>
              <h2 className="font-serif-display text-2xl font-bold text-primary mt-3">
                Escobar
              </h2>
              <span className="font-nunito text-[12px] font-semibold text-muted tracking-wider uppercase mt-0.5">
                Tu Hondureña
              </span>
            </div>

            {/* ZONE B: Message Thread */}
            <div className="flex-1 flex flex-col min-h-0 bg-[#FFF8F0]">
              {error && (
                <div className="mx-4 my-2 text-center text-secondary font-nunito text-xs font-semibold bg-surface/20 py-1.5 px-3 rounded-lg border border-primary/20">
                  {error}
                </div>
              )}
              <MessageThread messages={messages} isLoading={isLoading} />
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
          </>
        ) : (
          // PLACEHOLDER SCREENS FOR INACTIVE TABS
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#FFF8F0]">
            {activeTab === 'config' ? (
              <div className="flex flex-col items-center space-y-6 w-full max-w-xs">
                <Settings className="w-16 h-16 text-primary animate-spin" style={{ animationDuration: '6s' }} />
                <h3 className="font-serif-display text-2xl font-bold text-primary">Configuración</h3>
                
                {/* Sign Out functionality embedded inside Config */}
                <div className="w-full bg-white border border-[#F25C8A]/20 rounded-2xl p-4 shadow-sm space-y-4">
                  <p className="font-nunito text-xs text-muted">
                    Sesión iniciada como <span className="font-semibold text-text">{user?.email}</span>
                  </p>
                  <button
                    onClick={handleSignOut}
                    disabled={isSignoutLoading}
                    className="flex w-full items-center justify-center gap-2 bg-[#FF8C69] text-white font-nunito font-bold text-sm h-10 rounded-[50px] hover:bg-[#FF8C69]/90 active:scale-98 transition-all disabled:opacity-50"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{isSignoutLoading ? 'Saliendo...' : 'Cerrar sesión'}</span>
                  </button>
                </div>

                <p className="font-nunito italic text-sm text-[#6B4C43] pt-4 border-t border-[#F25C8A]/10 w-full">
                  Próximamente, maje 😏
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeTab === 'habla' ? (
                  <Mic className="w-16 h-16 text-primary mx-auto animate-pulse" />
                ) : (
                  <BarChart2 className="w-16 h-16 text-primary mx-auto" />
                )}
                <h3 className="font-serif-display text-2xl font-bold text-primary capitalize">
                  {activeTab === 'habla' ? 'Modo Voz' : 'Progreso'}
                </h3>
                <p className="font-nunito italic text-sm text-[#6B4C43]">
                  Próximamente, maje 😏
                </p>
              </div>
            )}
          </div>
        )}

        {/* ZONE D: Bottom Navigation Bar (72px) */}
        <div className="h-[72px] bg-white border-t border-[#F25C8A]/10 flex items-center justify-around px-4 select-none z-10">
          
          {/* Chat Tab */}
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex flex-col items-center justify-center w-16 h-12 rounded-xl transition-all ${
              activeTab === 'chat'
                ? 'bg-[#FBEAF0] text-primary font-bold'
                : 'text-[#6B4C43] hover:bg-[#FFF8F0]/50'
            }`}
          >
            <MessageCircle className="w-5 h-5" />
            <span className="font-nunito text-[10px] mt-0.5">Chat</span>
          </button>

          {/* Habla Tab */}
          <button
            onClick={() => setActiveTab('habla')}
            className={`flex flex-col items-center justify-center w-16 h-12 rounded-xl transition-all ${
              activeTab === 'habla'
                ? 'bg-[#FBEAF0] text-primary font-bold'
                : 'text-[#6B4C43] hover:bg-[#FFF8F0]/50'
            }`}
          >
            <Mic className="w-5 h-5" />
            <span className="font-nunito text-[10px] mt-0.5">Habla</span>
          </button>

          {/* Progreso Tab */}
          <button
            onClick={() => setActiveTab('progreso')}
            className={`flex flex-col items-center justify-center w-16 h-12 rounded-xl transition-all ${
              activeTab === 'progreso'
                ? 'bg-[#FBEAF0] text-primary font-bold'
                : 'text-[#6B4C43] hover:bg-[#FFF8F0]/50'
            }`}
          >
            <BarChart2 className="w-5 h-5" />
            <span className="font-nunito text-[10px] mt-0.5">Progreso</span>
          </button>

          {/* Config Tab */}
          <button
            onClick={() => setActiveTab('config')}
            className={`flex flex-col items-center justify-center w-16 h-12 rounded-xl transition-all ${
              activeTab === 'config'
                ? 'bg-[#FBEAF0] text-primary font-bold'
                : 'text-[#6B4C43] hover:bg-[#FFF8F0]/50'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="font-nunito text-[10px] mt-0.5">Config</span>
          </button>

        </div>
      </div>
    </div>
  );
}
