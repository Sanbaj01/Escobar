import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, BookOpen, User, CheckCircle2, Camera, UploadCloud, X, Loader2 } from 'lucide-react';

interface Question {
  id: number;
  question: string;
  options: string[];
  answerIndex: number;
}

const QUIZ_QUESTIONS: Question[] = [
  {
    id: 1,
    question: '¿Qué significa "puej si" en el caliche hondureño?',
    options: [
      'Tal vez',
      'Claro que sí / Pues sí',
      'Nunca / Jamás',
      'No entiendo'
    ],
    answerIndex: 1
  },
  {
    id: 2,
    question: 'Completa la oración: "Yo _____ (hablar) español con Escobar."',
    options: [
      'hablas',
      'hablo',
      'hablan',
      'hablar'
    ],
    answerIndex: 1
  },
  {
    id: 3,
    question: '¿Cuál de las siguientes opciones es gramaticalmente correcta?',
    options: [
      'el agua fría',
      'el agua frío'
    ],
    answerIndex: 0
  }
];

export default function OnboardingScreen() {
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Name, 2: Quiz, 3: Avatar Upload
  const [name, setName] = useState('');
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [spanishLevel, setSpanishLevel] = useState(1);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor, dime cómo llamarte, maje.');
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleQuizNext = () => {
    if (selectedOption === null) return;

    const isCorrect = selectedOption === QUIZ_QUESTIONS[currentQuestionIdx].answerIndex;
    const newCorrectCount = isCorrect ? correctAnswers + 1 : correctAnswers;
    setCorrectAnswers(newCorrectCount);

    if (currentQuestionIdx < QUIZ_QUESTIONS.length - 1) {
      setCurrentQuestionIdx(currentQuestionIdx + 1);
      setSelectedOption(null);
    } else {
      // Calculate final level based on score
      let calculatedLevel = 1;
      if (newCorrectCount === 2) {
        calculatedLevel = 3;
      } else if (newCorrectCount === 3) {
        calculatedLevel = 6;
      }
      setSpanishLevel(calculatedLevel);
      setStep(3); // Transition to Step 3: Avatar Upload
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...selected].slice(0, 10)); // cap at 10 photos
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSkipAvatar = async () => {
    await saveOnboardingData(spanishLevel, false);
  };

  const handleGenerateAvatar = async () => {
    if (files.length < 5) {
      setError('Sube al menos 5 fotos para generar el avatar, maje.');
      return;
    }
    if (!user) return;

    setLoading(true);
    setError(null);
    setUploadProgress('Subiendo fotos a Supabase Storage...');

    try {
      const uploadedUrls: string[] = [];

      // 1. Upload photos to storage
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const randHash = Math.random().toString(36).substring(2, 10);
        const fileName = `raw_${i}_${randHash}.${fileExt}`;
        const filePath = `${user.id}/raw_photos/${fileName}`;

        const { error: uploadErr } = await supabase.storage
          .from('avatar-images')
          .upload(filePath, file, { upsert: true });

        if (uploadErr) throw uploadErr;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('avatar-images')
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
        setUploadProgress(`Subiendo fotos... (${i + 1}/${files.length})`);
      }

      setUploadProgress('Iniciando entrenamiento en Replicate...');

      // 2. Trigger Replicate avatar training
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;
      if (!token) throw new Error('No active session found.');

      const response = await fetch('/api/avatar/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ photo_urls: uploadedUrls })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Error al iniciar la generación en el servidor.');
      }

      setUploadProgress('¡Todo listo! Redireccionando...');
      await saveOnboardingData(spanishLevel, true);

    } catch (err: any) {
      console.error('Avatar generation flow error:', err);
      setError(err.message || 'Error al subir fotos y generar avatar.');
      setUploadProgress(null);
      setLoading(false);
    }
  };

  const saveOnboardingData = async (level: number, avatarTriggered: boolean) => {
    if (!user) {
      setError('No se encontró una sesión activa.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Save display name & spanish level
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          display_name: name.trim(),
          spanish_level: level,
          avatar_ready: false // Will be set to true once training webhook triggers assets
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refreshProfile();
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Error al guardar la información de onboarding.');
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center w-full min-h-screen bg-bg select-none">
      {/* Constraints frame */}
      <div className="flex flex-col w-full max-w-md bg-bg shadow-2xl border-x border-primary/10 min-h-screen px-6 py-12 relative overflow-hidden justify-between">
        
        {/* Top bar back button */}
        <div className="h-6">
          {step > 1 && !loading && (
            <button 
              onClick={() => {
                if (step === 2) {
                  setStep(1);
                  setCurrentQuestionIdx(0);
                  setSelectedOption(null);
                  setCorrectAnswers(0);
                } else if (step === 3) {
                  setStep(2);
                  setCurrentQuestionIdx(0);
                  setSelectedOption(null);
                  setCorrectAnswers(0);
                  setFiles([]);
                }
              }}
              className="flex items-center text-primary font-nunito font-semibold text-sm gap-1 hover:opacity-80 active:scale-95 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver</span>
            </button>
          )}
        </div>

        {/* Form area */}
        <div className="flex-1 flex flex-col items-center justify-center py-8">
          {error && (
            <div className="w-full text-center text-secondary font-nunito text-sm font-semibold bg-secondary/10 py-2.5 px-4 rounded-xl border border-secondary/20 mb-6">
              {error}
            </div>
          )}

          {loading ? (
            /* LOADING OVERLAY STATE */
            <div className="text-center space-y-4 animate-fadeIn">
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
              <h3 className="font-serif-display text-2xl font-bold text-primary">Dale un momento, maje...</h3>
              <p className="font-nunito text-sm text-muted">
                {uploadProgress || 'Guardando tus datos en el servidor...'}
              </p>
            </div>
          ) : step === 1 ? (
            /* STEP 1: Name Input */
            <div className="w-full flex flex-col items-center text-center space-y-8 animate-fadeIn">
              <div className="w-16 h-16 bg-surface border-2 border-primary rounded-full flex items-center justify-center shadow-md">
                <User className="w-8 h-8 text-primary" />
              </div>
              <h2 className="font-serif-display text-4xl font-bold text-primary">
                ¿Cómo te llamo?
              </h2>
              <p className="font-nunito text-muted text-base">
                Dime tu nombre o apodo para que podamos empezar a hablar, maje.
              </p>

              <form onSubmit={handleNameSubmit} className="w-full flex flex-col space-y-4 pt-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre..."
                  maxLength={30}
                  className="w-full h-12 px-6 bg-white border-[1.5px] border-primary rounded-[50px] font-nunito text-text placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/45 text-center text-lg font-semibold transition-all"
                />

                <button
                  type="submit"
                  className="flex w-full items-center justify-center bg-primary text-white font-nunito font-bold text-base h-12 rounded-[50px] shadow-md hover:bg-primary/95 transition-all active:scale-[0.98]"
                >
                  ¡Vamos! 🚀
                </button>
              </form>
            </div>
          ) : step === 2 ? (
            /* STEP 2: Spanish Level Quiz */
            <div className="w-full flex flex-col animate-fadeIn">
              <div className="w-full flex items-center justify-between mb-4">
                <span className="font-nunito text-xs text-muted font-bold uppercase tracking-wider">
                  Evaluación de Español
                </span>
                <span className="font-nunito text-xs text-primary font-bold">
                  {currentQuestionIdx + 1} de {QUIZ_QUESTIONS.length}
                </span>
              </div>
              <div className="w-full h-2 bg-surface rounded-full overflow-hidden mb-8">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${((currentQuestionIdx + 1) / QUIZ_QUESTIONS.length) * 100}%` }}
                ></div>
              </div>

              <div className="text-center space-y-6">
                <div className="w-12 h-12 bg-surface border border-primary/20 rounded-full flex items-center justify-center mx-auto">
                  <BookOpen className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-serif-display text-2xl font-bold text-text leading-tight px-2">
                  {QUIZ_QUESTIONS[currentQuestionIdx].question}
                </h3>

                <div className="flex flex-col space-y-3 pt-4 w-full">
                  {QUIZ_QUESTIONS[currentQuestionIdx].options.map((opt, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedOption(idx)}
                      className={`flex w-full items-center px-6 h-12 rounded-[50px] font-nunito font-semibold text-sm transition-all border text-left active:scale-[0.98] ${
                        selectedOption === idx
                          ? 'bg-primary text-white border-primary shadow-md'
                          : 'bg-white text-text border-primary/20 hover:border-primary/50'
                      }`}
                    >
                      <span className="flex-1">{opt}</span>
                      {selectedOption === idx && <CheckCircle2 className="w-5 h-5 text-white ml-2" />}
                    </button>
                  ))}
                </div>

                <div className="pt-6 flex flex-col space-y-4">
                  <button
                    onClick={handleQuizNext}
                    disabled={selectedOption === null}
                    className="flex w-full items-center justify-center bg-primary text-white font-nunito font-bold text-base h-12 rounded-[50px] shadow-md hover:bg-primary/95 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                  >
                    Siguiente pregunta
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* STEP 3: Avatar Setup (Upload) */
            <div className="w-full flex flex-col animate-fadeIn">
              <div className="text-center space-y-4 mb-6">
                <div className="w-14 h-14 bg-surface border border-primary/20 rounded-full flex items-center justify-center mx-auto">
                  <Camera className="w-6 h-6 text-primary" />
                </div>
                <h2 className="font-serif-display text-3xl font-bold text-primary">
                  Dale vida a Escobar
                </h2>
                <p className="font-nunito text-xs text-muted leading-relaxed px-4">
                  Sube de <span className="font-bold text-text">5 a 10 fotos</span> de referencia. Entrenaremos un modelo LoRA para generar su avatar personalizado.
                </p>
              </div>

              {/* Upload Dashed Zone */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-36 border-2 border-dashed border-primary/30 rounded-2xl flex flex-col items-center justify-center bg-white cursor-pointer hover:border-primary transition-colors p-4 mb-4 select-none active:scale-[0.99]"
              >
                <UploadCloud className="w-8 h-8 text-primary/70 mb-2 animate-bounce" />
                <span className="font-nunito font-bold text-xs text-text">
                  Toca para seleccionar fotos
                </span>
                <span className="font-nunito text-[10px] text-muted mt-0.5">
                  Formatos: JPEG, PNG, WebP (Máx. 10MB)
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Thumbnails list */}
              {files.length > 0 && (
                <div className="w-full mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-nunito text-[10px] font-bold text-muted uppercase">
                      Fotos seleccionadas
                    </span>
                    <span className="font-nunito text-xs text-primary font-bold">
                      {files.length} / 10
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-2 max-h-[110px] overflow-y-auto p-1 bg-surface/10 rounded-xl border border-primary/5">
                    {files.map((file, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-white border border-primary/10 group">
                        <img
                          src={URL.createObjectURL(file)}
                          alt="thumbnail"
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => handleRemoveFile(idx)}
                          className="absolute top-0.5 right-0.5 bg-secondary/80 text-white p-0.5 rounded-full hover:bg-secondary transition-all active:scale-90"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA Action Buttons */}
              <div className="flex flex-col space-y-4">
                <button
                  onClick={handleGenerateAvatar}
                  disabled={files.length < 5 || loading}
                  className="flex w-full items-center justify-center bg-primary text-white font-nunito font-bold text-base h-12 rounded-[50px] shadow-md hover:bg-primary/95 transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
                >
                  Generar mi Escobar
                </button>

                <button
                  onClick={handleSkipAvatar}
                  disabled={loading}
                  className="font-nunito text-sm text-muted font-bold hover:text-primary transition-colors underline text-center"
                >
                  Saltar por ahora (Usar ilustrado)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-6 flex justify-center items-end">
          <p className="font-nunito text-[11px] text-muted/60">
            Paso {step} de 3 • Tu profe de caliche 💖
          </p>
        </div>

      </div>
    </div>
  );
}
