import React from 'react';
import { splitSlashChord } from '../utils/chords';

export type ChordDisplaySize = 'xs' | 'sm' | 'md' | 'lg';

interface ChordDisplayProps {
  chordText: string;
  size?: ChordDisplaySize;
  className?: string;
}

const BADGE_SIZE_CLASSES: Record<ChordDisplaySize, string> = {
  xs: 'min-w-[16px] h-[16px] px-1 text-[9px] -mt-1 ml-0.5',
  sm: 'min-w-[20px] h-[20px] px-1.5 text-[10px] -mt-1.5 ml-0.5',
  md: 'min-w-[22px] h-[22px] px-1.5 text-[11px] -mt-1.5 ml-1',
  lg: 'min-w-[30px] h-[30px] sm:min-w-[34px] sm:h-[34px] px-2 text-sm sm:text-base -mt-2 ml-1.5',
};

const TOP_PAD_CLASSES: Record<ChordDisplaySize, string> = {
  xs: 'pt-1',
  sm: 'pt-1.5',
  md: 'pt-1.5',
  lg: 'pt-2.5',
};

export const ChordDisplay: React.FC<ChordDisplayProps> = ({
  chordText,
  size = 'sm',
  className = '',
}) => {
  const raw = (chordText || '').trim();
  if (!raw || raw === '-' || raw === '—') {
    return <span className={className}>—</span>;
  }

  // Handle beat-split chords joined with " · " (e.g. "Em · C/G")
  const tokens = raw.includes(' · ') ? raw.split(' · ') : [raw];
  const hasSlash = tokens.some((tok) => splitSlashChord(tok).bass !== null);

  return (
    <span
      className={`inline-flex items-center justify-center flex-wrap gap-x-1 gap-y-0.5 max-w-full ${
        hasSlash ? TOP_PAD_CLASSES[size] : ''
      } ${className}`}
    >
      {tokens.map((tok, idx) => {
        const { main, bass } = splitSlashChord(tok);
        return (
          <React.Fragment key={`${tok}-${idx}`}>
            {idx > 0 && (
              <span aria-hidden="true" className="opacity-65 mx-0.5">
                ·
              </span>
            )}
            {bass ? (
              <span className="inline-flex items-start justify-center max-w-full min-w-0">
                <span className="truncate min-w-0">{main}</span>
                <span
                  style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                  className={`inline-flex items-center justify-center rounded-full bg-[#FACC15] text-[#111827] font-sans font-bold leading-none shrink-0 shadow-xs ${BADGE_SIZE_CLASSES[size]}`}
                >
                  {bass}
                </span>
              </span>
            ) : (
              <span className="truncate max-w-full">{main}</span>
            )}
          </React.Fragment>
        );
      })}
    </span>
  );
};
