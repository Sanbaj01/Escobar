import React from 'react';

export interface Correction {
  original: string;
  correction: string;
  explanation: string;
  type: 'gender_agreement' | 'verb_conjugation' | 'ser_estar' | 'vocabulary' | 'other';
}

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  corrections?: Correction[];
  mood?: string;
}

const typeLabels: Record<Correction['type'], string> = {
  gender_agreement: 'Género',
  verb_conjugation: 'Conjugación',
  ser_estar: 'Ser/Estar',
  vocabulary: 'Vocabulario',
  other: 'Gramática',
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  role,
  content,
  corrections,
  mood,
}) => {
  const isUser = role === 'user';

  return (
    <div className={`flex w-full flex-col ${isUser ? 'items-end' : 'items-start'} my-2`}>
      {/* Mood label for assistant (optional/premium detail) */}
      {!isUser && mood && (
        <span className="font-nunito text-[10px] text-primary/70 font-semibold px-2 mb-0.5 capitalize">
          Escobar • {mood}
        </span>
      )}

      {/* Chat Bubble */}
      <div
        className={`max-w-[80%] px-[14px] py-[10px] font-nunito text-[14px] leading-relaxed shadow-sm transition-all duration-200 ${
          isUser
            ? 'bg-secondary text-white rounded-[18px_18px_4px_18px]'
            : 'bg-bg border border-border text-text rounded-[18px_18px_18px_4px]'
        }`}
      >
        {content}
      </div>

      {/* Corrections (if any) */}
      {!isUser && corrections && corrections.length > 0 && (
        <div className="mt-2 w-[85%] max-w-[400px] flex flex-col gap-2">
          {corrections.map((corr, idx) => (
            <div
              key={idx}
              className="bg-[#FBEAF0] border border-[#F4C0D1] rounded-[10px] p-[10px] flex flex-col space-y-1.5 shadow-sm animate-fade-in"
            >
              {/* Header with Type Badge */}
              <div className="flex items-center justify-between">
                <span className="font-nunito font-bold text-xs text-[#2C1810]">
                  Casi, maje!
                </span>
                <span className="bg-secondary/25 text-[#FF8C69] font-nunito text-[10px] font-bold px-2 py-0.5 rounded-[50px]">
                  {typeLabels[corr.type] || corr.type}
                </span>
              </div>

              {/* Correction details */}
              <div className="font-nunito text-xs text-text">
                <span className="line-through text-muted/65 mr-1.5">"{corr.original}"</span>
                <span className="font-bold text-primary">→ "{corr.correction}"</span>
              </div>

              {/* In-character explanation */}
              {corr.explanation && (
                <p className="font-nunito text-[12px] text-muted italic leading-normal border-t border-[#F4C0D1]/40 pt-1">
                  {corr.explanation}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
