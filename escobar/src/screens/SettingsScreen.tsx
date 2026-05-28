import React, { useState, useEffect } from 'react';
import { LogOut, ChevronRight, Camera, Brain, Volume2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import supabase, { signOut } from '../lib/supabase';
import AvatarStudio from './AvatarStudio';
import MemoryVault from './MemoryVault';

type SubView = 'settings' | 'avatar-studio' | 'memory-vault';

const getLevelLabel = (level: number): string => {
  if (level <= 2) return 'Principiante';
  if (level <= 4) return 'Básico';
  if (level <= 6) return 'Intermedio';
  if (level <= 8) return 'Avanzado';
  return 'Hondureña Fluida';
};

export default function SettingsScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [view, setView] = useState<SubView>('settings');
  const [isSignoutLoading, setIsSignoutLoading] = useState(false);

  const [localVolume, setLocalVolume] = useState(100);
  const [localSpeed, setLocalSpeed] = useState(1.0);
  const [localWakeWord, setLocalWakeWord] = useState(true);

  useEffect(() => {
    if (profile) {
      setLocalVolume(profile.preferences?.volume ?? 100);
      setLocalSpeed(profile.preferences?.speed ?? 1.0);
      setLocalWakeWord(profile.preferences?.wakeWordEnabled ?? true);
    }
  }, [profile]);

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

  const updateProfileSetting = async (updates: { spanish_level?: number; preferences?: Record<string, any> }) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
    } catch (err) {
      console.error('Error updating profile:', err);
    }
  };

  const updatePreference = async (key: string, value: any) => {
    if (!user || !profile) return;
    const updatedPreferences = {
      ...(profile.preferences || {}),
      [key]: value
    };
    await updateProfileSetting({ preferences: updatedPreferences });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalVolume(Number(e.target.value));
  };
  const handleVolumeRelease = () => {
    updatePreference('volume', localVolume);
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSpeed(Number(e.target.value));
  };
  const handleSpeedRelease = () => {
    updatePreference('speed', localSpeed);
  };

  const handleWakeWordToggle = () => {
    const nextVal = !localWakeWord;
    setLocalWakeWord(nextVal);
    updatePreference('wakeWordEnabled', nextVal);
  };

  // Render Subviews (Push stack)
  if (view === 'avatar-studio') {
    return <AvatarStudio onBack={() => setView('settings')} />;
  }

  if (view === 'memory-vault') {
    return <MemoryVault onBack={() => setView('settings')} />;
  }

  return (
    <div className="flex-grow flex flex-col bg-bg h-full justify-between select-none">
      
      {/* Settings Panel Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Header Title */}
        <div className="flex items-center justify-center px-4 py-4 border-b border-primary/10 bg-white">
          <h2 className="font-serif-display text-xl font-bold text-text">
            Configuración
          </h2>
        </div>

        {/* List of Settings Options */}
        <div className="p-4 space-y-6">
          
          {/* Section: Perfil */}
          <div className="space-y-2">
            <span className="font-nunito text-[10px] font-bold text-muted uppercase tracking-wider pl-1">
              Perfil
            </span>
            <div className="bg-white border border-primary/10 rounded-2xl p-4 shadow-sm flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-surface border border-primary flex items-center justify-center text-primary font-bold text-lg">
                {profile?.display_name ? profile.display_name.charAt(0).toUpperCase() : 'M'}
              </div>
              <div className="flex-grow">
                <h4 className="font-nunito font-bold text-sm text-text leading-snug">
                  {profile?.display_name || 'Maje'}
                </h4>
                <p className="font-nunito text-xs text-muted">
                  Nivel de Español: {profile?.spanish_level || 1} ({getLevelLabel(profile?.spanish_level || 1)})
                </p>
              </div>
            </div>
          </div>

          {/* Section: Idioma y Nivel */}
          <div className="space-y-2">
            <span className="font-nunito text-[10px] font-bold text-muted uppercase tracking-wider pl-1">
              Idioma y Nivel
            </span>
            <div className="bg-white border border-primary/10 rounded-2xl p-4 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-nunito font-semibold text-sm text-text">Nivel de Español</span>
                  <span className="font-nunito text-[10px] text-muted">Nivel actual evaluado u override</span>
                </div>
                <select
                  value={profile?.spanish_level || 1}
                  onChange={(e) => updateProfileSetting({ spanish_level: parseInt(e.target.value, 10) })}
                  className="bg-bg border border-primary/20 rounded-xl px-3 py-1.5 font-nunito font-bold text-xs text-text focus:outline-none focus:border-primary cursor-pointer"
                >
                  {[...Array(10)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Nivel {i + 1} ({getLevelLabel(i + 1)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section: Escobar Avatar */}
          <div className="space-y-2">
            <span className="font-nunito text-[10px] font-bold text-muted uppercase tracking-wider pl-1">
              Personalización de Escobar
            </span>
            <div className="bg-white border border-primary/10 rounded-2xl overflow-hidden shadow-sm divide-y divide-primary/5">
              {/* Avatar Studio Link */}
              <button
                onClick={() => setView('avatar-studio')}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-surface/10 transition-colors"
              >
                <div className="flex items-center gap-3 text-text">
                  <Camera className="w-4 h-4 text-primary" />
                  <span className="font-nunito font-semibold text-sm">Estudio de Avatar (Fotos)</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted" />
              </button>
            </div>
          </div>

          {/* Section: Memoria */}
          <div className="space-y-2">
            <span className="font-nunito text-[10px] font-bold text-muted uppercase tracking-wider pl-1">
              Cognición
            </span>
            <div className="bg-white border border-primary/10 rounded-2xl overflow-hidden shadow-sm">
              {/* Memory Link */}
              <button
                onClick={() => setView('memory-vault')}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-surface/10 transition-colors"
              >
                <div className="flex items-center gap-3 text-text">
                  <Brain className="w-4 h-4 text-primary" />
                  <span className="font-nunito font-semibold text-sm">Bóveda de Memoria</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted" />
              </button>
            </div>
          </div>

          {/* Section: Configuración de Voz */}
          <div className="space-y-2">
            <span className="font-nunito text-[10px] font-bold text-muted uppercase tracking-wider pl-1">
              Ajustes de Voz
            </span>
            <div className="bg-white border border-primary/10 rounded-2xl p-4 shadow-sm space-y-4">
              <div className="flex items-center gap-3 text-text pb-2 border-b border-primary/5">
                <Volume2 className="w-4 h-4 text-primary" />
                <span className="font-nunito font-semibold text-sm">Voz de Escobar</span>
              </div>

              {/* Volume Slider */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs font-nunito font-semibold text-text">
                  <span>Volumen de Voz</span>
                  <span className="text-primary font-bold">{localVolume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={localVolume}
                  onChange={handleVolumeChange}
                  onMouseUp={handleVolumeRelease}
                  onTouchEnd={handleVolumeRelease}
                  className="w-full accent-primary h-1 bg-primary/10 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Speed Slider */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs font-nunito font-semibold text-text">
                  <span>Velocidad de Habla</span>
                  <span className="text-primary font-bold">{localSpeed.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="1.5"
                  step="0.1"
                  value={localSpeed}
                  onChange={handleSpeedChange}
                  onMouseUp={handleSpeedRelease}
                  onTouchEnd={handleSpeedRelease}
                  className="w-full accent-primary h-1 bg-primary/10 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Wake Word Toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-primary/5">
                <div className="flex flex-col">
                  <span className="text-xs font-nunito font-semibold text-text">Escucha activa ('Escobar')</span>
                  <span className="text-[10px] text-muted leading-tight">Activa el micro continuo con wake word</span>
                </div>
                <button
                  type="button"
                  onClick={handleWakeWordToggle}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    localWakeWord ? 'bg-primary' : 'bg-primary/20'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      localWakeWord ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Account Card */}
          <div className="bg-white border border-primary/10 rounded-2xl p-4 shadow-sm space-y-4">
            <p className="font-nunito text-xs text-muted">
              Sesión iniciada como <span className="font-semibold text-text">{user?.email}</span>
            </p>
            <button
              onClick={handleSignOut}
              disabled={isSignoutLoading}
              className="flex w-full items-center justify-center gap-2 bg-[#FF8C69] text-white font-nunito font-bold text-sm h-10 rounded-[50px] hover:bg-[#FF8C69]/90 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              <span>{isSignoutLoading ? 'Saliendo...' : 'Cerrar sesión'}</span>
            </button>
          </div>

        </div>
      </div>

      {/* Footer Info */}
      <div className="px-4 py-4 border-t border-primary/5 bg-white text-center">
        <p className="font-nunito text-[10px] text-muted/60">
          Proyecto Escobar © 2026 • Versión 1.0.0
        </p>
      </div>

    </div>
  );
}
