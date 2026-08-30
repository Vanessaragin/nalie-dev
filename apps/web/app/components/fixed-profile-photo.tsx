'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { createClient } from '../../lib/supabase/client';

export const NALIE_PROFILE_PHOTO = '/vanessa-login.jpeg';

export default function FixedProfilePhoto({
  className,
}: {
  className?: string;
}) {
  const [src, setSrc] = useState(NALIE_PROFILE_PHOTO);

  useEffect(() => {
    try {
      void createClient({ detectSessionInUrl: false })
        .from('site_branding')
        .select('photo_url')
        .eq('id', 'nalie-main')
        .single()
        .then(({ data }) => {
          if (data?.photo_url) setSrc(data.photo_url);
        });
    } catch {
      // Mantém a foto empacotada quando o Supabase não está disponível.
    }
  }, []);

  return (
    <span className={className} aria-label="Foto oficial de Vanessa Rodrigues">
      <Image
        src={src}
        alt="Vanessa Rodrigues"
        width={160}
        height={160}
        sizes="160px"
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        priority
      />
    </span>
  );
}
