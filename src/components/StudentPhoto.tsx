import React, { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import maleAvatarImg from '../assets/images/student_male_avatar_1794570399254.jpg';
import femaleAvatarImg from '../assets/images/student_female_avatar_1794570398718.jpg';
import { convertGDriveUrl, normalizeGender } from '../utils/helpers';

interface StudentPhotoProps {
  photoUrl?: string;
  studentName?: string;
  gender?: string;
  sizeClass?: string;
  className?: string;
  roundedClass?: string;
  textSizeClass?: string;
}

function getGDriveSecondaryUrl(convertedUrl: string): string | null {
  const m = convertedUrl.match(/drive\.google\.com\/thumbnail\?id=([a-zA-Z0-9_-]+)/i);
  if (m && m[1]) {
    return `https://lh3.googleusercontent.com/d/${m[1]}=w800`;
  }
  return null;
}

export const StudentPhoto: React.FC<StudentPhotoProps> = ({
  photoUrl,
  studentName = 'Siswa',
  gender = '',
  sizeClass = 'w-14 h-14',
  className = '',
  roundedClass = 'rounded-xl',
  textSizeClass = 'text-xs sm:text-sm',
}) => {
  const [tryStage, setTryStage] = useState<0 | 1 | 2>(0);

  const normalizedUrl = photoUrl ? convertGDriveUrl(photoUrl).converted : '';
  const secondaryUrl = normalizedUrl ? getGDriveSecondaryUrl(normalizedUrl) : null;
  const normalizedGender = normalizeGender(gender);

  useEffect(() => {
    setTryStage(0);
  }, [normalizedUrl]);

  const activeSrc =
    tryStage === 0 ? normalizedUrl : tryStage === 1 && secondaryUrl ? secondaryUrl : '';

  if (activeSrc && tryStage < 2) {
    return (
      <div
        className={`${sizeClass} ${roundedClass} ${className} flex items-center justify-center bg-slate-100 border border-slate-200 overflow-hidden shrink-0`}
      >
        <img
          src={activeSrc}
          alt={`Foto ${studentName}`}
          referrerPolicy="no-referrer"
          onError={() => {
            if (tryStage === 0 && secondaryUrl) {
              setTryStage(1);
            } else {
              setTryStage(2);
            }
          }}
          className="w-full h-full object-cover object-top"
        />
      </div>
    );
  }

  if (normalizedGender === 'L' || normalizedGender === 'P') {
    const dummySrc = normalizedGender === 'L' ? maleAvatarImg : femaleAvatarImg;
    const genderText = normalizedGender === 'L' ? 'Siswa Laki-laki' : 'Siswa Perempuan';
    return (
      <div
        className={`${sizeClass} ${roundedClass} ${className} flex items-center justify-center bg-theme-soft border border-theme-soft overflow-hidden shrink-0`}
        title={`${studentName} (Foto ilustrasi ${genderText})`}
      >
        <img
          src={dummySrc}
          alt={`Foto default ${genderText} - ${studentName}`}
          className="w-full h-full object-cover object-top"
        />
      </div>
    );
  }

  const initials = studentName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  return (
    <div
      className={`${sizeClass} ${roundedClass} ${className} flex flex-col items-center justify-center bg-theme-soft text-theme-heading border border-theme-soft shrink-0 font-bold select-none`}
      aria-label={`Foto ${studentName}`}
      title={studentName}
    >
      {initials ? (
        <span className={`${textSizeClass} tracking-tight`}>{initials}</span>
      ) : (
        <User className="w-1/2 h-1/2" strokeWidth={1.75} />
      )}
    </div>
  );
};
