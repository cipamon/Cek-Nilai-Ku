import React from 'react';
import { SchoolConfig } from '../types';
import { normalizeKopLines } from '../utils/helpers';
import { SchoolLogo } from './SchoolLogo';

interface OfficialLetterheadProps {
  config: SchoolConfig;
  documentTitle?: string;
  documentMeta?: string;
  compact?: boolean;
  className?: string;
}

export const OfficialLetterhead: React.FC<OfficialLetterheadProps> = ({
  config,
  documentTitle = 'Transkrip Nilai Akademik Siswa',
  documentMeta,
  compact = false,
  className = '',
}) => {
  const lines = normalizeKopLines(config.kopLines, config);
  const logoSize = compact ? 'w-14 h-14' : 'w-20 h-20';
  const hasRightLogo = Boolean((config.logoRightUrl || '').trim());

  const getLineClass = (idx: number) => {
    if (idx === 0 || idx === 1) {
      return compact
        ? 'text-[11px] font-semibold uppercase tracking-wide text-slate-800 leading-tight'
        : 'text-xs sm:text-sm font-semibold uppercase tracking-wide text-slate-800 leading-snug';
    }
    if (idx === 2) {
      return compact
        ? 'text-sm font-extrabold uppercase tracking-wide text-slate-950 leading-tight mt-0.5'
        : 'text-lg sm:text-xl font-extrabold uppercase tracking-wide text-slate-950 leading-snug mt-0.5';
    }
    if (idx === 3) {
      return compact
        ? 'text-[11px] font-medium text-slate-700 leading-tight mt-0.5'
        : 'text-xs sm:text-sm font-medium text-slate-800 leading-snug mt-0.5';
    }
    return compact
      ? 'text-[10px] text-slate-600 leading-tight'
      : 'text-[11px] sm:text-xs text-slate-600 leading-snug';
  };

  return (
    <div className={className}>
      <div className="pb-3.5 border-b-[3px] border-double border-slate-900">
        <div className="flex items-center justify-between gap-3 sm:gap-5">
          <SchoolLogo
            logoUrl={config.logoUrl}
            schoolName={config.name}
            sizeClass={logoSize}
            className="border-none p-0 bg-transparent"
          />

          <div className="flex-1 min-w-0 text-center">
            {lines.map((line, idx) =>
              line.trim() ? (
                <p key={idx} className={getLineClass(idx)}>
                  {line}
                </p>
              ) : null
            )}
          </div>

          {hasRightLogo ? (
            <SchoolLogo
              logoUrl={config.logoRightUrl}
              schoolName={`Logo Kanan ${config.name}`}
              sizeClass={logoSize}
              className="border-none p-0 bg-transparent"
            />
          ) : (
            <div className={`${logoSize} shrink-0`} aria-hidden="true" />
          )}
        </div>
      </div>

      {(documentTitle || documentMeta) && (
        <div
          className={`pt-2.5 text-center ${
            documentMeta ? 'flex flex-wrap items-center justify-between gap-2 text-left' : ''
          }`}
        >
          {documentTitle && (
            <h2
              className={`font-bold uppercase tracking-wider text-slate-900 ${
                compact ? 'text-xs' : 'text-sm sm:text-base'
              } ${documentMeta ? '' : 'w-full text-center'}`}
            >
              {documentTitle}
            </h2>
          )}
          {documentMeta && (
            <span className="text-[11px] font-semibold text-slate-700">{documentMeta}</span>
          )}
        </div>
      )}
    </div>
  );
};
