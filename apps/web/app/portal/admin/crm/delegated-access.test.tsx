import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DelegatedAccess from './delegated-access';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../../../lib/supabase/client', () => ({
  createClient: () => ({ rpc }),
}));
const configuration = {
  users: [{ id: 'delegate', name: 'Analista', email: 'analista@example.com' }],
  memberships: [
    {
      id: 'self',
      profileId: 'delegate',
      name: 'Analista',
      email: 'analista@example.com',
    },
    {
      id: 'client-user',
      profileId: 'client',
      name: 'Cliente',
      email: 'cliente@example.com',
    },
  ],
  grants: [],
};
describe('Client delegation editor', () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: configuration, error: null });
  });
  it('saves only the selected capabilities and target accounts, never self', async () => {
    render(<DelegatedAccess companyId="company" />);
    await screen.findByRole('option', {
      name: 'Analista · analista@example.com',
    });
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'delegate' },
    });
    fireEvent.click(screen.getByLabelText('Consultar contatos / CRM'));
    fireEvent.click(screen.getByLabelText('Solicitar redefinição de senha'));
    expect(
      screen.queryByRole('checkbox', {
        name: 'Analista · analista@example.com',
      }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Cliente · cliente@example.com' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Salvar autorizações' }),
    );
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('set_delegated_client_access', {
        target_company: 'company',
        target_delegate: 'delegate',
        capabilities: ['crm', 'password_reset'],
        reset_memberships: ['client-user'],
      }),
    );
  });
  it('does not claim success when the server rejects a grant', async () => {
    render(<DelegatedAccess companyId="company" />);
    await screen.findByRole('option', {
      name: 'Analista · analista@example.com',
    });
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'delegate' },
    });
    rpc.mockResolvedValueOnce({ error: { message: 'Forbidden' } });
    fireEvent.click(
      screen.getByRole('button', { name: 'Salvar autorizações' }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Não foi possível salvar',
    );
  });
});
