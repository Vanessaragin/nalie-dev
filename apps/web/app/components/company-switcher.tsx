'use client';

import { useEffect, useState } from 'react';
import { createClient } from '../../lib/supabase/client';
import styles from './company-switcher.module.css';

export const SELECTED_COMPANY_KEY = 'nalie:selected-company-id';
export const SELECTED_COMPANY_EVENT = 'nalie-selected-company';

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

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient({ detectSessionInUrl: false });
        const { data, error } = await supabase
          .from('companies')
          .select('id,display_name,legal_document')
          .eq('status', 'ACTIVE')
          .order('display_name');
        if (error) throw error;
        const loaded = await Promise.all(
          (data ?? []).map(async (company) => {
            const { data: count } = await supabase.rpc(
              'active_company_user_count',
              { target_company_id: company.id },
            );
            return { ...company, active_users: Number(count ?? 0) };
          }),
        );
        setCompanies(loaded);
        const stored = window.localStorage.getItem(SELECTED_COMPANY_KEY);
        const next = loaded.some((company) => company.id === stored)
          ? String(stored)
          : (loaded[0]?.id ?? '');
        setSelectedId(next);
        if (next) {
          window.localStorage.setItem(SELECTED_COMPANY_KEY, next);
          window.dispatchEvent(
            new CustomEvent(SELECTED_COMPANY_EVENT, {
              detail: { companyId: next },
            }),
          );
        }
      } catch {
        setCompanies([]);
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
      <button
        className={className}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <div className={styles.companyIdentity}>
          <b>{selected?.display_name ?? 'Selecione uma empresa'}</b>
          <small>
            {selected
              ? `${selected.active_users} usuário${selected.active_users === 1 ? '' : 's'} ativo${selected.active_users === 1 ? '' : 's'}`
              : 'Nenhuma empresa disponível'}
          </small>
        </div>
        <span>{open ? '⌃' : '⌄'}</span>
      </button>
      {open && (
        <div role="dialog" aria-label="Empresa selecionada" className={styles.selector}>
          {companies.length === 0 ? (
            <small>Nenhuma empresa vinculada a este usuário.</small>
          ) : (
            companies.map((company) => (
              <button type="button" key={company.id} onClick={() => selectCompany(company.id)}>
                <b>{company.display_name}</b>
                <small>{company.legal_document || 'Documento não informado'}</small>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
