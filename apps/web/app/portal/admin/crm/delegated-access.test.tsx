import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DelegatedAccess from './delegated-access';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../../../lib/supabase/client', () => ({
  createClient: () => ({ rpc }),
}));
const accounts = [{ id: 'camila', email: 'camila@example.com' }];
const config = {
  users: [
    {
      id: 'self',
      profileId: 'camila',
      name: 'Camila',
      email: 'camila@example.com',
      company: 'Camila',
      master: false,
    },
    {
      id: 'one',
      profileId: 'one-user',
      name: 'Cliente Um',
      email: 'one@example.com',
      company: 'Empresa',
      master: false,
    },
    {
      id: 'two',
      profileId: 'two-user',
      name: 'Cliente Dois',
      email: 'two@example.com',
      company: 'Empresa',
      master: false,
    },
    {
      id: 'master',
      profileId: 'owner',
      name: 'Vanessa',
      email: 'naliedados@gmail.com',
      company: 'Plataforma',
      master: true,
    },
  ],
  grants: [],
};
describe('Simple administrator outgoing access', () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: config, error: null });
  });
  it('saves several selected targets for Camila rather than making them administrators of Camila', async () => {
    render(<DelegatedAccess name="Camila Lima" accounts={accounts} />);
    await screen.findByText('Cliente Um');
    fireEvent.click(screen.getByText('Selecionar usuários · 0 selecionado(s)'));
    fireEvent.click(screen.getByRole('checkbox', { name: /Cliente Um/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Cliente Dois/ }));
    expect(screen.getByRole('checkbox', { name: /Vanessa/ })).toBeDisabled();
    expect(
      screen.getByRole('checkbox', { name: /Camila.*Próprio login/ }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Salvar acessos do ADM simples' }),
    );
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('set_simple_admin_access', {
        target_delegate: 'camila',
        selections: [
          { membershipId: 'one', permissions: ['analysis'] },
          { membershipId: 'two', permissions: ['analysis'] },
        ],
      }),
    );
  });
  it('does not claim success on a rejected write', async () => {
    render(<DelegatedAccess name="Camila" accounts={accounts} />);
    await screen.findByText('Cliente Um');
    rpc.mockResolvedValueOnce({ error: { code: '42501' } });
    fireEvent.click(
      screen.getByRole('button', { name: 'Salvar acessos do ADM simples' }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Não foi possível salvar',
    );
  });
  it('requires an explicit login when the client has two accounts', () => {
    render(
      <DelegatedAccess
        name="Empresa"
        accounts={[...accounts, { id: 'second', email: 'second@example.com' }]}
      />,
    );
    expect(screen.getByRole('combobox')).toHaveValue('');
    expect(rpc).not.toHaveBeenCalled();
  });
});
