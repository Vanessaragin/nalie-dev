import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PaymentsPage from './page';

describe('PaymentsPage', () => {
  it('shows billing rules without inventing client charges', () => {
    render(<PaymentsPage />);
    expect(
      screen.getByText('Automação ao criar uma empresa'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Vencimento não apaga o acesso ao histórico'),
    ).toBeInTheDocument();
    expect(screen.getByText('Nenhuma cobrança encontrada neste cliente e período.')).toBeInTheDocument();
    expect(screen.getAllByText('R$ 0,00')).toHaveLength(4);
  });
});
