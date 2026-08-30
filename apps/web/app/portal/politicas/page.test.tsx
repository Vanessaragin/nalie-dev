import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PoliciesPage from './page';

describe('PoliciesPage', () => {
  it('keeps history accessible without duplicating the report export', () => {
    render(<PoliciesPage />);
    expect(screen.getAllByText(/NALIE/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/NALOE/)).not.toBeInTheDocument();
    expect(
      screen.getByText(/continuará acessando o histórico/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Solicitar exportação completa' }),
    ).not.toBeInTheDocument();
  });
});
