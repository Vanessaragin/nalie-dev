'use client';

import { useEffect, useState } from 'react';
import PortalNavigation from '../portal-navigation';
import { createClient } from '../../../lib/supabase/client';
import { delegatedCapabilities } from '../admin/crm/delegated-access';
import shell from '../styles.module.css';
import styles from './styles.module.css';
import MenuToggle from '../../components/menu-toggle';
import CompanySwitcher from '../../components/company-switcher';

type Client = { id: string; name: string; permissions: string[] };
type Row = Record<string, string | number | null>;
const labels: Record<string, string> = {
  name: 'Nome',
  email: 'E-mail',
  phone: 'Telefone',
  whatsapp: 'WhatsApp',
  contactStatus: 'Situação do contato',
  clientStatus: 'Situação do cliente',
  kind: 'Tipo',
  title: 'Descrição',
  occurred_at: 'Data e horário',
  theme: 'Tema',
  starts_at: 'Início',
  ends_at: 'Fim',
};

export default function AuthorizedClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [company, setCompany] = useState('');
  const [capability, setCapability] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  useEffect(() => {
    let active = true;
    void createClient()
      .rpc('list_delegated_clients')
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setNotice('Não foi possível consultar suas autorizações.');
        else setClients(data ?? []);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    if (!company || !capability) return;
    void createClient()
      .rpc('read_simple_admin_user', { target_membership: company, capability })
      .then(({ data, error }) => {
        if (!active) return;
        setLoading(false);
        if (error) {
          setRows([]);
          setNotice('Acesso indisponível ou revogado. Consulte a ADM Master.');
        } else {
          setRows(data ?? []);
          setNotice('');
        }
      });
    return () => {
      active = false;
    };
  }, [company, capability]);
  function selectCapability(value: string) {
    if (value === capability) return;
    setRows([]);
    setNotice('');
    setLoading(true);
    setCapability(value);
  }
  async function resetPassword(id: string) {
    if (resetting) return;
    setResetting(true);
    try {
      const response = await fetch('/api/admin/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId: id }),
      });
      setNotice(
        response.ok
          ? 'E-mail de redefinição solicitado. A ação foi registrada na auditoria.'
          : 'Redefinição não concluída. Confira a autorização com a ADM Master.',
      );
    } catch {
      setNotice('Não foi possível conectar ao serviço de redefinição.');
    } finally {
      setResetting(false);
    }
  }
  const selected = clients.find((client) => client.id === company);
  return (
    <main className={shell.portal}>
      <aside className={shell.sidebar}>
        <MenuToggle />
        <div className={shell.brand}>
          <span>N</span>
          <div>
            <b>NALIE</b>
            <small>BUSINESS INTELLIGENCE</small>
          </div>
        </div>
        <CompanySwitcher className={shell.company} />
        <PortalNavigation />
      </aside>
      <section className={shell.content}>
        <header>
          <div>
            <span className={styles.eyebrow}>
              ASSESSORIA ORIENTADA POR DADOS
            </span>
            <h1>Administração Geral</h1>
            <p>
              Perfil ADM simples · usuários e funções autorizados pelo Super
              Master. As consultas e solicitações são registradas na auditoria.
            </p>
          </div>
        </header>
        <label className={styles.selector}>
          Empresa / usuário autorizado{' '}
          <select
            value={company}
            onChange={(event) => {
              setCompany(event.target.value);
              setCapability('');
              setRows([]);
              setNotice('');
              setLoading(false);
            }}
          >
            <option value="">Selecione um usuário</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        {clients.length === 0 && <p>Nenhum usuário autorizado disponível.</p>}
        <nav className={styles.tabs} aria-label="Funções autorizadas">
          {delegatedCapabilities
            .filter(([key]) => selected?.permissions.includes(key))
            .map(([key, label]) => (
              <button
                key={key}
                className={capability === key ? styles.activeTab : ''}
                onClick={() => selectCapability(key)}
              >
                {key === 'password_reset' ? 'Redefinição de senha' : label}
              </button>
            ))}
        </nav>
        {loading && <p role="status">Carregando…</p>}
        {capability && !loading && rows.length === 0 && !notice && (
          <p className={styles.empty}>
            {capability === 'calendar'
              ? 'Nenhum compromisso compartilhado disponível para este usuário.'
              : 'Nenhum registro disponível.'}
          </p>
        )}
        {capability === 'calendar' && !loading && (
          <SharedCalendar rows={rows} />
        )}
        {(capability === 'calendar' ? [] : rows).map((row, index) => (
          <article className={styles.card} key={String(row.id ?? index)}>
            {capability === 'analysis' ? (
              <>
                <div className={styles.cardHeader}>
                  <h2>{row.title}</h2>
                  {typeof row.url === 'string' &&
                    row.url.startsWith('https://') && (
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Abrir em nova aba ↗
                      </a>
                    )}
                </div>
                {typeof row.url === 'string' &&
                  row.url.startsWith('https://') && (
                    <iframe
                      src={embedUrl(row.url)}
                      title={String(row.title)}
                      className={styles.embed}
                      allowFullScreen
                    />
                  )}
              </>
            ) : (
              <>
                {Object.entries(row)
                  .filter(([key]) => key !== 'id')
                  .map(([key, value]) => (
                    <p key={key}>
                      <strong>{labels[key] ?? key}:</strong> {value ?? '—'}
                    </p>
                  ))}
                {capability === 'password_reset' && (
                  <p>
                    Abrir esta consulta não altera a senha e não envia e-mail. O
                    envio só ocorre ao clicar no botão abaixo.
                  </p>
                )}
                {capability === 'password_reset' && (
                  <button
                    className={styles.primary}
                    disabled={resetting}
                    onClick={() => void resetPassword(String(row.id))}
                  >
                    Enviar redefinição por e-mail
                  </button>
                )}
              </>
            )}
          </article>
        ))}
        {notice && <p role="status">{notice}</p>}
      </section>
    </main>
  );
}

