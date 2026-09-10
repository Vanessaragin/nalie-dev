'use client';

import { useEffect, useState } from 'react';
import { createClient } from '../../../../lib/supabase/client';
import styles from './styles.module.css';

export const delegatedCapabilities = [
  ['analysis', 'Visualizar análises'],
  ['crm', 'Consultar contatos / CRM'],
  ['activity', 'Consultar atividade do cliente'],
  ['calendar', 'Consultar calendário compartilhado'],
  ['password_reset', 'Solicitar redefinição de senha'],
] as const;

type Grant = {
  delegate_id: string;
  permissions: string[];
  reset_membership_ids: string[];
};
type Configuration = {
  users: Array<{ id: string; name: string; email: string }>;
  memberships: Array<{
    id: string;
    profileId: string;
    name: string;
    email: string;
  }>;
  grants: Grant[];
};

export default function DelegatedAccess({ companyId }: { companyId?: string }) {
  const [config, setConfig] = useState<Configuration | null>(null);
  const [delegate, setDelegate] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [memberships, setMemberships] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    if (!companyId) return;
    void createClient()
      .rpc('delegated_access_configuration', { target_company: companyId })
      .then(({ data, error }) => {
        if (!active) return;
        if (error)
          setNotice('Não foi possível carregar os acessos autorizados.');
        else setConfig(data as Configuration);
      });
    return () => {
      active = false;
    };
  }, [companyId]);

  function choose(id: string) {
    const grant = config?.grants.find((item) => item.delegate_id === id);
    setDelegate(id);
    setPermissions(grant?.permissions ?? []);
    setMemberships(grant?.reset_membership_ids ?? []);
    setNotice('');
  }
  async function save(revoke = false) {
    if (!companyId || !delegate || busy) return;
    setBusy(true);
    const nextPermissions = revoke ? [] : permissions;
    const nextMemberships = nextPermissions.includes('password_reset')
      ? memberships
      : [];
    const { error } = await createClient().rpc('set_delegated_client_access', {
      target_company: companyId,
      target_delegate: delegate,
      capabilities: nextPermissions,
      reset_memberships: nextMemberships,
    });
    if (error)
      setNotice(
        'Não foi possível salvar. Verifique se os usuários continuam ativos.',
      );
    else {
      setConfig(
        (current) =>
          current && {
            ...current,
            grants: [
              ...current.grants.filter((item) => item.delegate_id !== delegate),
              ...(nextPermissions.length
                ? [
                    {
                      delegate_id: delegate,
                      permissions: nextPermissions,
                      reset_membership_ids: nextMemberships,
                    },
                  ]
                : []),
            ],
          },
      );
      setPermissions(nextPermissions);
      setMemberships(nextMemberships);
      setNotice(
        revoke
          ? 'Acesso a este cliente revogado.'
          : 'Autorizações salvas e registradas na auditoria.',
      );
    }
    setBusy(false);
  }
  return (
    <section className={styles.summary}>
      <h2>Acessos autorizados</h2>
      <p>
        Escolha quem pode acompanhar este cliente. Somente ADM Master altera
        estas autorizações. As demais páginas continuam usando o cadastro
        próprio do usuário.
      </p>
      <label>
        Usuário autorizado{' '}
        <select
          value={delegate}
          disabled={!config || busy}
          onChange={(event) => choose(event.target.value)}
        >
          <option value="">Selecione um usuário cadastrado</option>
          {config?.users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} · {user.email}
            </option>
          ))}
        </select>
      </label>
      {delegate && (
        <>
          <fieldset disabled={busy}>
            <legend>Permissões para este cliente</legend>
            {delegatedCapabilities.map(([key, label]) => (
              <label key={key} style={{ display: 'block', padding: '8px 0' }}>
                <input
                  type="checkbox"
                  checked={permissions.includes(key)}
                  onChange={(event) =>
                    setPermissions((current) =>
                      event.target.checked
                        ? [...current, key]
                        : current.filter((item) => item !== key),
                    )
                  }
                />{' '}
                {label}
              </label>
            ))}
          </fieldset>
          {permissions.includes('password_reset') && (
            <fieldset disabled={busy}>
              <legend>De quais usuários pode solicitar redefinição?</legend>
              {config?.memberships
                .filter((user) => user.profileId !== delegate)
                .map((user) => (
                  <label
                    key={user.id}
                    style={{ display: 'block', padding: '8px 0' }}
                  >
                    <input
                      type="checkbox"
                      checked={memberships.includes(user.id)}
                      onChange={(event) =>
                        setMemberships((current) =>
                          event.target.checked
                            ? [...current, user.id]
                            : current.filter((id) => id !== user.id),
                        )
                      }
                    />{' '}
                    {user.name} · {user.email}
                  </label>
                ))}
              <p>A própria conta e os ADM Master não podem ser selecionados.</p>
            </fieldset>
          )}
          <p>
            O calendário autorizado mostra apenas eventos compartilhados da
            empresa. Eventos pessoais permanecem privados.
          </p>
          <div className={styles.quickLinks}>
            <button disabled={busy} onClick={() => void save()}>
              Salvar autorizações
            </button>
            <button disabled={busy} onClick={() => void save(true)}>
              Revogar acesso a este cliente
            </button>
          </div>
        </>
      )}
      <h3>Quem já tem acesso</h3>
      {config?.grants.length === 0 && (
        <p>Nenhum acesso adicional autorizado.</p>
      )}
      {config?.grants.map((grant) => (
        <p key={grant.delegate_id}>
          <button disabled={busy} onClick={() => choose(grant.delegate_id)}>
            {config.users.find((user) => user.id === grant.delegate_id)?.name ??
              'Usuário inativo'}
          </button>
          {' — '}
          {delegatedCapabilities
            .filter(([key]) => grant.permissions.includes(key))
            .map(([, label]) => label)
            .join(' · ')}
        </p>
      ))}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
