import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ServiceFinancePage from './page';

describe('ServiceFinancePage', () => {
  it('does not leave PIX loading when the database has no configured key', async () => {
    render(<ServiceFinancePage />);
    expect(
      await screen.findByText('Chave PIX não cadastrada'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Carregando…')).not.toBeInTheDocument();
    expect(screen.queryByText('financeiro@nalie.com')).not.toBeInTheDocument();
    expect(screen.getAllByText('Sem cobrança cadastrada')).toHaveLength(2);
    expect(screen.getByText('Nenhum pagamento registrado')).toBeInTheDocument();
    expect(
      screen.queryByText('Último pagamento em 10/06/2025'),
    ).not.toBeInTheDocument();
  });
});
