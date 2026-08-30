import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AnalysisWorkspacePage from './page';

describe('AnalysisWorkspacePage notifications', () => {
  it('does not invent notifications when the database has no records', async () => {
    render(<AnalysisWorkspacePage />);
    const button = screen.getByRole('button', { name: 'Abrir notificações' });
    expect(button).not.toHaveTextContent('2');
    fireEvent.click(button);
    expect(
      await screen.findByText('Nenhuma notificação no momento.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Revisão mensal agendada'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Importação de junho recebida.'),
    ).not.toBeInTheDocument();
  });
});
