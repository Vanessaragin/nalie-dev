'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import AccessLegend from '../../components/access-legend';
import CompanySwitcher, {
  SELECTED_COMPANY_EVENT,
  SELECTED_COMPANY_KEY,
} from '../../components/company-switcher';
import MenuToggle from '../../components/menu-toggle';
import { useCurrentPagePermissions } from '../../components/page-permissions';
import { createClient } from '../../../lib/supabase/client';
import shell from '../styles.module.css';
import PortalNavigation from '../portal-navigation';
import styles from './styles.module.css';

type Member = {
  id: string;
  name: string;
  role: string;
  status: string;
  access: 'COMPLETE' | 'LIMITED' | 'BLOCKED';
};

export default function SettingsPage() {
  const isOwner = useCurrentPagePermissions().includes('super');
  const [members, setMembers] = useState<Member[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');

  const loadMembers = useCallback(async (requestedCompanyId?: string) => {
    const selected =
      requestedCompanyId || window.localStorage.getItem(SELECTED_COMPANY_KEY) || '';
    setCompanyId(selected);
    if (!selected) {
      setMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient({ detectSessionInUrl: false });
      const { data, error } = await supabase
        .from('company_users')
        .select('id,status,access_level,profiles(display_name),roles(code)')
        .eq('company_id', selected)
        .order('created_at');
      if (error) throw error;
      setMembers(
        (data ?? []).map((row) => {
          const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
          const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
          return {
            id: row.id,
            name: profile?.display_name || 'Usuário sem nome',
            role:
              role?.code === 'COMPANY_ADMIN'
                ? 'Administrador da empresa'
                : 'Usuário adicional',
            status: row.status,
            access: row.access_level,
          } as Member;
        }),
      );
    } catch {
      setMembers([]);
      setFeedback('Não foi possível carregar os usuários desta empresa.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadMembers(), 250);
    const changed = (event: Event) => {
      const id = (event as CustomEvent<{ companyId: string }>).detail?.companyId;
      void loadMembers(id);
    };
    window.addEventListener(SELECTED_COMPANY_EVENT, changed);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(SELECTED_COMPANY_EVENT, changed);
    };
  }, [loadMembers]);

  async function changeAccess(member: Member, access: Member['access']) {
    const previous = member.access;
    setMembers((current) =>
      current.map((item) => (item.id === member.id ? { ...item, access } : item)),
    );
    try {
      const { error } = await createClient({ detectSessionInUrl: false }).rpc(
        'set_company_user_access_level',
        { target_membership_id: member.id, requested_level: access },
      );
      if (error) throw error;
      setFeedback(`✓ Acesso de ${member.name} atualizado no Supabase.`);
    } catch {
      setMembers((current) =>
        current.map((item) =>
          item.id === member.id ? { ...item, access: previous } : item,
        ),
      );
      setFeedback(`Não foi possível alterar o acesso de ${member.name}.`);
    }
  }

  async function toggleStatus(member: Member) {
    const makeActive = member.status !== 'ACTIVE';
    try {
      const { error } = await createClient({ detectSessionInUrl: false }).rpc(
        'set_second_user_active',
        { target_membership_id: member.id, make_active: makeActive },
      );
      if (error) throw error;
      setFeedback(
        `✓ ${member.name} foi ${makeActive ? 'reativado' : 'inativado'} sem apagar o histórico.`,
      );
      await loadMembers(companyId);
    } catch {
      setFeedback(`Não foi possível alterar o status de ${member.name}.`);
    }
  }

  const activeCount = members.filter((member) => member.status === 'ACTIVE').length;
  return (
    <main className={shell.portal}>
      <aside className={shell.sidebar}>
        <MenuToggle />
        <div className={shell.brand}><span>N</span><div><b>NALIE</b><small>BUSINESS INTELLIGENCE</small></div></div>
        <CompanySwitcher className={shell.company} />
        <PortalNavigation />
        <AccessLegend />
      </aside>
      <section className={`${shell.content} ${styles.content}`}>
        <header><div><h1>Empresa e usuários</h1><p>Gerencie os usuários reais da empresa selecionada.</p></div><div className={shell.filters}><Link className={shell.import} href="/portal/perfil">👤 Meu perfil</Link></div></header>
        <section className={styles.scope}><span>👥</span><div><b>Acesso ao portal</b><p><strong>Completo</strong> libera os módulos contratados. <strong>Limitado</strong> libera somente Análise, Calendário e Mais informações. <strong>Bloqueado</strong> impede o login no portal.</p><p>Somente a administradora geral pode mudar o nível de acesso.</p></div></section>
        <section className={styles.card}>
          <div className={styles.count}><span>Usuários ativos nesta empresa</span><strong>{activeCount}</strong><small>Usuários inativos não entram na contagem e seus dados permanecem preservados.</small></div>
          {loading ? <p>Carregando usuários…</p> : members.length === 0 ? <p>Nenhum usuário encontrado para a empresa selecionada.</p> : members.map((member) => (
            <div className={styles.user} key={member.id}>
              <span>{member.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span>
              <div><b>{member.name}</b><small>{member.role} · {member.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}</small></div>
              <label className={styles.accessSelect}>Acesso<select aria-label={`Acesso de ${member.name}`} value={member.access} disabled={!isOwner} onChange={(event) => void changeAccess(member, event.target.value as Member['access'])}><option value="COMPLETE">Completo</option><option value="LIMITED">Limitado</option><option value="BLOCKED">Bloqueado</option></select></label>
              {member.role === 'Usuário adicional' && <button className={member.status === 'ACTIVE' ? styles.deactivate : styles.activate} onClick={() => void toggleStatus(member)}>{member.status === 'ACTIVE' ? 'Inativar usuário' : 'Reativar usuário'}</button>}
              <em>{member.status === 'ACTIVE' ? 'ATIVO' : 'INATIVO'}</em>
            </div>
          ))}
          <div className={styles.actions}><p>Não existe opção de excluir. Inativar suspende o acesso e preserva todo o histórico.</p></div>
          {feedback && <div className={styles.saved} role="status">{feedback}</div>}
        </section>
      </section>
    </main>
  );
}
