'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useCurrentPagePermissions } from '../components/page-permissions';
import { createClient } from '../../lib/supabase/client';
import styles from './portal-navigation.module.css';
import shell from './styles.module.css';

type NavigationItem = {
  icon: string;
  label: string;
  href: string;
  permission?: string;
  tab?: string;
};

const primaryLinks: NavigationItem[] = [
  {
    icon: '📈',
    label: 'Análise',
    href: '/portal/analises?tab=conteudos',
    permission: 'analysis:bi',
    tab: 'conteudos',
  },
  {
    icon: '💰',
    label: 'Financeiro',
    href: '/portal/financeiro/servicos',
    permission: 'finance',
  },
  {
    icon: '📄',
    label: 'Relatórios',
    href: '/portal/relatorios',
    permission: 'analysis:reports',
  },
  {
    icon: '📅',
    label: 'Calendário',
    href: '/portal/calendario',
    permission: 'calendar',
  },
];

const moreLinks: NavigationItem[] = [
  {
    icon: '👤',
    label: 'Sobre a Nalie',
    href: '/portal/sobre-mim',
    permission: 'about',
  },
  {
    icon: '📜',
    label: 'Regras, privacidade e dados',
    href: '/portal/politicas',
    permission: 'policies',
  },
];

const adminLinks: NavigationItem[] = [
  { icon: '👑', label: 'Painel administrativo', href: '/portal/admin' },
  { icon: '🤝', label: 'Contatos / Clientes CRM', href: '/portal/admin/crm' },
  { icon: '💳', label: 'Pagamentos dos serviços', href: '/portal/pagamentos' },
];

function isRouteActive(pathname: string, item: NavigationItem) {
  const route = item.href.split('?')[0];
  if (route === '/portal') return pathname === route;
  if (route === '/portal/admin') return pathname === route;
  return pathname.startsWith(route);
}

export default function PortalNavigation({
  activeAnalysisTab,
  onAnalysisTabChange,
}: {
  activeAnalysisTab?: string;
  onAnalysisTabChange?: (tab: string) => void;
} = {}) {
  const pathname = usePathname() ?? '/portal';
  const [signingOut, setSigningOut] = useState(false);
  const permissions = useCurrentPagePermissions();
  const isSuper = permissions.includes('super');
  const moreOpen = moreLinks.some((item) => isRouteActive(pathname, item));
  const adminOpen =
    isSuper && adminLinks.some((item) => isRouteActive(pathname, item));

  const renderLink = (item: NavigationItem, submenu = false) => {
    if (item.permission && !isSuper && !permissions.includes(item.permission))
      return null;
    const href =
      item.permission === 'calendar' && !isSuper
        ? '/portal/calendario/cliente'
        : item.href;
    const active = item.tab
      ? pathname === '/portal/analises' && activeAnalysisTab === item.tab
      : isRouteActive(pathname, item);
    return (
      <Link
        className={
          submenu
            ? active
              ? styles.subActive
              : ''
            : active
              ? shell.active
              : ''
        }
        href={href}
        key={href}
        onClick={(event) => {
          if (
            item.tab &&
            onAnalysisTabChange &&
            pathname === '/portal/analises'
          ) {
            event.preventDefault();
            window.history.replaceState(null, '', href);
            onAnalysisTabChange(item.tab);
          }
        }}
      >
        <i>{item.icon}</i>
        <span>{item.label}</span>
      </Link>
    );
  };

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      // Atribuição completa também encerra qualquer estado autenticado mantido
      // pela árvore do App Router antes de exibir novamente o login.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/login');
    }
  }

  return (
    <nav aria-label="Menu principal">
      {primaryLinks.map((item) => renderLink(item))}

      <div className={styles.group}>
        <Link className={moreOpen ? shell.active : ''} href="/portal/sobre-mim">
          <i>•••</i>
          <span>Mais informações</span>
          <em>{moreOpen ? '⌃' : '⌄'}</em>
        </Link>
        {moreOpen && (
          <div className={styles.submenu}>
            {moreLinks.map((item) => renderLink(item, true))}
          </div>
        )}
      </div>

      {isSuper && (
        <div className={styles.group}>
          <span className={styles.privateLabel}>MINHA ÁREA PRIVADA</span>
          <Link className={adminOpen ? shell.active : ''} href="/portal/admin">
            <i>👑</i>
            <span>Administração</span>
            <em>{adminOpen ? '⌃' : '⌄'}</em>
          </Link>
          {adminOpen && (
            <div className={styles.submenu}>
              {adminLinks.map((item) => renderLink(item, true))}
            </div>
          )}
        </div>
      )}

      <button
        className={styles.signOut}
        disabled={signingOut}
        onClick={() => void signOut()}
        type="button"
      >
        <i>↪</i>
        <span>{signingOut ? 'Saindo…' : 'Sair'}</span>
      </button>
    </nav>
  );
}
