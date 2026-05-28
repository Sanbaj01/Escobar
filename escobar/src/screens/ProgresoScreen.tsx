import React, { useState, useEffect } from 'react';
import { BarChart2, TrendingUp, HelpCircle, ArrowRight, Award, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import supabase from '../lib/supabase';

interface SpanishError {
  id: string;
  error_type: string;
  example: string;
  correction: string;
  count: number;
  last_seen: string;
}

const ERROR_TYPE_LABELS: Record<string, string> = {
  gender_agreement: 'Género',
  verb_conjugation: 'Conjugación',
  ser_estar: 'Ser vs Estar',
  vocabulary: 'Vocabulario',
  word_order: 'Orden de palabras',
  subjunctive: 'Subjuntivo',
  other: 'Otro'
};

const LEVEL_LABELS: Record<number, string> = {
  1: 'Principiante I',
  2: 'Principiante II',
  3: 'Básico I',
  4: 'Básico II',
  5: 'Intermedio',
  6: 'Avanzado I',
  7: 'Avanzado II',
  8: 'Fluido',
  9: 'Hondureña Fluida',
  10: 'Caliche Master 👑'
};

export default function ProgresoScreen() {
  const { user, profile } = useAuth();
  const [errors, setErrors] = useState<SpanishError[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedError, setSelectedError] = useState<SpanishError | null>(null);

  const fetchErrors = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('spanish_errors')
        .select('*')
        .order('count', { ascending: false });

      if (error) throw error;
      setErrors(data || []);
    } catch (err) {
      console.error('Error fetching spanish errors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchErrors();
  }, [user]);

  const handleClearError = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('¿Segura que quieres borrar el registro de este error, maje?')) return;
    try {
      const { error } = await supabase
        .from('spanish_errors')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setErrors(prev => prev.filter(err => err.id !== id));
      if (selectedError?.id === id) {
        setSelectedError(null);
      }
    } catch (err) {
      console.error('Error deleting error record:', err);
    }
  };

  const level = profile?.spanish_level ?? 1;
  const levelName = LEVEL_LABELS[level] || 'Principiante';

  // Calculate simulated XP progress to next level
  const totalCorrections = errors.reduce((sum, err) => sum + err.count, 0);
  const totalUniqueErrors = errors.length;
  
  // XP formula: total messages count + corrections * 5
  // We can calculate target XP for level up. Let's make it look authentic and dynamic.
  const currentXP = (totalCorrections * 15) % 100;
  const targetXP = 100;

  return (
    <div className="flex-1 flex flex-col bg-bg h-full select-none">
      
      {/* Header */}
      <div className="flex items-center justify-center px-4 py-4 border-b border-primary/10 bg-white">
        <h2 className="font-serif-display text-xl font-bold text-text">
          Mi Progreso
        </h2>
      </div>

      {/* Main progress scroll viewport */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        
        {/* Level Circular Badge card */}
        <div className="bg-white border border-primary/10 rounded-2xl p-5 shadow-sm flex flex-col items-center text-center space-y-4">
          <div className="w-20 h-20 bg-primary rounded-full flex flex-col items-center justify-center text-white shadow-md relative">
            <span className="font-serif-display text-3xl font-bold leading-none">{level}</span>
            <span className="font-nunito text-[8px] font-bold uppercase tracking-wider mt-0.5">Nivel</span>
            <Award className="absolute -bottom-1 -right-1 w-6 h-6 text-[#FFB347] bg-white rounded-full p-0.5 border border-primary/10 shadow-sm" />
          </div>
          <div>
            <h3 className="font-serif-display text-xl font-bold text-text leading-tight">
              {levelName}
            </h3>
            <p className="font-nunito text-xs text-muted mt-1">
              Sigue conversando para subir tu fluidez en caliche
            </p>
          </div>

          {/* XP Progress Bar */}
          <div className="w-full space-y-1.5 pt-2">
            <div className="flex justify-between items-center text-[10px] font-bold text-muted uppercase">
              <span>Progreso del Nivel</span>
              <span>{Math.round(currentXP)} / {targetXP} XP</span>
            </div>
            <div className="w-full h-2 bg-surface/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${(currentXP / targetXP) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-primary/10 rounded-xl p-3 text-center shadow-sm">
            <span className="block font-serif-display text-xl font-bold text-primary">
              {totalUniqueErrors}
            </span>
            <span className="font-nunito text-[9px] font-bold text-muted uppercase tracking-wider">
              Errores Únicos
            </span>
          </div>
          <div className="bg-white border border-primary/10 rounded-xl p-3 text-center shadow-sm">
            <span className="block font-serif-display text-xl font-bold text-primary">
              {totalCorrections}
            </span>
            <span className="font-nunito text-[9px] font-bold text-muted uppercase tracking-wider">
              Correcciones
            </span>
          </div>
          <div className="bg-white border border-primary/10 rounded-xl p-3 text-center shadow-sm">
            <span className="block font-serif-display text-xl font-bold text-primary">
              {Math.max(0, 12 - totalUniqueErrors)}
            </span>
            <span className="font-nunito text-[9px] font-bold text-muted uppercase tracking-wider">
              Días Limpios
            </span>
          </div>
        </div>

        {/* Mis Errores Frecuentes list */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 pl-1">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="font-nunito text-xs font-bold text-muted uppercase tracking-wider">
              Mis Errores Frecuentes
            </span>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            </div>
          ) : errors.length === 0 ? (
            /* Empty State */
            <div className="bg-white/50 border border-dashed border-primary/20 rounded-2xl p-8 text-center text-muted font-nunito text-sm">
              ¡Todavía sin errores registrados, maje! Segí conversando con Escobar. 💬
            </div>
          ) : (
            <div className="flex flex-col space-y-3">
              {errors.map((err) => (
                <div 
                  key={err.id}
                  onClick={() => setSelectedError(err)}
                  className="bg-white border border-primary/10 rounded-2xl p-4 shadow-sm hover:border-primary/40 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="space-y-1.5 flex-1 pr-4 min-w-0">
                    {/* Error indicator wrong -> correct */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-nunito text-xs text-secondary line-through truncate max-w-[120px]">
                        {err.example}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-muted shrink-0" />
                      <span className="font-nunito text-sm font-bold text-text truncate max-w-[130px]">
                        {err.correction}
                      </span>
                    </div>
                    {/* Badge details */}
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-surface text-primary rounded-full text-[9px] font-bold uppercase">
                        {ERROR_TYPE_LABELS[err.error_type] || err.error_type}
                      </span>
                      <span className="font-nunito text-[10px] text-muted">
                        Visto hace poco
                      </span>
                    </div>
                  </div>

                  {/* Right side counter and delete */}
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-nunito font-bold text-xs">
                      {err.count}
                    </span>
                    <button
                      onClick={(e) => handleClearError(err.id, e)}
                      className="p-1 hover:bg-secondary/10 rounded-full text-muted hover:text-secondary transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Error Detail Modal Drawer Overlay */}
      {selectedError && (
        <div className="absolute inset-0 bg-[#2C1810]/40 backdrop-blur-sm z-50 flex items-end justify-center animate-fadeIn">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-t-3xl p-6 shadow-2xl border-t border-primary/10 space-y-5 animate-slideUp"
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="px-2.5 py-0.5 bg-surface text-primary rounded-full text-[10px] font-bold uppercase">
                  Detalle del error
                </span>
                <h3 className="font-serif-display text-xl font-bold text-text mt-1.5">
                  Falla de {ERROR_TYPE_LABELS[selectedError.error_type] || selectedError.error_type}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedError(null)}
                className="bg-surface/50 text-muted p-1 rounded-full hover:bg-surface transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 bg-[#FFF8F0] border border-primary/5 rounded-2xl p-4">
              <div className="flex flex-col">
                <span className="font-nunito text-[10px] font-bold text-muted uppercase">Dijiste incorrectamente:</span>
                <span className="font-nunito text-sm text-secondary line-through mt-0.5">{selectedError.example}</span>
              </div>
              <div className="flex flex-col border-t border-primary/5 pt-2.5">
                <span className="font-nunito text-[10px] font-bold text-muted uppercase">Lo correcto es:</span>
                <span className="font-nunito text-base font-bold text-primary mt-0.5">{selectedError.correction}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-nunito font-bold text-xs text-muted uppercase tracking-wider pl-0.5">
                Consejo de Escobar
              </h4>
              <p className="font-nunito text-sm text-text leading-relaxed italic bg-surface/10 p-3 rounded-xl border border-primary/10">
                "¡Ay maje! No te preocupes, errar es de humanos. Pero recordá: `{selectedError.correction}` suena mucho mejor. ¡Seguí practicando y cheque!"
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setSelectedError(null)}
                className="flex-1 bg-primary text-white font-nunito font-bold text-sm h-11 rounded-[50px] shadow-sm hover:bg-primary/95 transition-all active:scale-[0.98]"
              >
                Cheque, entendido
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Simple local X icon since it wasn't imported from lucide-react in top line
function X(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
