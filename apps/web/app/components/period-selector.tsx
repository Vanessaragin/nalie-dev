'use client';

import styles from './period-selector.module.css';

type Props = {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
  ariaLabel?: string;
};

export default function PeriodSelector({
  value,
  onChange,
  compact,
  ariaLabel = 'Período',
}: Props) {
  return (
    <label className={`${styles.field} ${compact ? styles.compact : ''}`}>
      <span className="sr-only">{ariaLabel}</span>
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="2025-08">Agosto/2025</option>
        <option value="2025-07">Julho/2025</option>
        <option value="2025-06">Junho/2025</option>
        <option value="2025-05">Maio/2025</option>
        <option value="2025-04">Abril/2025</option>
        <option value="2025-03">Março/2025</option>
        <option value="2025-02">Fevereiro/2025</option>
        <option value="2025-01">Janeiro/2025</option>
      </select>
    </label>
  );
}
