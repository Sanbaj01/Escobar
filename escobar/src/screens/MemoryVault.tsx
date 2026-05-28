import React, { useState, useEffect } from 'react';
import { ArrowLeft, Brain, Trash2, Download, Filter, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import supabase from '../lib/supabase';

interface Memory {
  id: string;
  content: string;
  type: 'episodic' | 'semantic' | 'correction' | 'preference';
  created_at: string;
}

interface MemoryVaultProps {
  onBack?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  episodic: 'Episódico',
  semantic: 'Semántico',
  correction: 'Corrección',
  preference: 'Preferencia'
};

const TYPE_COLORS: Record<string, string> = {
  episodic: 'bg-primary/10 text-primary',
  semantic: 'bg-secondary/10 text-secondary',
  correction: 'bg-accent/10 text-accent',
  preference: 'bg-teal-500/10 text-teal-600'
};

export default function MemoryVault({ onBack }: MemoryVaultProps) {
  const { user } = useAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('todos');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchMemories = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('memories')
        .select('id, content, type, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMemories(data || []);
    } catch (err) {
      console.error('Error fetching memories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, [user]);

  const handleDeleteMemory = async (id: string) => {
    if (!window.confirm('¿Segura que quieres que Escobar olvide este recuerdo, maje?')) return;
    try {
      const { error } = await supabase
        .from('memories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setMemories(prev => prev.filter(m => m.id !== id));
      setSuccess('Recuerdo olvidado.');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      console.error('Error deleting memory:', err);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('¿Deseas BORRAR TODA LA MEMORIA de Escobar? Este cambio es permanente y no recordará nada sobre ti.')) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('memories')
        .delete()
        .eq('user_id', user?.id || '');

      if (error) throw error;
      setMemories([]);
      setSuccess('Toda la memoria borrada.');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      console.error('Error clearing memories:', err);
      setError('Error al borrar la memoria.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    try {
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(memories, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `escobar_memories_${new Date().toISOString().slice(0,10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setSuccess('Datos exportados.');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const filteredMemories = memories.filter(m => {
    if (filter === 'todos') return true;
    return m.type === filter;
  });

  const filterOptions = ['todos', 'episodic', 'semantic', 'correction', 'preference'];

  return (
    <div className="flex-grow flex flex-col bg-bg h-full animate-fadeIn justify-between select-none">
      
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-primary/10 bg-white">
        <button 
          onClick={onBack}
          className="flex items-center text-primary font-nunito font-bold text-sm gap-1 hover:opacity-80 active:scale-95 transition-all"
        >
          <span>Volver</span>
        </button>
        <h2 className="flex-grow text-center font-serif-display text-lg font-bold pr-12 text-text">
          Bóveda de Memoria
        </h2>
      </div>

      {/* Main View scrollable */}
      <div className="flex-grow overflow-y-auto p-5 space-y-5">
        
        {/* Memory status notifications */}
        {success && (
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl text-primary text-xs font-nunito font-bold text-center">
            {success}
          </div>
        )}
        {error && (
          <div className="p-3 bg-secondary/10 border border-secondary/20 rounded-xl text-secondary text-xs font-nunito font-bold text-center">
            {error}
          </div>
        )}

        {/* Filter Pills */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 pl-1 text-muted text-xs font-bold uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5" />
            <span>Filtrar recuerdos</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full">
            {filterOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => setFilter(opt)}
                className={`px-3 py-1 rounded-full text-xs font-nunito font-bold border transition-all ${
                  filter === opt
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-white text-text border-primary/10 hover:border-primary/30'
                }`}
              >
                {opt === 'todos' ? 'Todos' : TYPE_LABELS[opt] || opt}
              </button>
            ))}
          </div>
        </div>

        {/* Memory list */}
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="bg-white/50 border border-dashed border-primary/20 rounded-2xl p-10 text-center text-muted font-nunito text-sm">
            {memories.length === 0 
              ? 'Escobar no tiene recuerdos guardados todavía. ¡Háblale más!' 
              : 'No hay recuerdos en este filtro, maje.'}
          </div>
        ) : (
          <div className="flex flex-col space-y-3">
            {filteredMemories.map((m) => (
              <div 
                key={m.id}
                className="bg-white border border-primary/10 rounded-2xl p-4 shadow-sm flex items-start justify-between"
              >
                <div className="space-y-1.5 flex-1 pr-4">
                  <p className="font-nunito text-xs text-text leading-relaxed font-semibold">
                    "{m.content}"
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase ${TYPE_COLORS[m.type] || 'bg-surface text-primary'}`}>
                      {TYPE_LABELS[m.type] || m.type}
                    </span>
                    <span className="font-nunito text-[9px] text-muted">
                      {new Date(m.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteMemory(m.id)}
                  className="p-1 hover:bg-secondary/15 rounded-full text-muted hover:text-secondary transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer export/clear buttons */}
      {memories.length > 0 && (
        <div className="px-5 py-4 border-t border-primary/5 bg-white flex gap-3 z-10">
          <button
            onClick={handleExport}
            className="flex-1 flex items-center justify-center gap-2 border border-primary text-primary bg-transparent font-nunito font-bold text-xs h-10 rounded-[50px] hover:bg-primary/5 active:scale-98 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Exportar JSON</span>
          </button>
          
          <button
            onClick={handleClearAll}
            className="flex-1 flex items-center justify-center gap-2 border border-secondary text-secondary bg-transparent font-nunito font-bold text-xs h-10 rounded-[50px] hover:bg-secondary/5 active:scale-98 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            <span>Olvidar todo</span>
          </button>
        </div>
      )}

    </div>
  );
}
