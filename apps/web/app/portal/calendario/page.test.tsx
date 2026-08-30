import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CalendarPage from './page';

describe('CalendarPage', () => {
  it('starts without demonstrative appointments', () => {
    render(<CalendarPage />);
    expect(
      screen.getByRole('heading', { name: 'Calendário' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Nenhum compromisso corresponde ao cliente, prioridade e dia/),
    ).toBeInTheDocument();
    expect(screen.queryByText('Revisão financeira')).not.toBeInTheDocument();
  });
});
