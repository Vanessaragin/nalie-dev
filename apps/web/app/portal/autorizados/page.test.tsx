import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import Page from './page';
vi.mock('../portal-navigation', () => ({ default: () => null }));
vi.mock('../../components/menu-toggle', () => ({ default: () => null }));
vi.mock('../../components/company-switcher', () => ({ default: () => null }));
vi.mock('../../../lib/supabase/client', () => ({
  createClient: () => ({
    rpc: async (name: string) => ({
      data:
        name === 'list_delegated_clients'
          ? [
              {
                id: 'target',
                name: 'Cliente autorizado',
                permissions: ['password_reset'],
              },
            ]
          : [
              {
                id: 'target',
                name: 'Cliente autorizado',
                email: 'test@example.com',
              },
            ],
      error: null,
    }),
  }),
}));
afterEach(() => vi.unstubAllGlobals());
it('only sends password recovery after clicking the explicit send button', async () => {
  const send = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', send);
  render(<Page />);
  await screen.findByRole('option', { name: 'Cliente autorizado' });
  fireEvent.change(screen.getByRole('combobox'), {
    target: { value: 'target' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Redefinição de senha' }));
  const button = await screen.findByRole('button', {
    name: 'Enviar redefinição por e-mail',
  });
  expect(send).not.toHaveBeenCalled();
  fireEvent.click(button);
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  expect(send).toHaveBeenCalledWith('/api/admin/password-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ membershipId: 'target' }),
  });
});
