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
  // Começa sem privilégios para nunca exibir controles privados durante a
  // identificação do usuário no navegador.
  const [permissions, setPermissions] = useState<readonly string[]>([]);
  useEffect(() => {
    let active = true;
    const update = async () => {
      try {
        const supabase = createClient({ detectSessionInUrl: false });
        const { data: superAdmin, error: superAdminError } =
          await supabase.rpc('is_super_admin');
        if (superAdminError) throw superAdminError;
        if (superAdmin) return active && setPermissions(all);
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) return active && setPermissions([]);
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
          return (
            active && setPermissions(all.filter((item) => item !== 'super'))
          );
        if (
          memberships.some(
            (membership) => membership.access_level === 'LIMITED',
          )
        )
          return active && setPermissions(limitedPagePermissions);
        if (active) setPermissions([]);
      } catch {
        if (active) setPermissions([]);
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
