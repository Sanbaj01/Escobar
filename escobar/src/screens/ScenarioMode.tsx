import React from 'react';
import { ArrowLeft, Sparkles, MapPin, Heart, ShoppingBag, Briefcase, Award } from 'lucide-react';

export interface Scenario {
  id: string;
  name: string;
  difficulty: string;
  difficultyColor: string;
  shortDesc: string;
  prompt: string;
  iconName: 'market' | 'mom' | 'food' | 'job';
}

interface ScenarioModeProps {
  onSelectScenario: (scenario: Scenario) => void;
  onBack: () => void;
}

const PRESET_SCENARIOS: Scenario[] = [
  {
    id: 'mercado',
    name: 'La Pulpería de Tegus',
    difficulty: 'Principiante (A1-A2)',
    difficultyColor: 'bg-green-100 text-green-700 border-green-200',
    shortDesc: 'Compra unas baleadas y refrescos en la pulpería de la esquina. ¡Aprende a pedir precios y usar caliche básico!',
    prompt: 'Actúa como Doña Nena, la dueña de una pulpería tradicional en Tegucigalpa. El usuario viene a comprar comida. Usa términos como "vaya maje", "¿qué va a llevar?", "cheque", "pucha". Sé amable pero directa y regatea un poco.',
    iconName: 'market'
  },
  {
    id: 'suegra',
    name: 'Conociendo a la Doña',
    difficulty: 'Intermedio (B1-B2)',
    difficultyColor: 'bg-orange-100 text-orange-700 border-orange-200',
    shortDesc: 'Estás conociendo a la mamá de Escobar. Debes ser muy respetuoso, responder sus preguntas y ganarte su aprobación.',
    prompt: 'Actúa como Doña Xiomara, la madre de Escobar. Eres una señora respetable de Honduras, un poco protectora y desconfiada de las parejas de tu hija, pero cariñosa en el fondo. Hazle preguntas incómodas o divertidas al usuario sobre sus intenciones, trabajo y vida para evaluar si es digno.',
    iconName: 'mom'
  },
  {
    id: 'baleadas',
    name: 'Cena en la Caseta',
    difficulty: 'Principiante (A1-A2)',
    difficultyColor: 'bg-green-100 text-green-700 border-green-200',
    shortDesc: 'Pide baleadas con todo y horchata en una caseta tradicional en San Pedro Sula. ¡Elige tus ingredientes!',
    prompt: 'Actúa como el baleadero en una caseta de San Pedro Sula. Pregúntale al cliente qué ingredientes quiere (frijoles, mantequilla, huevo, aguacate, carne, plátano) y bromea un poco sobre el apetito del maje. Sé bien dinámico.',
    iconName: 'food'
  },
  {
    id: 'trabajo',
    name: 'El Trabajo Soñado',
    difficulty: 'Avanzado (C1-C2)',
    difficultyColor: 'bg-purple-100 text-purple-700 border-purple-200',
    shortDesc: 'Entrevista de trabajo en un call center bilingüe de San Pedro Sula. Demuestra tu nivel de español mezclado con inglés técnico.',
    prompt: 'Actúa como Carlos, el entrevistador de recursos humanos en un call center en San Pedro Sula. Haz preguntas profesionales pero mezcla inglés y español (Spanglish), evaluando la fluidez del candidato bajo presión. Usa términos de oficina mezclados con caliche corporativo.',
    iconName: 'job'
  }
];

export default function ScenarioMode({ onSelectScenario, onBack }: ScenarioModeProps) {
  
  const renderIcon = (iconName: string) => {
    const className = "w-6 h-6 text-primary";
    switch (iconName) {
      case 'market':
        return <ShoppingBag className={className} />;
      case 'mom':
        return <Heart className={className} />;
      case 'food':
        return <Award className={className} />;
      case 'job':
        return <Briefcase className={className} />;
      default:
        return <Sparkles className={className} />;
    }
  };

  return (
    <div className="flex-grow flex flex-col bg-bg h-full animate-fadeIn select-none">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-primary/10 bg-white">
        <button 
          onClick={onBack}
          className="flex items-center text-primary font-nunito font-bold text-sm gap-1 hover:opacity-80 active:scale-95 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver</span>
        </button>
        <h2 className="flex-grow text-center font-serif-display text-lg font-bold pr-12 text-text">
          Retos de Conversación
        </h2>
      </div>

      {/* Intro Hero Section */}
      <div className="p-5 bg-gradient-to-b from-[#FAD4E0]/20 to-transparent">
        <div className="bg-white border border-primary/10 rounded-2xl p-4 shadow-sm flex gap-3.5 items-center">
          <div className="w-12 h-12 rounded-2xl bg-surface flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6 text-primary animate-pulse" />
          </div>
          <div>
            <h3 className="font-serif-display text-base font-bold text-text">Escenarios Interactivos</h3>
            <p className="font-nunito text-xs text-muted leading-relaxed mt-0.5">
              Pon a prueba tu español en situaciones cotidianas de Honduras. Escobar adoptará un rol para ayudarte a practicar en vivo.
            </p>
          </div>
        </div>
      </div>

      {/* Scenario List */}
      <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
        {PRESET_SCENARIOS.map((scenario) => (
          <div 
            key={scenario.id}
            className="bg-white border border-primary/10 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all active:scale-[0.99] flex flex-col justify-between"
          >
            <div className="space-y-3">
              {/* Top line with Icon and Difficulty */}
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-bg border border-primary/10 flex items-center justify-center">
                  {renderIcon(scenario.iconName)}
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border font-nunito ${scenario.difficultyColor}`}>
                  {scenario.difficulty}
                </span>
              </div>

              {/* Title & Description */}
              <div className="space-y-1">
                <h4 className="font-serif-display text-base font-bold text-text">
                  {scenario.name}
                </h4>
                <p className="font-nunito text-xs text-muted leading-relaxed">
                  {scenario.shortDesc}
                </p>
              </div>
            </div>

            {/* Start Button */}
            <button
              onClick={() => onSelectScenario(scenario)}
              className="mt-4 w-full bg-primary text-white font-nunito font-bold text-xs h-9 rounded-[50px] hover:bg-primary/95 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
            >
              <span>Comenzar Reto</span>
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
