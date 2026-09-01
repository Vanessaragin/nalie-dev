'use client';

import { useEffect, useState } from 'react';
import { createClient } from '../../lib/supabase/client';
import styles from './company-switcher.module.css';

export const SELECTED_COMPANY_KEY = 'nalie:selected-company-id';
export const SELECTED_COMPANY_EVENT = 'nalie-selected-company';
const ADMINISTRATOR_NAME_KEY = 'nalie:administrator-name';

type CompanyOption = {
  id: string;
  display_name: string;
  legal_document: string | null;
  active_users: number;
};

export default function CompanySwitcher({ className }: { className: string }) {
  const [open, setOpen] = useState(false);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [administratorName, setAdministratorName] = useState('');
  const [identityLoaded, setIdentityLoaded] = useState(false);

  useEffect(() => {
    const storage = window.localStorage;
    const cachedAdministratorName =
      typeof storage?.getItem === 'function'
        ? storage.getItem(ADMINISTRATOR_NAME_KEY)
        : null;
    if (cachedAdministratorName)
      queueMicrotask(() => setAdministratorName(cachedAdministratorName));
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
          if (typeof storage?.setItem === 'function')
            storage.setItem(SELECTED_COMPANY_KEY, next);
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
  function selectCompany(id: string) {
    setSelectedId(id);
    setOpen(false);
    window.localStorage.setItem(SELECTED_COMPANY_KEY, id);
    window.dispatchEvent(
      new CustomEvent(SELECTED_COMPANY_EVENT, { detail: { companyId: id } }),
    );
  }

  return (
    <div className={styles.accountCard}>
      {administratorName ? (
        <div className={className}>
          <div className={styles.companyIdentity}>
            <b>{administratorName}</b>
            <small>Administrador da plataforma</small>
          </div>
        </div>
      ) : !identityLoaded ? (
        <div className={className} aria-label="Carregando usuário atual">
          <div className={styles.companyIdentity}>
            <b>Carregando usuário...</b>
            <small>Identificando acesso</small>
          </div>
        </div>
      ) : (
        <button
          className={className}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <div className={styles.companyIdentity}>
            <b>{selected?.display_name || 'Selecione uma empresa'}</b>
            <small>
              {selected
                ? `${selected.active_users} usuário${selected.active_users === 1 ? '' : 's'} ativo${selected.active_users === 1 ? '' : 's'}`
                : 'Nenhuma empresa disponível'}
            </small>
          </div>
          <span>{open ? '⌃' : '⌄'}</span>
        </button>
      )}
      {!administratorName && open && (
        <div
          role="dialog"
          aria-label="Empresa selecionada"
          className={styles.selector}
        >
          {companies.length === 0 ? (
            <small>Nenhuma empresa vinculada a este usuário.</small>
          ) : (
            companies.map((company) => (
              <button
                type="button"
                key={company.id}
                onClick={() => selectCompany(company.id)}
              >
                <b>{company.display_name}</b>
                <small>
                  {company.legal_document || 'Documento não informado'}
                </small>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
