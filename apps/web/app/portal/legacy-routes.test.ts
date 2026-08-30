import { beforeEach, describe, expect, it, vi } from 'vitest';
import LegacySalesPage from './vendas/page';
import LegacyDocumentsPage from './documentos/page';
import LegacyFinancePage from './financeiro/page';

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock('next/navigation', () => ({ redirect }));

describe('legacy portal routes', () => {
  beforeEach(() => redirect.mockClear());

  it('sends retired operational pages to the current analysis area', () => {
    LegacySalesPage();
    expect(redirect).toHaveBeenCalledWith('/portal/analises?tab=conteudos');
  });

  it('sends the old document area to stored reports', () => {
    LegacyDocumentsPage();
    expect(redirect).toHaveBeenCalledWith('/portal/relatorios');
  });

  it('sends the old finance dashboard to service billing', () => {
    LegacyFinancePage();
    expect(redirect).toHaveBeenCalledWith('/portal/financeiro/servicos');
  });
});
