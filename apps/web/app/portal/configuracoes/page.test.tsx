import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SettingsPage from './page';
describe('SettingsPage', () => {
  it('explains the persisted access levels', () => {
    render(<SettingsPage />);
    expect(screen.getByText(/Limitado/)).toBeInTheDocument();
    expect(screen.getByText(/somente Análise, Calendário/)).toBeInTheDocument();
  });
  it('does not show demonstration users when no company is loaded', () => {
    render(<SettingsPage />);
    expect(screen.queryByText('Lucas Costa')).not.toBeInTheDocument();
    expect(
      screen.getByText(/preserva todo o histórico/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /excluir/i }),
    ).not.toBeInTheDocument();
  });
});
