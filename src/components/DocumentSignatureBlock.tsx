import React, { useMemo } from 'react';
import { SchoolConfig, SignatureDisplayMode } from '../types';
import { resolveSignatureMode } from '../utils/helpers';

interface DocumentSignatureBlockProps {
  config: SchoolConfig;
  modeOverride?: SignatureDisplayMode;
  teacherTitleOverride?: string;
  teacherNameOverride?: string;
  teacherNipOverride?: string;
  compact?: boolean;
  dateLabel?: string;
  className?: string;
}

export const DocumentSignatureBlock: React.FC<DocumentSignatureBlockProps> = ({
  config,
  modeOverride,
  teacherTitleOverride,
  teacherNameOverride,
  teacherNipOverride,
  compact = false,
  dateLabel,
  className = '',
}) => {
  const mode = modeOverride ?? resolveSignatureMode(config);

  const formattedDate = useMemo(() => {
    if (dateLabel) return dateLabel;
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date());
  }, [dateLabel]);

  if (mode === 'none') {
    return null;
  }

  const cityPrefix = config.cityName?.trim() ? `${config.cityName.trim()}, ` : '';
  const headmasterName = config.headmasterName?.trim() || '__________________________';
  const headmasterNip = config.headmasterNip?.trim() || '';

  const teacherTitle =
    (teacherTitleOverride ?? config.teacherSignTitle)?.trim() || 'Guru / Wali Kelas';
  const teacherName =
    (teacherNameOverride ?? config.teacherSignName)?.trim() || '__________________________';
  const teacherNip = (teacherNipOverride ?? config.teacherSignNip)?.trim() || '';

  const spaceClass = compact ? 'h-10' : 'h-16';
  const textClass = compact ? 'text-xs' : 'text-xs sm:text-sm';

  if (mode === 'headmaster') {
    return (
      <div className={`flex justify-end print-break-inside-avoid ${className}`}>
        <div className={`w-64 text-left text-slate-800 ${textClass}`}>
          <p>
            {cityPrefix}
            {formattedDate}
          </p>
          <p className="font-semibold text-slate-900 mt-0.5">Kepala Sekolah,</p>
          <div className={spaceClass} />
          <p className="font-bold text-slate-950 underline underline-offset-4">
            {headmasterName}
          </p>
          {headmasterNip && (
            <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 font-mono">
              NIP. {headmasterNip}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'teacher') {
    return (
      <div className={`flex justify-end print-break-inside-avoid ${className}`}>
        <div className={`w-64 text-left text-slate-800 ${textClass}`}>
          <p>
            {cityPrefix}
            {formattedDate}
          </p>
          <p className="font-semibold text-slate-900 mt-0.5">{teacherTitle},</p>
          <div className={spaceClass} />
          <p className="font-bold text-slate-950 underline underline-offset-4">
            {teacherName}
          </p>
          {teacherNip && (
            <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 font-mono">
              NIP. {teacherNip}
            </p>
          )}
        </div>
      </div>
    );
  }

  // mode === 'both'
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 print:flex-row print:justify-between print-break-inside-avoid ${className}`}
    >
      <div className={`w-64 text-left text-slate-800 ${textClass}`}>
        <p className="text-slate-700">Mengetahui,</p>
        <p className="font-semibold text-slate-900 mt-0.5">Kepala Sekolah,</p>
        <div className={spaceClass} />
        <p className="font-bold text-slate-950 underline underline-offset-4">
          {headmasterName}
        </p>
        {headmasterNip && (
          <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 font-mono">
            NIP. {headmasterNip}
          </p>
        )}
      </div>

      <div className={`w-64 text-left text-slate-800 ${textClass}`}>
        <p>
          {cityPrefix}
          {formattedDate}
        </p>
        <p className="font-semibold text-slate-900 mt-0.5">{teacherTitle},</p>
        <div className={spaceClass} />
        <p className="font-bold text-slate-950 underline underline-offset-4">
          {teacherName}
        </p>
        {teacherNip && (
          <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 font-mono">
            NIP. {teacherNip}
          </p>
        )}
      </div>
    </div>
  );
};
