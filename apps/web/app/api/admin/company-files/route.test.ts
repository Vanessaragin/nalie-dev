// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, adminFrom } = vi.hoisted(() => ({
  rpc: vi.fn(),
  adminFrom: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => [] }),
}));
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getClaims: async () => ({ data: { claims: { sub: 'user-1' } } }),
    },
    rpc,
  }),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: adminFrom }),
}));

import { GET, POST } from './route';

const companyId = '00000000-0000-4000-8000-000000000001';

function mockMember(permissions: string[]) {
  rpc.mockImplementation(
    async (name: string, args?: Record<string, string>) => {
      if (name === 'is_super_admin') return { data: false };
      if (name === 'current_company_id') return { data: companyId };
      if (name === 'has_company_permission')
        return { data: permissions.includes(args?.permission_code ?? '') };
      return { data: null };
    },
  );
}

describe('company files authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://synthetic.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'synthetic-public');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-service');
  });

  it('does not list documents without documents.read', async () => {
    mockMember([]);
    const response = await GET(new Request('https://nalie.test/files'));
    expect(response.status).toBe(403);
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it('does not upload documents without documents.write', async () => {
    mockMember(['documents.read']);
    const form = new FormData();
    form.set('file', new File(['data'], 'data.csv', { type: 'text/csv' }));
    const response = await POST(
      new Request('https://nalie.test/files', { method: 'POST', body: form }),
    );
    expect(response.status).toBe(403);
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it('checks the requested permission for the member company', async () => {
    mockMember(['documents.read']);
    adminFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({ eq: async () => ({ data: [], error: null }) }),
        }),
      }),
    });
    const response = await GET(new Request('https://nalie.test/files'));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('has_company_permission', {
      target_company_id: companyId,
      permission_code: 'documents.read',
    });
  });
});
