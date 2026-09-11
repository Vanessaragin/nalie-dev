'use client';

import { useEffect, useState } from 'react';
import { createClient } from '../../../../lib/supabase/client';
import styles from './delegated-access.module.css';

export const delegatedCapabilities = [
  ['analysis', 'Visualizar análises'],
  ['crm', 'Consultar contatos / CRM'],
  ['activity', 'Consultar atividade do usuário'],
  ['calendar', 'Consultar calendário compartilhado'],
  ['password_reset', 'Solicitar redefinição de senha'],
] as const;

type UserOption = {
  id: string;
  profileId: string;
  name: string;
  email: string;
  company: string;
  master: boolean;
};
type Grant = { membershipId: string; permissions: string[] };
type Configuration = { users: UserOption[]; grants: Grant[] };
type Account = { id: string; email: string };
const masterEmails = ['naliedados@gmail.com', 'reginaragin@gmail.com'];

export default function DelegatedAccess({
  name,
  accounts = [],
}: {
  name: string;
  accounts?: Account[];
}) {
  const [delegate, setDelegate] = useState(
    accounts.length === 1 ? accounts[0].id : '',
  );
  const [config, setConfig] = useState<Configuration | null>(null);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const isMaster = accounts.some(
    (account) =>
      account.id === delegate &&
      masterEmails.includes(account.email.toLowerCase()),
  );
  useEffect(() => {
    let active = true;
    if (!delegate) return;
    async function load() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.rpc(
          'simple_admin_configuration',
          { target_delegate: delegate },
        );
        if (!active) return;
        if (!error) {
          const configuration = data as Configuration;
          setConfig(configuration);
          setGrants(configuration.grants);
          setAvailable(true);
          setNotice('');
          return;
        }
        // While the migration is pending, the owner can review the real user
        // directory. No grant is persisted or simulated as a successful save.
        if (!['PGRST202', '42883'].includes(error.code)) throw error;
        const { data: owner, error: ownerError } =
          await supabase.rpc('is_super_admin');
        if (ownerError || !owner) throw new Error('Forbidden');
        const { data: rows, error: rowsError } = await supabase
          .from('company_users')
          .select(
            'id,profile_id,company_id,profiles!company_users_profile_id_fkey(display_name,public_email),companies(display_name),roles(code)',
          );
        if (rowsError) throw rowsError;
        const users = (rows ?? []).map((row) => {
          const profile = Array.isArray(row.profiles)
            ? row.profiles[0]
            : row.profiles;
          const company = Array.isArray(row.companies)
            ? row.companies[0]
            : row.companies;
          const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
          const email = profile?.public_email ?? '';
          return {
            id: row.id,
            profileId: row.profile_id,
            name: profile?.display_name ?? 'Usuário',
            email,
            company: company?.display_name ?? 'Plataforma',
            master:
              role?.code === 'SUPER_ADMIN' ||
              masterEmails.includes(email.toLowerCase()),
          };
        });
        if (active) {
          setConfig({ users, grants: [] });
          setGrants([]);
          setAvailable(false);
          setNotice(
            'Prévia local: você pode montar a seleção. Para salvar, a atualização de permissões precisa estar aplicada ao banco.',
          );
        }
      } catch {
        if (active) {
          setConfig(null);
          setAvailable(false);
          setNotice(
            'Não foi possível carregar os usuários. Atualize a página ou verifique sua sessão Super Master.',
          );
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [delegate]);
  function chooseAccount(id: string) {
    setDelegate(id);
    setConfig(null);
    setGrants([]);
    setAvailable(false);
    setNotice('');
  }
  function selectUser(user: UserOption, checked: boolean) {
    if (user.master || user.profileId === delegate || isMaster) return;
    setGrants((current) =>
      checked
        ? [...current, { membershipId: user.id, permissions: ['analysis'] }]
        : current.filter((grant) => grant.membershipId !== user.id),
    );
  }
  async function save() {
    if (!delegate || !available || busy || isMaster) return;
    setBusy(true);
    try {
      const { error } = await createClient().rpc('set_simple_admin_access', {
        target_delegate: delegate,
        selections: grants,
      });
      if (error) throw error;
      setNotice('Acessos do ADM simples salvos e registrados na auditoria.');
    } catch {
      setNotice(
        'Não foi possível salvar. Nenhuma confirmação de alteração foi recebida.',
      );
    } finally {
      setBusy(false);
    }
  }
  const filtered =
    config?.users.filter((user) =>
      `${user.name} ${user.email} ${user.company}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) ?? [];
  return (
    <section className={styles.panel}>
      <header>
        <span className={styles.badge}>ADM SIMPLES</span>
        <h2>Quem {name} pode visualizar</h2>
        <p>
          Selecione os usuários que este perfil poderá acompanhar e marque as
          funções permitidas para cada um.
        </p>
      </header>
      <p className={styles.hierarchy}>
        <strong>Super Master:</strong> naliedados@gmail.com e
        reginaragin@gmail.com. O ADM simples não altera suas próprias permissões
        nem administra os Super Master.
      </p>
      {accounts.length === 0 ? (
        <p>
          Este contato ainda não possui um login. Cadastre o acesso antes de
          configurar o ADM simples.
        </p>
      ) : accounts.length > 1 ? (
        <label className={styles.account}>
          Login que receberá o perfil ADM simples
          <select
            value={delegate}
            onChange={(event) => chooseAccount(event.target.value)}
          >
            <option value="">Selecione o login desta ficha</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.email}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p>
          <strong>Login deste perfil:</strong> {accounts[0].email}
        </p>
      )}
      {isMaster ? (
        <p>
          Este login é Super Master. A configuração de ADM simples não se aplica
          a ele.
        </p>
      ) : (
        delegate && (
          <>
            <p>
              Marque os usuários que {name} pode visualizar. Para retirar um
              acesso, basta desmarcar o usuário e salvar. Isso não exclui nenhum
              usuário, cliente ou dado cadastrado.
            </p>
            <details className={styles.picker}>
              <summary>
                Selecionar usuários · {grants.length} selecionado(s)
              </summary>
              <label className={styles.search}>
                Buscar usuário
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nome, e-mail ou cliente"
                />
              </label>
              <div className={styles.options}>
                {!config && <p>Carregando usuários…</p>}
                {config && filtered.length === 0 && (
                  <p>Nenhum usuário encontrado.</p>
                )}
                {filtered.map((user) => (
                  <label className={styles.option} key={user.id}>
                    <input
                      type="checkbox"
                      disabled={
                        busy || user.master || user.profileId === delegate
                      }
                      checked={grants.some(
                        (grant) => grant.membershipId === user.id,
                      )}
                      onChange={(event) =>
                        selectUser(user, event.target.checked)
                      }
                    />
                    <span>
                      <strong>{user.name}</strong>
                      <small>
                        {user.email} · {user.company}
                      </small>
                      {user.master ? (
                        <small>Super Master · protegido</small>
                      ) : user.profileId === delegate ? (
                        <small>
                          Próprio login · acesso original preservado
                        </small>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            </details>
            <h3>Usuários que {name} poderá visualizar</h3>
            {grants.length === 0 && <p>Nenhum outro usuário selecionado.</p>}
            {grants.map((grant) => {
              const user = config?.users.find(
                (item) => item.id === grant.membershipId,
              );
              return (
                <fieldset
                  key={grant.membershipId}
                  disabled={busy}
                  className={styles.permissions}
                >
                  <legend>
                    {user?.name ?? 'Usuário'} · {user?.email}
                  </legend>
                  <div>
                    {delegatedCapabilities.map(([key, label]) => (
                      <label key={key}>
                        <input
                          type="checkbox"
                          checked={grant.permissions.includes(key)}
                          onChange={(event) =>
                            setGrants((current) =>
                              current.map((item) =>
                                item.membershipId === grant.membershipId
                                  ? {
                                      ...item,
                                      permissions: event.target.checked
                                        ? [...item.permissions, key]
                                        : item.permissions.filter(
                                            (permission) => permission !== key,
                                          ),
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              );
            })}
            <p>
              As análises e os contatos são compartilhados pela empresa do
              usuário selecionado. Atividades e compromissos ficam limitados ao
              usuário escolhido; eventos pessoais permanecem privados. As demais
              páginas mantêm o acesso próprio deste perfil.
            </p>
            <button
              className={styles.save}
              disabled={
                !available ||
                busy ||
                grants.some((grant) => grant.permissions.length === 0)
              }
              onClick={() => void save()}
            >
              {busy ? 'Salvando…' : 'Salvar acessos do ADM simples'}
            </button>
          </>
        )
      )}
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
