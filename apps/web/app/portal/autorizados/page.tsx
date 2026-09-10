'use client';

import { useEffect, useState } from 'react';
import PortalNavigation from '../portal-navigation';
import { createClient } from '../../../lib/supabase/client';
import { delegatedCapabilities } from '../admin/crm/delegated-access';
import shell from '../styles.module.css';
import styles from '../admin/crm/styles.module.css';

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
      .rpc('read_delegated_client', { target_company: company, capability })
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
        <h2>Nalie</h2>
        <PortalNavigation />
      </aside>
      <section className={shell.content}>
        <h1>Administração Geral</h1>
        <p>
          Clientes e funções autorizados pela ADM Master. As consultas e
          solicitações são registradas na auditoria.
        </p>
        <label>
          Cliente autorizado{' '}
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
            <option value="">Selecione um cliente</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        {clients.length === 0 && <p>Nenhum cliente autorizado disponível.</p>}
        <nav className={styles.tabs} aria-label="Funções autorizadas">
          {delegatedCapabilities
            .filter(([key]) => selected?.permissions.includes(key))
            .map(([key, label]) => (
              <button
                key={key}
                className={capability === key ? styles.activeTab : ''}
                onClick={() => selectCapability(key)}
              >
                {label}
              </button>
            ))}
        </nav>
        {loading && <p role="status">Carregando…</p>}
        {capability && !loading && rows.length === 0 && !notice && (
          <p>Nenhum registro disponível.</p>
        )}
        {rows.map((row, index) => (
          <article className={styles.summary} key={String(row.id ?? index)}>
            {capability === 'analysis' ? (
              <>
                <h2>{row.title}</h2>
                {typeof row.url === 'string' &&
                  row.url.startsWith('https://') && (
                    <iframe
                      src={row.url}
                      title={String(row.title)}
                      style={{ width: '100%', minHeight: 520, border: 0 }}
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
                  <button
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
