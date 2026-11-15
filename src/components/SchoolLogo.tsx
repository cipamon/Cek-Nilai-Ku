import React, { useEffect, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { convertGDriveUrl } from '../utils/helpers';

interface SchoolLogoProps {
  logoUrl?: string;
  schoolName?: string;
  sizeClass?: string;
  className?: string;
}

export const SchoolLogo: React.FC<SchoolLogoProps> = ({
  logoUrl,
  schoolName = 'Sekolah',
  sizeClass = 'w-12 h-12',
  className = '',
}) => {
  const [hasError, setHasError] = useState(false);

  const normalizedUrl = logoUrl ? convertGDriveUrl(logoUrl).converted : '';

  useEffect(() => {
    setHasError(false);
  }, [normalizedUrl]);

  if (!normalizedUrl || hasError) {
    return (
      <div
        className={`${sizeClass} ${className} rounded-xl bg-theme-soft border border-theme-soft text-theme-heading flex items-center justify-center shrink-0`}
        aria-label={`Logo ${schoolName}`}
      >
        <GraduationCap className="w-1/2 h-1/2" strokeWidth={1.75} />
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} ${className} rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 p-1`}
    >
      <img
        src={normalizedUrl}
        alt={`Logo ${schoolName}`}
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
        className="w-full h-full object-contain"
      />
    </div>
  );
};
