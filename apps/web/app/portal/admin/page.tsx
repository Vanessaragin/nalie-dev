'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AccessLegend from '../../components/access-legend';
import MenuToggle from '../../components/menu-toggle';
import shell from '../styles.module.css';
import styles from './styles.module.css';
import PortalNavigation from '../portal-navigation';
import CompanySwitcher from '../../components/company-switcher';
import {
  pagePermissionOptions,
  limitedPagePermissions,
  saveCreatedUserPermissions,
} from '../../components/page-permissions';
import {
  appendNaliePolicyToCsv,
  downloadTextFile,
} from '../../../lib/nalie-data-policy';
import { createClient } from '../../../lib/supabase/client';

type AdminUser = {
  membershipId?: string;
  name: string;
  company: string;
  role: string;
  login: string;
  imported: string;
  status: boolean;
  access: string;
  password: string;
  limitedTo?: string[];
};

const seedUsers: AdminUser[] = [];

type AdminMetrics = {
  activeCompanies: number;
  newCompanies: number;
  activeUsers: number;
  suspendedUsers: number;
  monthlyImports: number;
  lastImport: string;
  downloads: number;
};

const emptyMetrics: AdminMetrics = {
  activeCompanies: 0,
  newCompanies: 0,
  activeUsers: 0,
  suspendedUsers: 0,
  monthlyImports: 0,
  lastImport: 'Nenhuma importação',
  downloads: 0,
};

const resetUserLabel = (user: AdminUser) => `${user.company} | ${user.name}`;

