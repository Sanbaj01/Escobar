import React, { useState } from 'react';
import { Chrome, Mail } from 'lucide-react';
import { signInWithGoogle, signInWithMagicLink } from '../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      const { error } = await signInWithGoogle();
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión con Google.');
    }
  };

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Por favor, ingresa tu correo.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { error } = await signInWithMagicLink(email);
      if (error) throw error;
      setIsSent(true);
    } catch (err: any) {
      setError(err.message || 'Error al enviar el enlace mágico.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-between bg-bg px-6 py-12 select-none">
      {/* Top Section (approx 40% height) */}
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h1 className="font-serif-display text-6xl font-bold text-primary tracking-wide mb-2">
          Escobar
        </h1>
        <p className="font-nunito italic text-lg text-muted font-medium">
          Tu Hondureña. Tu Profe. Tu todo.
        </p>
      </div>

      {/* Auth Box Container */}
      <div className="w-full max-w-sm flex flex-col items-center space-y-6">
        {error && (
          <div className="w-full text-center text-secondary font-nunito text-sm font-semibold bg-surface/20 py-2 px-4 rounded-xl border border-primary/20">
            {error}
          </div>
        )}

        {isSent ? (
          <div className="w-full text-center py-6 px-4 bg-[#FBEAF0] border border-[#F4C0D1] rounded-[16px] animate-pulse">
            <p className="font-nunito text-primary font-bold text-lg">
              ¡Cheque! Revisa tu correo, maje. 📬
            </p>
            <p className="font-nunito text-muted text-sm mt-1">
              Te enviamos un enlace de acceso directo.
            </p>
          </div>
        ) : (
          <>
            {/* Google Login Button */}
            <button
              onClick={handleGoogleLogin}
              className="flex w-full items-center justify-center gap-3 bg-primary text-white font-nunito font-bold text-base h-12 rounded-[50px] shadow-sm hover:bg-primary/95 transition-all active:scale-[0.98]"
            >
              <Chrome className="h-5 w-5" />
              <span>Continúa con Google</span>
            </button>

            {/* Divider */}
            <div className="flex w-full items-center justify-center py-2">
              <div className="flex-grow border-t border-primary/20"></div>
              <span className="px-4 font-nunito text-muted text-sm font-medium">o</span>
              <div className="flex-grow border-t border-primary/20"></div>
            </div>

            {/* Magic Link Email Form */}
            <form onSubmit={handleMagicLinkLogin} className="w-full flex flex-col space-y-3">
              <div className="relative w-full">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full h-12 pl-12 pr-4 bg-white border-[1.5px] border-primary rounded-[50px] font-nunito text-text placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/45 focus:border-primary transition-all text-base"
                />
                <Mail className="absolute left-4 top-3.5 h-5 w-5 text-muted/60" />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center bg-transparent border-2 border-primary text-primary font-nunito font-bold text-base h-12 rounded-[50px] hover:bg-primary/5 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? 'Enviando...' : 'Envíame un enlace'}
              </button>
            </form>
          </>
        )}
      </div>

      {/* Footer Info */}
      <div className="h-12 flex items-end">
        <p className="font-nunito text-xs text-muted/60">
          Proyecto Escobar © 2026. Made with ❤️ in Honduras.
        </p>
      </div>
    </div>
  );
}
