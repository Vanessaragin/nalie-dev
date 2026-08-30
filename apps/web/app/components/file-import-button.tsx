'use client';

import { useRef } from 'react';

type Props = {
  disabled?: boolean;
  label: string;
  accept?: string;
  className?: string;
  inputId?: string;
  onFile: (file: File) => void;
};

export default function FileImportButton({
  disabled,
  label,
  accept = '.csv,.xlsx,.xls,.ofx,.pdf',
  className,
  inputId,
  onFile,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        id={inputId}
        ref={input}
        type="file"
        accept={accept}
        hidden
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = '';
        }}
      />
      <button
        className={className}
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        {label}
      </button>
    </>
  );
}
