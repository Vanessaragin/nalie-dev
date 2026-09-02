'use client';

import { useEffect, useState } from 'react';
import { createClient } from '../../lib/supabase/client';
import styles from './company-switcher.module.css';

export const SELECTED_COMPANY_KEY = 'nalie:selected-company-id';
export const SELECTED_COMPANY_EVENT = 'nalie-selected-company';
const ADMINISTRATOR_NAME_KEY = 'nalie:administrator-name';
const ACCOUNT_COMPANY_KEY = 'nalie:account-company';

type CompanyOption = {
  id: string;
  display_name: string;
  legal_document: string | null;
  active_users: number;
};

function readStoredValue(key: string) {
  if (typeof window === 'undefined') return '';
  const storage = window.localStorage;
  return typeof storage?.getItem === 'function'
    ? (storage.getItem(key) ?? '')
    : '';
}

export default function CompanySwitcher({ className }: { className: string }) {
  const [companies, setCompanies] = useState<CompanyOption[]>(() => {
    try {
      const cached = readStoredValue(ACCOUNT_COMPANY_KEY);
      return cached ? [JSON.parse(cached) as CompanyOption] : [];
    } catch {
      return [];
    }
  });
  const [selectedId, setSelectedId] = useState(() =>
    readStoredValue(SELECTED_COMPANY_KEY),
  );
  const [administratorName, setAdministratorName] = useState(() =>
    readStoredValue(ADMINISTRATOR_NAME_KEY),
  );
  const [identityLoaded, setIdentityLoaded] = useState(false);

  useEffect(() => {
    const storage = window.localStorage;
    async function load() {
      try {
        const supabase = createClient({ detectSessionInUrl: false });
        const [{ data: authData }, { data: isAdministrator }] =
          await Promise.all([
            supabase.auth.getUser(),
            supabase.rpc('is_super_admin'),
          ]);
        if (isAdministrator && authData.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', authData.user.id)
            .maybeSingle();
          const currentAdministratorName = String(
            profile?.display_name ||
              authData.user.user_metadata?.display_name ||
              authData.user.email?.split('@')[0] ||
              'Administrador',
          );
          setAdministratorName(currentAdministratorName);
          if (typeof storage?.setItem === 'function')
            storage.setItem(ADMINISTRATOR_NAME_KEY, currentAdministratorName);
        } else {
          setAdministratorName('');
          if (typeof storage?.removeItem === 'function')
            storage.removeItem(ADMINISTRATOR_NAME_KEY);
        }
        const { data, error } = await supabase
          .from('companies')
          .select('id,display_name,legal_document')
          .eq('status', 'ACTIVE')
          .order('display_name');
        if (error) throw error;
        const companyRows = data ?? [];
        const { data: crmRows, error: crmError } = companyRows.length
          ? await supabase
              .from('client_crm')
              .select('company_id,client_status')
              .in(
                'company_id',
                companyRows.map((company) => company.id),
              )
          : { data: [], error: null };
        if (crmError) throw crmError;
        const contractedCompanyIds = new Set(
          (crmRows ?? [])
            .filter((row) => row.client_status !== 'Não contratado')
            .map((row) => row.company_id),
        );
        const loaded = await Promise.all(
          companyRows
            .filter((company) => contractedCompanyIds.has(company.id))
            .map(async (company) => {
              const { data: count } = await supabase.rpc(
                'active_company_user_count',
                { target_company_id: company.id },
              );
              return { ...company, active_users: Number(count ?? 0) };
            }),
        );
        setCompanies(loaded);
        const stored =
          typeof storage?.getItem === 'function'
            ? storage.getItem(SELECTED_COMPANY_KEY)
            : null;
        const next = loaded.some((company) => company.id === stored)
          ? String(stored)
          : (loaded[0]?.id ?? '');
        setSelectedId(next);
        if (next) {
          const selectedCompany = loaded.find((company) => company.id === next);
          if (typeof storage?.setItem === 'function')
            storage.setItem(SELECTED_COMPANY_KEY, next);
          if (selectedCompany && typeof storage?.setItem === 'function')
            storage.setItem(
              ACCOUNT_COMPANY_KEY,
              JSON.stringify(selectedCompany),
            );
          window.dispatchEvent(
            new CustomEvent(SELECTED_COMPANY_EVENT, {
              detail: { companyId: next },
            }),
          );
        }
      } catch {
        setCompanies([]);
      } finally {
        setIdentityLoaded(true);
      }
    }
    void load();
  }, []);

  const selected = companies.find((company) => company.id === selectedId);

  return (
    <div className={styles.accountCard}>
      {administratorName ? (
        <div className={className}>
          <div className={styles.companyIdentity}>
            <b>{administratorName}</b>
            <small>Administrador da plataforma</small>
          </div>
        </div>
      ) : selected ? (
        <div className={className}>
          <div className={styles.companyIdentity}>
            <b>{selected.display_name}</b>
            <small>
              {`${selected.active_users} usuário${selected.active_users === 1 ? '' : 's'} ativo${selected.active_users === 1 ? '' : 's'}`}
            </small>
          </div>
        </div>
      ) : (
        <div
          className={`${className} ${styles.identityPlaceholder}`}
          aria-busy={!identityLoaded}
          aria-label={
            identityLoaded ? 'Nenhuma empresa vinculada' : 'Carregando acesso'
          }
        />
      )}
    </div>
  );
}
