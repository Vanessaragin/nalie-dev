import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ReportsPage from './page';

describe('ReportsPage', () => {
  it('does not invent imported files and explains storage behavior', () => {
    render(<ReportsPage />);
    expect(
      screen.getByText(
        /somente armazenados, sem leitura, tratamento ou conversão/i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('extrato-julho.xlsx')).not.toBeInTheDocument();
  });
});