export default function AdminPage() {
  const en = false;
  const [users, setUsers] = useState(seedUsers);
  const [metrics, setMetrics] = useState(emptyMetrics);
  const [statuses, setStatuses] = useState(
    seedUsers.map((user) => user.status),
  );
  const [accessLevels, setAccessLevels] = useState(
    seedUsers.map((user) => user.access),
  );
  const [resetFeedback, setResetFeedback] = useState('');
  const [resetWhatsappLink, setResetWhatsappLink] = useState('');
  const [activityFeedback, setActivityFeedback] = useState('');
  const [inviteSent, setInviteSent] = useState(false);
  const [businessArea, setBusinessArea] = useState('personal');
  const [entityType, setEntityType] = useState('personal');
  const [resetUser, setResetUser] = useState('');
  const [resetChannel, setResetChannel] = useState('email');
  const [showProvisioning] = useState(false);
  const [userPages, setUserPages] = useState<string[]>([
    ...limitedPagePermissions,
  ]);

  useEffect(() => {
    async function loadCompanyUsers() {
      try {
        const supabase = createClient();
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const [
          usersResult,
          companiesResult,
          importsResult,
          lastImportResult,
          downloadsResult,
        ] = await Promise.all([
          supabase.rpc('admin_list_company_users'),
          supabase
            .from('companies')
            .select('id,created_at,status')
            .eq('status', 'ACTIVE'),
          supabase
            .from('import_batches')
            .select('id', { count: 'exact', head: true })
            .is('deleted_at', null)
            .gte('imported_at', monthStart.toISOString()),
          supabase
            .from('import_batches')
            .select('imported_at')
            .is('deleted_at', null)
            .order('imported_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('client_activities')
            .select('id', { count: 'exact', head: true })
            .eq('kind', 'DOWNLOAD'),
        ]);
        const { data, error } = usersResult;
        if (error) throw error;
        const companyRows = companiesResult.data ?? [];
        const activeUsers = (data ?? []).filter(
          (row: { membership_status: string }) =>
            row.membership_status === 'ACTIVE',
        ).length;
        const suspendedUsers = (data ?? []).filter(
          (row: { membership_status: string }) =>
            row.membership_status !== 'ACTIVE',
        ).length;
        const lastImportedAt = lastImportResult.data?.imported_at;
        setMetrics({
          activeCompanies: companyRows.length,
          newCompanies: companyRows.filter(
            (company) => new Date(company.created_at) >= monthStart,
          ).length,
          activeUsers,
          suspendedUsers,
          monthlyImports: importsResult.count ?? 0,
          lastImport: lastImportedAt
            ? `Última em ${new Date(lastImportedAt).toLocaleString('pt-BR')}`
            : 'Nenhuma importação',
          downloads: downloadsResult.count ?? 0,
        });
        if (!data?.length) {
          setUsers([]);
          setStatuses([]);
          setAccessLevels([]);
          setResetUser('');
          return;
        }

        const loadedUsers: AdminUser[] = data.map(
          (row: {
            membership_id: string;
            profile_name: string;
            company_name: string;
            role_name: string;
            membership_status: string;
            portal_access: string;
          }) => ({
            membershipId: row.membership_id,
            name: row.profile_name,
            company: row.company_name,
            role: row.role_name === 'COMPANY_ADMIN' ? 'Usuário 1' : 'Usuário 2',
            login: 'Registrado no servidor',
            imported: 'Consultar auditoria',
            status: row.membership_status === 'ACTIVE',
            access:
              row.portal_access === 'COMPLETE'
                ? 'Completo'
                : row.portal_access === 'BLOCKED'
                  ? 'Bloqueado'
                  : 'Limitado',
            password: 'Redefinição protegida',
          }),
        );
        setUsers(loadedUsers);
        setStatuses(loadedUsers.map((user) => user.status));
        setAccessLevels(loadedUsers.map((user) => user.access));
        setResetUser(resetUserLabel(loadedUsers[0]));
      } catch {
        setUsers([]);
        setStatuses([]);
        setAccessLevels([]);
        setResetUser('');
      }
    }
    void loadCompanyUsers();
  }, []);

  function exportCrmActivities() {
    const csv = 'atividade;data;detalhes';
    downloadTextFile(
      appendNaliePolicyToCsv(csv, {
        clientName: 'Administração Nalie',
        processingId: 'NALIE-CRM-AUDIT',
        source: 'Histórico de atividades do CRM',
      }),
      'atividades-crm-nalie.csv',
    );
    setActivityFeedback('Histórico do CRM exportado com sucesso.');
  }

  function openPasswordReset(user: AdminUser) {
    setResetUser(resetUserLabel(user));
    document
      .getElementById('password-reset')
      ?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  async function changeUserAccess(index: number, requestedAccess: string) {
    const previousAccess = accessLevels[index];
    setAccessLevels((current) =>
      current.map((access, item) =>
        item === index ? requestedAccess : access,
      ),
    );

    const membershipId = users[index]?.membershipId;
    if (!membershipId) return;

    try {
      const supabase = createClient();
      const level =
        requestedAccess === 'Completo'
          ? 'COMPLETE'
          : requestedAccess === 'Bloqueado'
            ? 'BLOCKED'
            : 'LIMITED';
      const { error } = await supabase.rpc('set_company_user_access_level', {
        target_membership_id: membershipId,
        requested_level: level,
      });
      if (error) throw error;
      setActivityFeedback(
        `Acesso de ${users[index].name} alterado para ${requestedAccess}.`,
      );
    } catch {
      setAccessLevels((current) =>
        current.map((access, item) =>
          item === index ? previousAccess : access,
        ),
      );
      setActivityFeedback(
        `Não foi possível alterar o acesso de ${users[index].name}.`,
      );
    }
  }

  async function requestPasswordReset() {
    setResetWhatsappLink('');
    const selectedUser = users.find(
      (user) => resetUserLabel(user) === resetUser,
    );
    if (!selectedUser?.membershipId) {
      setResetFeedback(
        `Reset preparado para ${resetUser} por ${resetChannel === 'both' ? 'e-mail e WhatsApp' : resetChannel === 'whatsapp' ? 'WhatsApp' : 'e-mail'}. A solicitação será gravada quando o Supabase estiver conectado.`,
      );
      return;
    }

    try {
      const response = await fetch('/api/admin/password-reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          membershipId: selectedUser.membershipId,
          channel: resetChannel,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        whatsappLink?: string;
      };
      if (!response.ok) throw new Error(result.error);
      setResetWhatsappLink(result.whatsappLink ?? '');
      setResetFeedback(
        `Reset solicitado para ${resetUser} por ${resetChannel === 'both' ? 'e-mail e WhatsApp' : resetChannel === 'whatsapp' ? 'WhatsApp' : 'e-mail'}. O link expira em 48 horas.`,
      );
    } catch {
      setResetFeedback(
        `Não foi possível registrar o reset de ${resetUser}. Tente novamente.`,
      );
    }
  }

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
        <AccessLegend />
      </aside>

      <section className={`${shell.content} ${styles.content}`}>
        <header>
          <div>
            <h1>{en ? 'General Administration' : 'Administração Geral'}</h1>
            <p>
              {en
                ? 'Manage users, clients, activities and appointments across the platform.'
                : 'Controle usuários, clientes, atividades e compromissos de toda a plataforma.'}
            </p>
          </div>
          <div className={shell.filters}>
            <Link className={shell.import} href="/portal/admin/crm">
              Cadastrar ou alterar clientes →
            </Link>
          </div>
        </header>

        {showProvisioning && (
          <section className={styles.provisioning}>
            <div className={styles.provisionForm}>
              <label>
                Tipo de cadastro
                <select
                  value={entityType}
                  onChange={(event) => {
                    setEntityType(event.target.value);
                    setBusinessArea(
                      event.target.value === 'personal'
                        ? 'personal'
                        : 'services',
                    );
                  }}
                >
                  <option value="company">Pessoa jurídica</option>
                  <option value="personal">Pessoa física</option>
                </select>
              </label>
              <label>
                {entityType === 'company'
                  ? 'Nome da empresa'
                  : 'Nome do perfil pessoal'}
                <input
                  defaultValue={
                    entityType === 'company' ? 'Nova empresa' : 'Perfil pessoal'
                  }
                />
              </label>
              <label>
                Área de atuação
                <select
                  value={businessArea}
                  onChange={(event) => setBusinessArea(event.target.value)}
                >
                  {entityType === 'personal' && (
                    <option value="personal">Pessoa física</option>
                  )}
                  <option value="food">Alimentação</option>
                  <option value="construction">Construção</option>
                  <option value="cleaning">Limpeza</option>
                  <option value="retail">Comércio</option>
                  <option value="services">Serviços</option>
                  <option value="transport">Transporte e entregas</option>
                  <option value="health">Saúde e bem-estar</option>
                  <option value="beauty">Beleza</option>
                </select>
              </label>
              <label>
                Nome do Usuário 1
                <input defaultValue="Nome completo do Usuário 1" />
              </label>
              <label>
                E-mail do Usuário 1
                <input type="email" defaultValue="usuario1@empresa.com" />
              </label>
              <label>
                Nome do Usuário 2 (opcional)
                <input placeholder="Nome completo do Usuário 2" />
              </label>
              <label>
                E-mail do Usuário 2 (opcional)
                <input type="email" placeholder="usuario2@empresa.com" />
              </label>
              <div className={styles.pagePermissions}>
                <div>
                  <b>Páginas disponíveis para este usuário</b>
                  <small>
                    Desmarque o que não poderá acessar. A página e seu ícone
                    desaparecerão do menu.
                  </small>
                </div>
                <div className={styles.pagePermissionGrid}>
                  {pagePermissionOptions.map(([key, label]) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={userPages.includes(key)}
                        onChange={() =>
                          setUserPages((current) =>
                            current.includes(key)
                              ? current.filter((item) => item !== key)
                              : [...current, key],
                          )
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <label>
                Telefone / WhatsApp
                <input type="tel" placeholder="(00) 00000-0000" />
              </label>
              {entityType === 'company' ? (
                <>
                  <label>
                    CNPJ
                    <input placeholder="00.000.000/0001-00" />
                  </label>
                  <label className={styles.addressField}>
                    Endereço
                    <input placeholder="Cidade, estado e país" />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Profissão ou atividade
                    <select defaultValue="entrepreneur">
                      <option value="entrepreneur">Empresário</option>
                      <option value="self-employed">Autônomo</option>
                      <option value="law">Advogado / Paralegal</option>
                      <option value="consultant">Consultor</option>
                      <option value="other">Outro</option>
                    </select>
                  </label>
                  <label>
                    Objetivo financeiro
                    <input placeholder="Organização, reserva, investimento..." />
                  </label>
                  <label>
                    Renda média mensal
                    <input type="number" min="0" placeholder="R$" />
                  </label>
                </>
              )}
              <label>
                Enviar senha por
                <select defaultValue="email">
                  <option value="email">E-mail</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="both">E-mail e WhatsApp</option>
                </select>
              </label>
              <button
                onClick={() => {
                  saveCreatedUserPermissions(
                    'user-1',
                    pagePermissionOptions.map(([key]) => key),
                  );
                  saveCreatedUserPermissions('user-2', userPages);
                  setInviteSent(true);
                }}
              >
                Criar cliente e enviar acesso(s)
              </button>
            </div>
            <p className={styles.profileHint}>
              👤 O Usuário 1 é obrigatório. O Usuário 2 só será criado quando
              nome e e-mail forem informados. Cada pessoa poderá alterar apenas
              os próprios dados pessoais e a própria senha em <b>Meu perfil</b>.
            </p>
            {inviteSent && (
              <div className={styles.inviteResult}>
                <span>✓</span>
                <p>
                  <b>Acesso provisório preparado</b>
                  <small>
                    Cada usuário receberá seu login, uma senha provisória
                    individual e o link para criar a nova senha.
                  </small>
                </p>
                <Link href="/primeiro-acesso">Ver primeiro acesso →</Link>
              </div>
            )}
          </section>
        )}

        <section className={styles.metrics}>
          <article>
            <span>Empresas ativas</span>
            <strong>{metrics.activeCompanies}</strong>
            <small>＋ {metrics.newCompanies} neste mês</small>
          </article>
          <article>
            <span>Usuários ativos</span>
            <strong>{metrics.activeUsers}</strong>
            <small>{metrics.suspendedUsers} acessos suspensos</small>
          </article>
          <article>
            <span>Importações no mês</span>
            <strong>{metrics.monthlyImports}</strong>
            <small>{metrics.lastImport}</small>
          </article>
          <article>
            <span>Downloads</span>
            <strong>{metrics.downloads}</strong>
            <small>Downloads registrados</small>
          </article>
        </section>

        <section className={styles.management}>
          <article className={styles.users}>
            <div className={styles.title}>
              <div>
                <b>Usuários e permissões</b>
                <small>Somente você ativa ou desativa acessos.</small>
              </div>
              <Link className={styles.auditLink} href="#auditoria-completa">
                Ver auditoria completa ↓
              </Link>
            </div>
            <div className={styles.userTable}>
              <div className={styles.tableHead}>
                <span>Usuário / empresa</span>
                <span>Nível</span>
                <span>Último login</span>
                <span>Última importação</span>
                <span>Acesso</span>
                <span>Senha</span>
                <span>Status</span>
              </div>
              {users.map((user, index) => (
                <div className={styles.userRow} key={user.name}>
                  <span>
                    <i>
                      {user.name
                        .split(' ')
                        .map((part) => part[0])
                        .join('')}
                    </i>
                    <p>
                      <b>{user.name}</b>
                      <small>{user.company}</small>
                    </p>
                  </span>
                  <span>{user.role}</span>
                  <span>{user.login}</span>
                  <span>{user.imported}</span>
                  <div className={styles.accessCell}>
                    <select
                      className={styles.access}
                      aria-label={`Acesso de ${user.name}`}
                      value={accessLevels[index]}
                      onChange={(event) =>
                        void changeUserAccess(index, event.target.value)
                      }
                    >
                      <option>Completo</option>
                      <option>Limitado</option>
                      <option>Bloqueado</option>
                    </select>
                    {accessLevels[index] === 'Limitado' && (
                      <small>
                        Liberado:{' '}
                        {user.limitedTo?.join(', ') ||
                          'conforme permissões individuais'}
                      </small>
                    )}
                  </div>
                  <button
                    className={styles.password}
                    onClick={() => openPasswordReset(user)}
                    aria-label={`Redefinir senha de ${user.name}`}
                  >
                    {user.password}
                    <small>Redefinir senha →</small>
                  </button>
                  <button
                    aria-label={`${statuses[index] ? 'Desativar' : 'Ativar'} ${user.name}`}
                    className={statuses[index] ? styles.on : styles.off}
                    onClick={() =>
                      setStatuses((current) =>
                        current.map((status, item) =>
                          item === index ? !status : status,
                        ),
                      )
                    }
                  >
                    <i />
                    {statuses[index] ? 'Ativo' : 'Inativo'}
                  </button>
                </div>
              ))}
            </div>
            <div className={styles.accessLegend}>
              <div>
                <b>Completo</b>
                <span>Acessa todas as páginas liberadas para a empresa.</span>
              </div>
              <div>
                <b>Limitado</b>
                <span>
                  Acessa somente Análise, Calendário e Mais informações. A
                  autorização dos conteúdos de Análise (BI, PowerPoint e Excel)
                  é configurada separadamente para cada empresa.
                </span>
              </div>
              <div>
                <b>Bloqueado</b>
                <span>
                  Não entra no portal; dados e histórico são mantidos.
                </span>
              </div>
            </div>
          </article>
        </section>

        <section className={styles.securityGrid}>
          <article id="password-reset">
            <div className={styles.title}>
              <div>
                <b>Senha inicial e renovação</b>
                <small>Política de acesso aplicada a todos os usuários.</small>
              </div>
              <span>🔐</span>
            </div>
            <div className={styles.passwordPolicy}>
              <label>
                Usuário para redefinição
                <select
                  aria-label="Usuário para redefinição"
                  value={resetUser}
                  onChange={(event) => setResetUser(event.target.value)}
                >
                  {users.map((user) => (
                    <option key={`${user.company}-${user.name}`}>
                      {resetUserLabel(user)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Enviar instruções por
                <select
                  aria-label="Canal para envio da nova senha"
                  value={resetChannel}
                  onChange={(event) => setResetChannel(event.target.value)}
                >
                  <option value="email">E-mail</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="both">E-mail e WhatsApp</option>
                </select>
              </label>
              <button onClick={() => void requestPasswordReset()}>
                Solicitar reset de senha
              </button>
            </div>
            <ul className={styles.passwordRules}>
              <li>Troca obrigatória no próximo acesso</li>
              <li>Nova senha solicitada a cada 90 dias</li>
              <li>O link provisório expira em 48 horas</li>
              <li>A senha definitiva nunca fica visível</li>
            </ul>
            {resetFeedback && (
              <p className={styles.resetFeedback} role="status">
                {resetFeedback} O usuário deverá criar uma nova senha na tela de
                primeiro acesso.
              </p>
            )}
            {resetWhatsappLink && (
              <button
                className={styles.copyResetLink}
                onClick={() => {
                  void navigator.clipboard.writeText(resetWhatsappLink);
                  setResetFeedback(
                    'Link seguro copiado. Envie ao usuário pelo WhatsApp.',
                  );
                }}
              >
                Copiar link seguro para WhatsApp
              </button>
            )}
          </article>
        </section>

        <section className={styles.crmGrid} id="auditoria-completa">
          <article>
            <div className={styles.title}>
              <div>
                <b>CRM e atividade dos clientes</b>
                <small>
                  Histórico centralizado de todas as ações relevantes.
                </small>
              </div>
              <button onClick={exportCrmActivities}>Exportar CRM ↓</button>
            </div>
            {activityFeedback && (
              <p className={styles.activityFeedback} role="status">
                {activityFeedback}
              </p>
            )}
            <p className={styles.activityFeedback}>
              Nenhuma atividade registrada ainda.
            </p>
          </article>
        </section>
      </section>
    </main>
  );
}
