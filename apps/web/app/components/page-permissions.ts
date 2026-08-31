'use client';

import { useEffect, useState } from 'react';
import { createClient } from '../../lib/supabase/client';

export const pagePermissionOptions = [
  ['analysis:bi', 'Análise · BI e apresentações'],
  ['finance', 'Financeiro · pagamentos do serviço'],
  ['analysis:reports', 'Relatórios · importação e exportação'],
  ['calendar', 'Calendário'],
  ['about', 'Mais informações · Sobre a Nalie'],
  ['policies', 'Mais informações · Regras e privacidade'],
] as const;

export const subpagePermissionGroups = [] as const;

export const subpagePermissionKeys: readonly string[] = [];

export const limitedPagePermissions = [
  'analysis:bi',
  'calendar',
  'about',
  'policies',
] as const;

const all = [
  ...pagePermissionOptions.map(([key]) => key),
  ...subpagePermissionKeys,
  'super',
];

let cachedPermissions: readonly string[] | null = null;

export function clearCurrentPagePermissions() {
  cachedPermissions = null;
}

export function saveCreatedUserPermissions(
  _role: string,
  _permissions: string[],
) {
  // Compatibilidade temporária com o formulário administrativo. A autorização
  // efetiva sempre vem de company_users no Supabase, nunca do navegador.
  void _role;
  void _permissions;
  window.dispatchEvent(new CustomEvent('nalie-page-permissions'));
}

export function useCurrentPagePermissions() {
  // Conserva o último resultado durante a navegação interna. Cada página ainda
  // confirma as permissões no Supabase, mas o menu não desaparece enquanto a
  // nova consulta é concluída.
  const [permissions, setPermissions] = useState<readonly string[]>(
    () => cachedPermissions ?? [],
  );
  useEffect(() => {
    let active = true;
    const apply = (next: readonly string[]) => {
      cachedPermissions = next;
      if (active) setPermissions(next);
    };
    const update = async () => {
      try {
        const supabase = createClient({ detectSessionInUrl: false });
        const { data: superAdmin, error: superAdminError } =
          await supabase.rpc('is_super_admin');
        if (superAdminError) throw superAdminError;
        if (superAdmin) return apply(all);
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) return apply([]);
        const { data, error } = await supabase
          .from('company_users')
          .select('access_level,status')
          .eq('profile_id', authData.user.id)
          .not('company_id', 'is', null)
          .eq('status', 'ACTIVE');
        if (error) throw error;
        const memberships = data ?? [];
        if (
          memberships.some(
            (membership) => membership.access_level === 'COMPLETE',
          )
        )
          return apply(all.filter((item) => item !== 'super'));
        if (
          memberships.some(
            (membership) => membership.access_level === 'LIMITED',
          )
        )
          return apply(limitedPagePermissions);
        apply([]);
      } catch {
        // Em uma troca de página, uma falha transitória não deve apagar um menu
        // que já foi autorizado nesta mesma sessão.
        if (active && cachedPermissions === null) setPermissions([]);
      }
    };
    void update();
    const refresh = () => void update();
    window.addEventListener('nalie-page-permissions', refresh);
    return () => {
      active = false;
      window.removeEventListener('nalie-page-permissions', refresh);
    };
  }, []);
  return permissions;
}
