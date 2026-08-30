import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AdminPage from './page';

describe('AdminPage', () => {
  it('shows real-data empty states and explains limited access precisely', () => {
    render(<AdminPage />);
    expect(
      screen.getByRole('heading', { name: 'Administração Geral' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Cadastrar ou alterar clientes/ }),
    ).toHaveAttribute('href', '/portal/admin/crm');
    expect(
      screen.getByText(/Acessa somente Análise, Calendário e Mais informações/),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Nenhuma atividade registrada ainda.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Marina Costa')).not.toBeInTheDocument();
    expect(screen.queryByText('127')).not.toBeInTheDocument();
    expect(screen.queryByText('46')).not.toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(4);
  });
});
