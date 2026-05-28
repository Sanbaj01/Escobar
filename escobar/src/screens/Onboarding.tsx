import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export default function OnboardingScreen() {
  const { user, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor, dime cómo llamarte, maje.');
      return;
    }
    if (!user) {
      setError('No se encontró una sesión activa.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ display_name: name.trim() })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refreshProfile();
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Error al guardar el nombre.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-bg px-6 py-12 select-none">
      <div className="w-full max-w-sm flex flex-col items-center text-center space-y-8">
        <h2 className="font-serif-display text-4xl font-bold text-primary">
          ¿Cómo te llamo?
        </h2>
        <p className="font-nunito text-muted text-base">
          Dime tu nombre para que podamos empezar a hablar.
        </p>

        {error && (
          <div className="w-full text-center text-secondary font-nunito text-sm font-semibold bg-surface/20 py-2 px-4 rounded-xl border border-primary/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full flex flex-col space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre o apodo..."
            maxLength={30}
            className="w-full h-12 px-6 bg-white border-[1.5px] border-primary rounded-[50px] font-nunito text-text placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/45 focus:border-primary text-center text-lg font-semibold transition-all"
          />

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center bg-primary text-white font-nunito font-bold text-base h-12 rounded-[50px] shadow-md hover:bg-primary/95 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'Guardando...' : '¡Vamos! 🚀'}
          </button>
        </form>
      </div>
    </div>
  );
}
