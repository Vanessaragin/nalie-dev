import { redirect } from 'next/navigation';
import { describe, expect, it, vi } from 'vitest';
import PortalPage from './page';

vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

describe('PortalPage', () => {
  it('opens the client analysis as the portal start page', () => {
    PortalPage();
    expect(redirect).toHaveBeenCalledWith('/portal/analises?tab=conteudos');
  });
});
