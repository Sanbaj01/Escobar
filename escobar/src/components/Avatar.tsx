import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import supabase from '../lib/supabase';

interface AvatarProps {
  mood?: 'playful' | 'affectionate' | 'excited' | 'annoyed';
  isSpeaking?: boolean;
  isListening?: boolean;
  rmsVolume?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function Avatar({
  mood = 'playful',
  isSpeaking = false,
  isListening = false,
  rmsVolume = 0,
  size = 'md'
}: AvatarProps) {
  const { user, profile } = useAuth();
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActiveAvatars = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('avatar_assets')
          .select('mood_state, storage_url')
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (error) throw error;

        if (data && data.length > 0) {
          const mapping: Record<string, string> = {};
          data.forEach((asset) => {
            mapping[asset.mood_state] = asset.storage_url;
          });
          setAvatarUrls(mapping);
        }
      } catch (err) {
        console.error('Error loading active avatar assets:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveAvatars();
  }, [user, profile?.avatar_ready]);

  // Determine size classes
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return { container: 'w-[48px] h-[48px]', text: 'text-xl', border: 'border-2' };
      case 'md':
        return { container: 'w-[100px] h-[100px]', text: 'text-4xl', border: 'border-3' };
      case 'lg':
        return { container: 'w-[140px] h-[140px]', text: 'text-5xl', border: 'border-4' };
    }
  };

  const dim = getSizeClasses();
  const activeUrl = avatarUrls[mood];

  return (
    <div className="relative flex items-center justify-center">
      {/* Dynamic VAD Waveform Rings (only visible when active) */}
      {isListening && (
        <div 
          className="absolute rounded-full border border-secondary/35 animate-pulse opacity-45 pointer-events-none"
          style={{
            width: size === 'lg' ? '220px' : size === 'md' ? '160px' : '80px',
            height: size === 'lg' ? '220px' : size === 'md' ? '160px' : '80px',
            transform: `scale(${1 + rmsVolume * 0.4})`,
            transition: 'transform 100ms ease-out'
          }}
        ></div>
      )}

      {isSpeaking && (
        <div 
          className="absolute rounded-full border-2 border-primary/25 pointer-events-none animate-pulse"
          style={{
            width: size === 'lg' ? '180px' : size === 'md' ? '130px' : '65px',
            height: size === 'lg' ? '180px' : size === 'md' ? '130px' : '65px',
            transform: `scale(${1 + rmsVolume * 0.3})`,
            transition: 'transform 80ms ease-out'
          }}
        ></div>
      )}

      {/* Main Avatar Container */}
      <div 
        className={`${dim.container} rounded-full bg-surface ${dim.border} flex items-center justify-center shadow-lg overflow-hidden transition-all duration-500 relative z-10 ${
          isListening ? 'border-secondary scale-105' : 'border-primary'
        } ${isSpeaking ? 'scale-105 border-primary' : ''}`}
      >
        {activeUrl && activeUrl !== 'pending' ? (
          /* Custom AI Generated Face with smooth crossfade */
          <img
            src={activeUrl}
            alt={`Escobar ${mood}`}
            className="w-full h-full object-cover animate-fadeIn"
            key={activeUrl} // forces key re-evaluation for clean crossfade transitions
          />
        ) : (
          /* Default Illustrated Circle Initials */
          <span className={`font-serif-display font-bold text-primary select-none ${dim.text}`}>
            E
          </span>
        )}

        {/* Subtle breathing keyframe pulse (slow transform loop) */}
        {!isSpeaking && !isListening && (
          <div className="absolute inset-0 rounded-full border border-primary/10 animate-ping opacity-15 pointer-events-none"></div>
        )}
      </div>
    </div>
  );
}

export default Avatar;
