import React from 'react';

export const TypingIndicator: React.FC = () => {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3 bg-[#FFF8F0] border border-[rgba(242,92,138,0.22)] rounded-[18px_18px_18px_4px] w-fit my-2 shadow-sm">
      <span className="font-nunito text-xs text-muted/80 mr-1 italic">Escobar está escribiendo</span>
      <div className="flex gap-1 items-center h-2">
        <div className="w-1.5 h-1.5 bg-primary rounded-full dot-pulse-stagger dot-delay-1"></div>
        <div className="w-1.5 h-1.5 bg-primary rounded-full dot-pulse-stagger dot-delay-2"></div>
        <div className="w-1.5 h-1.5 bg-primary rounded-full dot-pulse-stagger dot-delay-3"></div>
      </div>
    </div>
  );
};

export default TypingIndicator;
