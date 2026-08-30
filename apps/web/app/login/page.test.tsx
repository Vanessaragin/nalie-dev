import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LoginPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe('LoginPage', () => {
  afterEach(() => window.history.replaceState({}, '', '/login'));

  it('explains when portal access is blocked', async () => {
    window.history.replaceState({}, '', '/login?reason=blocked');
    render(<LoginPage />);
    expect(
      await screen.findByText(
        'Este acesso está bloqueado. Procure a administradora responsável pela sua empresa.',
      ),
    ).toBeInTheDocument();
  });
});