function embedUrl(value: string) {
  const url = new URL(value);
  if (
    url.hostname === 'docs.google.com' &&
    url.pathname.includes('/presentation/d/e/') &&
    url.pathname.endsWith('/pub')
  )
    url.pathname = url.pathname.replace(/\/pub$/, '/embed');
  return url.toString();
}

function SharedCalendar({ rows }: { rows: Row[] }) {
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const events = rows.filter((row) => {
    const date = new Date(String(row.starts_at));
    return (
      date.getFullYear() === month.getFullYear() &&
      date.getMonth() === month.getMonth()
    );
  });
  function move(delta: number) {
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  }
  return (
    <section className={styles.card} aria-label="Calendário compartilhado">
      <div className={styles.cardHeader}>
        <h2>
          {month.toLocaleDateString('pt-BR', {
            month: 'long',
            year: 'numeric',
          })}
        </h2>
        <div className={styles.monthActions}>
          <button onClick={() => move(-1)} aria-label="Mês anterior">
            ←
          </button>
          <button
            onClick={() =>
              setMonth(
                new Date(new Date().getFullYear(), new Date().getMonth(), 1),
              )
            }
          >
            Hoje
          </button>
          <button onClick={() => move(1)} aria-label="Próximo mês">
            →
          </button>
        </div>
      </div>
      <div className={styles.calendarScroll}>
        <div className={styles.calendar}>
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
            <strong key={day}>{day}</strong>
          ))}
          {Array.from({ length: month.getDay() }, (_, i) => (
            <div key={'blank' + i} />
          ))}
          {Array.from({ length: days }, (_, i) => (
            <div className={styles.day} key={i}>
              <b>{i + 1}</b>
              {events
                .filter(
                  (row) => new Date(String(row.starts_at)).getDate() === i + 1,
                )
                .map((row) => (
                  <p key={String(row.id)}>
                    <time>
                      {new Date(String(row.starts_at)).toLocaleTimeString(
                        'pt-BR',
                        { hour: '2-digit', minute: '2-digit' },
                      )}
                    </time>{' '}
                    {row.title}
                  </p>
                ))}
            </div>
          ))}
        </div>
      </div>
      {events.length === 0 && (
        <p className={styles.empty}>
          Nenhum compromisso compartilhado neste mês. Use as setas para
          consultar outros meses.
        </p>
      )}
    </section>
  );
}
