import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ServiceFinancePage from './page';

describe('ServiceFinancePage', () => {
  it('does not display a fallback PIX key that can diverge from the database', () => {
    render(<ServiceFinancePage />);
    expect(screen.getByText('Carregando…')).toBeInTheDocument();
    expect(screen.queryByText('financeiro@nalie.com')).not.toBeInTheDocument();
    expect(screen.getAllByText('Sem cobrança cadastrada')).toHaveLength(2);
    expect(screen.getByText('Nenhum pagamento registrado')).toBeInTheDocument();
    expect(
      screen.queryByText('Último pagamento em 10/06/2025'),
    ).not.toBeInTheDocument();
  });
});
