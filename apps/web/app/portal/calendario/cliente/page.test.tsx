import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ClientCalendarPage from './page';

describe('ClientCalendarPage', () => {
  it('starts without demonstrative company events or chat', () => {
    render(<ClientCalendarPage />);
    expect(
      screen.queryByText('Vencimento do pacote Gestão'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Chat privado com Vanessa'),
    ).not.toBeInTheDocument();
  });

  it('does not pretend an appointment was saved when the database rejects it', async () => {
    render(<ClientCalendarPage />);
    fireEvent.click(
      screen.getByRole('button', { name: '＋ Adicionar compromisso' }),
    );
    fireEvent.change(screen.getByLabelText('Título'), {
      target: { value: 'Enviar documentos' },
    });
    fireEvent.change(screen.getByLabelText('Data'), {
      target: { value: '2025-06-26' },
    });
    fireEvent.change(screen.getByLabelText('Horário'), {
      target: { value: '16:30' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar compromisso' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Compromisso não salvo',
      ),
    );
    expect(
      screen.queryByText(/Próximo lembrete · dia 26/),
    ).not.toBeInTheDocument();
  });
});
