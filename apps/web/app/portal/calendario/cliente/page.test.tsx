import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ClientCalendarPage from './page';

describe('ClientCalendarPage', () => {
  it('starts without demonstrative company events or chat', () => {
    render(<ClientCalendarPage />);
    expect(screen.queryByText('Vencimento do pacote Gestão')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Chat privado com Vanessa'),
    ).not.toBeInTheDocument();
  });

  it('adds an appointment to the calendar and reminder', () => {
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
    expect(screen.getAllByText('Enviar documentos')).toHaveLength(2);
    expect(screen.getByText(/Próximo lembrete · dia 26/)).toBeInTheDocument();
  });
});
