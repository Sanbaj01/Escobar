import React, { useState } from 'react';
import { MessageCircle, Mic, BarChart2, Settings } from 'lucide-react';
import ChatScreen from './ChatScreen';
import VoiceScreen from './VoiceScreen';
import ProgresoScreen from './ProgresoScreen';
import SettingsScreen from './SettingsScreen';

type Tab = 'chat' | 'habla' | 'progreso' | 'config';

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');

  // Render content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'chat':
        return <ChatScreen />;
      case 'habla':
        return <VoiceScreen onClose={() => setActiveTab('chat')} />;
      case 'progreso':
        return <ProgresoScreen />;
      case 'config':
        return <SettingsScreen />;
      default:
        return <ChatScreen />;
    }
  };

  return (
    <div className="flex justify-center w-full min-h-screen bg-[#FFF8F0]">
      {/* App frame (constrained for desktop viewing, full-width on mobile) */}
      <div className="flex flex-col w-full max-w-md bg-[#FFF8F0] shadow-2xl border-x border-[#F25C8A]/10 min-h-screen relative overflow-hidden">
        
        {/* Main View Area */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#FFF8F0]">
          {renderTabContent()}
        </div>

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
