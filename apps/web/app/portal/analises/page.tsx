'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AccessLegend from '../../components/access-legend';
import MenuToggle from '../../components/menu-toggle';
import shell from '../styles.module.css';
import styles from './styles.module.css';
import PortalNavigation from '../portal-navigation';
import CompanySwitcher from '../../components/company-switcher';
import { useCurrentPagePermissions } from '../../components/page-permissions';
import { createClient } from '../../../lib/supabase/client';

const findings: Array<{
  title: string;
  evidence: string;
  status: string;
  impact: string;
}> = [];

const history: string[][] = [];

const workflowLinks = [
  ['💡', 'Achados e hipóteses', 'achados'],
  ['✅', 'Decisões e ações', 'decisoes'],
  ['🕘', 'Histórico analítico', 'historico'],
  ['📈', 'BI e apresentações', 'conteudos'],
];

type AnalysisCompany = {
  id: string;
  company: string;
  dashboardUrl?: string;
  presentationUrl?: string;
  excelName1?: string;
  excelUrl1?: string;
  excelName2?: string;
  excelUrl2?: string;
  contentAccess?: 'Empresa' | 'Restrito';
};

type PortalNotification = {
  id: string;
  icon: string;
  title: string;
  detail: string;
  href: string;
};

function embeddableUrl(value: string) {
  try {
    const url = new URL(value);
    if (
      url.hostname === 'docs.google.com' &&
      url.pathname.includes('/presentation/d/e/') &&
      url.pathname.endsWith('/pub')
    ) {
      url.pathname = url.pathname.replace(/\/pub$/, '/embed');
    }
    return url.toString();
  } catch {
    return value;
  }
}

type FinancialSummary = {
  movimentacoes: number;
  entradas: number;
  saidas: number;
  cartao: number;
  parcelas_futuras: number;
  ultima_movimentacao: string | null;
};

type FinancialBreakdown = {
  totals: Pick<
    FinancialSummary,
    'entradas' | 'saidas' | 'cartao' | 'parcelas_futuras'
  >;
  monthly: Array<{ month: string; entradas: number; saidas: number }>;
  categories: Array<{ name: string; value: number }>;
  institutions: Array<{ name: string; records: number; value: number }>;
};

const emptyFinancialSummary: FinancialSummary = {
  movimentacoes: 0,
  entradas: 0,
  saidas: 0,
  cartao: 0,
  parcelas_futuras: 0,
  ultima_movimentacao: null,
};

const emptyBreakdown: FinancialBreakdown = {
  totals: { entradas: 0, saidas: 0, cartao: 0, parcelas_futuras: 0 },
  monthly: [],
  categories: [],
  institutions: [],
};

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const fallbackCompany: AnalysisCompany = {
  id: '',
  company: 'Nenhuma empresa selecionada',
};

export default function AnalysisWorkspacePage() {
  const permissions = useCurrentPagePermissions();
  const canManageAnalysis = permissions.includes('super');
  const [tab, setTab] = useState('conteudos');
  const [notice, setNotice] = useState('');
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [editor, setEditor] = useState<'achado' | 'decisao' | null>(null);
  const [customFindings, setCustomFindings] = useState<typeof findings>([]);
  const [analysisCompanies, setAnalysisCompanies] = useState<AnalysisCompany[]>(
    [],
  );
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [financialSummary, setFinancialSummary] = useState(
    emptyFinancialSummary,
  );
  const [periodStart, setPeriodStart] = useState(
    () => `${new Date().getFullYear()}-01-01`,
  );
  const [periodEnd, setPeriodEnd] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [breakdown, setBreakdown] = useState(emptyBreakdown);

  useEffect(() => {
    const selected = new URLSearchParams(window.location.search).get('tab');
    if (
      selected &&
      ['visao', 'achados', 'decisoes', 'historico', 'conteudos'].includes(
        selected,
      )
    ) {
      queueMicrotask(() => setTab(selected));
    }
  }, []);

  useEffect(() => {
    async function loadCompaniesAndLinks() {
      try {
        const supabase = createClient();
        const companyQuery = canManageAnalysis
          ? supabase
              .from('companies')
              .select('id, display_name')
              .order('display_name')
          : supabase.rpc('current_company_id');
        const companyResult = await companyQuery;
        if (companyResult.error) throw companyResult.error;
        let companies = canManageAnalysis
          ? ((companyResult.data ?? []) as Array<{
              id: string;
              display_name: string;
            }>)
          : [];
        if (!canManageAnalysis && companyResult.data) {
          const { data: ownCompany, error: ownCompanyError } = await supabase
            .from('companies')
            .select('id, display_name')
            .eq('id', companyResult.data as string)
            .single();
          if (ownCompanyError) throw ownCompanyError;
          companies.push(ownCompany);
        }
        if (companies.length) {
          const { data: crmRows, error: crmError } = await supabase
            .from('client_crm')
            .select('company_id, client_status')
            .in(
              'company_id',
              companies.map((company) => company.id),
            );
          if (crmError) throw crmError;
          const contractedCompanyIds = new Set(
            (crmRows ?? [])
              .filter((row) => row.client_status !== 'Não contratado')
              .map((row) => row.company_id),
          );
          companies = companies.filter((company) =>
            contractedCompanyIds.has(company.id),
          );
          if (canManageAnalysis) {
            const companiesWithLogin = await Promise.all(
              companies.map(async (company) => {
                const { data: hasCompletedLogin } = await supabase.rpc(
                  'company_has_completed_login',
                  { target_company_id: company.id },
                );
                return hasCompletedLogin ? company : null;
              }),
            );
            companies = companiesWithLogin.filter(
              (company) => company !== null,
            );
          }
        }
        if (!companies.length) throw new Error('Nenhuma empresa disponível.');
        const { data: links, error: linksError } = await supabase
          .from('company_analysis_links')
          .select(
            'company_id, link_type, display_name, source_url, access_scope',
          )
          .in(
            'company_id',
            companies.map((company) => company.id),
          );
        if (linksError) throw linksError;
        const mapped = companies.map((company) => {
          const companyLinks = (links ?? []).filter(
            (link) => link.company_id === company.id,
          );
          const find = (type: string) =>
            companyLinks.find((link) => link.link_type === type);
          return {
            id: company.id,
            company: company.display_name,
            dashboardUrl: find('DASHBOARD')?.source_url ?? '',
            presentationUrl: find('PRESENTATION')?.source_url ?? '',
            excelName1: find('EXCEL_1')?.display_name ?? '',
            excelUrl1: find('EXCEL_1')?.source_url ?? '',
            excelName2: find('EXCEL_2')?.display_name ?? '',
            excelUrl2: find('EXCEL_2')?.source_url ?? '',
            contentAccess: companyLinks.some(
              (link) => link.access_scope === 'RESTRICTED',
            )
              ? ('Restrito' as const)
              : ('Empresa' as const),
          };
        });
        setAnalysisCompanies(mapped);
        setSelectedCompanyId(canManageAnalysis ? '' : mapped[0].id);
        return;
      } catch {
        setAnalysisCompanies([]);
        setSelectedCompanyId('');
      }
    }
    void loadCompaniesAndLinks();
  }, [canManageAnalysis]);

  useEffect(() => {
    let active = true;
    async function loadFinancialSummary() {
      if (!selectedCompanyId) {
        setFinancialSummary(emptyFinancialSummary);
        return;
      }
      try {
        const supabase = createClient({ detectSessionInUrl: false });
        const { data, error } = await supabase.rpc(
          'financial_analysis_summary',
          {
            target_company_id: selectedCompanyId,
          },
        );
        if (error) throw error;
        if (active)
          setFinancialSummary({
            ...emptyFinancialSummary,
            ...(data as Partial<FinancialSummary>),
          });
      } catch {
        if (active) setFinancialSummary(emptyFinancialSummary);
      }
    }
    void loadFinancialSummary();
    return () => {
      active = false;
    };
  }, [selectedCompanyId]);

  useEffect(() => {
    let active = true;
    async function loadBreakdown() {
      if (
        !selectedCompanyId ||
        !periodStart ||
        !periodEnd ||
        periodStart > periodEnd
      ) {
        setBreakdown(emptyBreakdown);
        return;
      }
      try {
        const supabase = createClient({ detectSessionInUrl: false });
        const { data, error } = await supabase.rpc(
          'financial_analysis_breakdown',
          {
            target_company_id: selectedCompanyId,
            period_start: periodStart,
            period_end: periodEnd,
          },
        );
        if (error) throw error;
        if (active)
          setBreakdown({
            ...emptyBreakdown,
            ...(data as Partial<FinancialBreakdown>),
          });
      } catch {
        if (active) setBreakdown(emptyBreakdown);
      }
    }
    void loadBreakdown();
    return () => {
      active = false;
    };
  }, [selectedCompanyId, periodStart, periodEnd]);

  useEffect(() => {
    let active = true;
    async function loadNotifications() {
      try {
        const supabase = createClient({ detectSessionInUrl: false });
        const recentImportDate = new Date();
        recentImportDate.setDate(recentImportDate.getDate() - 30);
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const [eventsResult, importsResult, paymentsResult] = await Promise.all(
          [
            supabase
              .from('calendar_events')
              .select('id,title,starts_at,billing_payment_id')
              .gte('starts_at', ninetyDaysAgo.toISOString())
              .order('starts_at', { ascending: true })
              .limit(100),
            supabase
              .from('import_batches')
              .select('id,original_filename,imported_at')
              .is('deleted_at', null)
              .gte('imported_at', recentImportDate.toISOString())
              .order('imported_at', { ascending: false })
              .limit(5),
            supabase
              .from('service_payments')
              .select('id,due_date,payment_status')
              .not('payment_status', 'in', '(PAID,RECEIVED)'),
          ],
        );
        if (!active) return;
        const calendarHref = canManageAnalysis
          ? '/portal/calendario'
          : '/portal/calendario/cliente';
        const dateTime = new Intl.DateTimeFormat('pt-BR', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });
        const items: PortalNotification[] = [];
        if (!eventsResult.error) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const sevenDaysFromNow = new Date(today);
          sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
          const pendingPayments = new Map(
            (paymentsResult.data ?? []).map((payment) => [payment.id, payment]),
          );
          const relevantEvents = (eventsResult.data ?? []).filter((event) => {
            const eventDate = new Date(event.starts_at);
            eventDate.setHours(0, 0, 0, 0);
            if (event.billing_payment_id) {
              const payment = pendingPayments.get(event.billing_payment_id);
              if (!payment) return false;
              const dueDate = new Date(`${payment.due_date}T12:00:00`);
              return dueDate <= sevenDaysFromNow;
            }
            return eventDate.getTime() === today.getTime();
          });
          items.push(
            ...relevantEvents.map((event) => ({
              id: `event-${event.id}`,
              icon: '📅',
              title: event.title,
              detail: dateTime.format(new Date(event.starts_at)),
              href: calendarHref,
            })),
          );
        }
        if (!importsResult.error) {
          items.push(
            ...(importsResult.data ?? []).map((batch) => ({
              id: `import-${batch.id}`,
              icon: '📥',
              title: 'Novos dados disponíveis',
              detail: `${batch.original_filename} · ${dateTime.format(
                new Date(batch.imported_at),
              )}`,
              href: '/portal/relatorios',
            })),
          );
        }
        setNotifications(items.slice(0, 8));
      } catch {
        if (active) setNotifications([]);
      }
    }
    void loadNotifications();
    return () => {
      active = false;
    };
  }, [canManageAnalysis]);

  const selectedCompany =
    analysisCompanies.find((item) => item.id === selectedCompanyId) ??
    (canManageAnalysis ? null : (analysisCompanies[0] ?? fallbackCompany));
  const canViewSelectedContent =
    selectedCompany !== null &&
    (canManageAnalysis ||
      selectedCompany.contentAccess !== 'Restrito' ||
      permissions.includes('analysis:bi'));

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
        <PortalNavigation
          activeAnalysisTab={tab}
          onAnalysisTabChange={setTab}
        />
        <AccessLegend />
      </aside>
      <section className={`${shell.content} ${styles.content}`}>
        <header>
          <div>
            <span className={styles.eyebrow}>
              ASSESSORIA ORIENTADA POR DADOS
            </span>
            <h1>Análise da empresa</h1>
            <p>
              Consulte seu painel de BI e a apresentação preparada pela Nalie.
            </p>
          </div>
          <div className={shell.filters}>
            <div className={shell.notificationWrap}>
              <button
                aria-label="Abrir notificações"
                className={shell.notificationButton}
                onClick={() => setRemindersOpen((open) => !open)}
              >
                🔔
                {notifications.length > 0 && (
                  <span>{notifications.length}</span>
                )}
              </button>
              {remindersOpen && (
                <div
                  className={shell.reminderPopover}
                  role="dialog"
                  aria-label="Notificações"
                >
                  <div>
                    <b>Notificações</b>
                    <button onClick={() => setRemindersOpen(false)}>×</button>
                  </div>
                  {notifications.map((notification) => (
                    <Link href={notification.href} key={notification.id}>
                      <span>{notification.icon}</span>
                      <p>
                        <b>{notification.title}</b>
                        <small>{notification.detail}</small>
                      </p>
                    </Link>
                  ))}
                  {notifications.length === 0 && (
                    <p className={shell.emptyNotifications}>
                      Nenhuma notificação no momento.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {tab !== 'conteudos' && (
          <section className={styles.contextBar}>
            <div>
              <small>Empresa</small>
              <b>{selectedCompany?.company ?? 'Selecione um cliente'}</b>
            </div>
            <div>
              <small>Período</small>
              <b>
                {financialSummary.ultima_movimentacao
                  ? new Intl.DateTimeFormat('pt-BR', {
                      month: 'long',
                      year: 'numeric',
                      timeZone: 'UTC',
                    }).format(
                      new Date(
                        `${financialSummary.ultima_movimentacao}T00:00:00Z`,
                      ),
                    )
                  : 'Sem dados importados'}
              </b>
            </div>
            <div>
              <small>Responsável</small>
              <b>Vanessa Rodrigues</b>
            </div>
            <div>
              <small>Status</small>
              <b className={styles.open}>
                {financialSummary.movimentacoes > 0
                  ? 'Dados disponíveis'
                  : 'Aguardando importação'}
              </b>
            </div>
          </section>
        )}

        {tab === 'visao' && (
          <>
            <section
              className={styles.periodFilters}
              aria-label="Período da análise financeira"
            >
              <div>
                <b>Período analisado</b>
                <small>Os valores abaixo vêm diretamente do banco.</small>
              </div>
              <label>
                De
                <input
                  type="date"
                  value={periodStart}
                  max={periodEnd}
                  onChange={(event) => setPeriodStart(event.target.value)}
                />
              </label>
              <label>
                Até
                <input
                  type="date"
                  value={periodEnd}
                  min={periodStart}
                  onChange={(event) => setPeriodEnd(event.target.value)}
                />
              </label>
            </section>
            <section
              className={styles.summaryGrid}
              aria-label="Resumo financeiro da empresa"
            >
              <article>
                <span>↗</span>
                <div>
                  <b>{currency.format(breakdown.totals.entradas)}</b>
                  <small>Entradas</small>
                </div>
              </article>
              <article>
                <span>↘</span>
                <div>
                  <b>{currency.format(breakdown.totals.saidas)}</b>
                  <small>Saídas</small>
                </div>
              </article>
              <article>
                <span>▣</span>
                <div>
                  <b>{currency.format(breakdown.totals.cartao)}</b>
                  <small>Lançamentos de cartão</small>
                </div>
              </article>
              <article>
                <span>◷</span>
                <div>
                  <b>{currency.format(breakdown.totals.parcelas_futuras)}</b>
                  <small>Parcelas futuras</small>
                </div>
              </article>
            </section>
            <section
              className={styles.financialDetails}
              aria-label="Detalhamento financeiro"
            >
              <article>
                <h2>Fluxo por mês</h2>
                {breakdown.monthly.length === 0 ? (
                  <p>Sem movimentações no período.</p>
                ) : (
                  breakdown.monthly.map((item) => (
                    <div className={styles.detailRow} key={item.month}>
                      <b>
                        {new Intl.DateTimeFormat('pt-BR', {
                          month: 'short',
                          year: 'numeric',
                          timeZone: 'UTC',
                        }).format(new Date(`${item.month}T00:00:00Z`))}
                      </b>
                      <span className={styles.income}>
                        ＋ {currency.format(item.entradas || 0)}
                      </span>
                      <span>− {currency.format(item.saidas || 0)}</span>
                    </div>
                  ))
                )}
              </article>
              <article>
                <h2>Saídas por categoria</h2>
                {breakdown.categories.length === 0 ? (
                  <p>Sem categorias no período.</p>
                ) : (
                  breakdown.categories.map((item) => (
                    <div className={styles.detailRow} key={item.name}>
                      <b>{item.name}</b>
                      <span>{currency.format(item.value)}</span>
                    </div>
                  ))
                )}
              </article>
              <article>
                <h2>Instituições</h2>
                {breakdown.institutions.length === 0 ? (
                  <p>Sem instituições no período.</p>
                ) : (
                  breakdown.institutions.map((item) => (
                    <div className={styles.detailRow} key={item.name}>
                      <b>{item.name}</b>
                      <small>{item.records} registros</small>
                      <span>{currency.format(item.value)}</span>
                    </div>
                  ))
                )}
              </article>
            </section>
            <section className={styles.overviewPanel}>
              <div>
                <span>LEITURA DO NEGÓCIO</span>
                <h2>Da informação à recomendação prática</h2>
                <p>
                  Consulte achados validados pela Nalie, entenda as
                  recomendações e acompanhe a evolução das ações definidas.
                </p>
              </div>
              <div className={styles.overviewSteps}>
                {workflowLinks.map(([icon, label, target], index) => (
                  <button key={target} onClick={() => setTab(target)}>
                    <span>{index + 1}</span>
                    <i>{icon}</i>
                    <b>{label}</b>
                    <em>→</em>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {tab === 'achados' && (
          <section className={styles.panel}>
            <div className={styles.panelTitle}>
              <div>
                <h2>Achados e hipóteses</h2>
                <p>
                  Cada conclusão deve manter sua evidência, impacto e estado de
                  validação.
                </p>
              </div>
              {canManageAnalysis && (
                <button onClick={() => setEditor('achado')}>
                  ＋ Novo achado
                </button>
              )}
            </div>
            {[...customFindings, ...findings].length === 0 && (
              <p>Nenhum achado cadastrado para esta empresa.</p>
            )}
            {[...customFindings, ...findings].map((item) => (
              <article className={styles.finding} key={item.title}>
                <span className={styles.findingIcon}>◇</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.evidence}</p>
                </div>
                <span className={styles.impact}>Impacto {item.impact}</span>
                <span className={styles.status}>{item.status}</span>
                <button
                  onClick={() => setNotice(`${item.title} aberto para edição.`)}
                >
                  Abrir →
                </button>
              </article>
            ))}
          </section>
        )}

        {tab === 'decisoes' && (
          <section className={styles.panel}>
            <div className={styles.panelTitle}>
              <div>
                <h2>Decisões e plano de ação</h2>
                <p>
                  Ligue cada decisão ao achado que a originou e acompanhe o
                  resultado.
                </p>
              </div>
              {canManageAnalysis && (
                <button onClick={() => setEditor('decisao')}>
                  ＋ Nova decisão
                </button>
              )}
            </div>
            <p>Nenhuma decisão cadastrada para esta empresa.</p>
          </section>
        )}

        {tab === 'historico' && (
          <section className={styles.panel}>
            <div className={styles.panelTitle}>
              <div>
                <h2>Histórico analítico</h2>
                <p>Registro cronológico das mudanças, validações e decisões.</p>
              </div>
            </div>
            {history.length === 0 && (
              <p>Nenhum histórico analítico cadastrado.</p>
            )}
            {history.map((row) => (
              <div className={styles.historyRow} key={row.join('-')}>
                <time>{row[0]}</time>
                <b>{row[1]}</b>
                <span>{row[2]}</span>
                <small>{row[3]}</small>
              </div>
            ))}
          </section>
        )}

        {tab === 'conteudos' && (
          <section className={styles.biWorkspace}>
            <div className={styles.biHeader}>
              <div>
                <h2>Business Intelligence do cliente</h2>
                <p>Conteúdo do cliente ou empresa selecionada.</p>
              </div>
              {canManageAnalysis ? (
                <label className={styles.companyFilter}>
                  Cliente ou empresa analisada
                  <select
                    aria-label="Cliente ou empresa analisada"
                    value={selectedCompanyId}
                    onChange={(event) =>
                      setSelectedCompanyId(event.target.value)
                    }
                  >
                    <option value="">Selecione um cliente ou empresa</option>
                    {analysisCompanies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.company}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <span className={styles.privateBadge}>
                  Conteúdo exclusivo da sua empresa
                </span>
              )}
            </div>
            {!selectedCompany ? (
              <div className={styles.biEmpty}>
                <span>📊</span>
                <h2>Selecione um cliente ou empresa</h2>
                <p>
                  Escolha acima quem deseja analisar para carregar o conteúdo
                  correspondente.
                </p>
              </div>
            ) : !canViewSelectedContent ? (
              <div className={styles.biEmpty}>
                <span>🔒</span>
                <h2>Conteúdo restrito</h2>
                <p>
                  Sua conta não possui a permissão “Análise · BI e
                  apresentações” para esta empresa.
                </p>
              </div>
            ) : (
              <>
                {selectedCompany.dashboardUrl ? (
                  <iframe
                    className={styles.biFrame}
                    src={embeddableUrl(selectedCompany.dashboardUrl)}
                    title={`BI de ${selectedCompany.company}`}
                    allowFullScreen
                  />
                ) : (
                  <div className={styles.biEmpty}>
                    <span>📊</span>
                    <h2>Seu painel está em produção</h2>
                    <p>
                      Assim que a análise for concluída, o BI será publicado
                      nesta área. Em caso de dúvidas, procure o seu consultor.
                    </p>
                  </div>
                )}
                <article className={styles.presentationPanel}>
                  <div>
                    <span>📑</span>
                    <h2>Apresentação incorporada</h2>
                    <p>
                      O link é configurado somente por você e publicado para a
                      empresa.
                    </p>
                  </div>
                  {selectedCompany.presentationUrl ? (
                    <iframe
                      className={styles.biFrame}
                      src={embeddableUrl(selectedCompany.presentationUrl)}
                      title={`Apresentação de ${selectedCompany.company}`}
                      allowFullScreen
                    />
                  ) : (
                    <div className={styles.presentationEmpty}>
                      <span>📑</span>
                      <h2>Sua apresentação está em produção</h2>
                      <p>
                        Assim que a análise for concluída, a apresentação será
                        publicada nesta área. Em caso de dúvidas, procure o seu
                        consultor.
                      </p>
                    </div>
                  )}
                </article>
                <article className={styles.excelPanel}>
                  <div>
                    <span>📗</span>
                    <div>
                      <h2>Planilhas em Excel</h2>
                      <p>Os arquivos ficam disponíveis somente como links.</p>
                    </div>
                  </div>
                  <div className={styles.excelLinks}>
                    {selectedCompany.excelUrl1 ? (
                      <a
                        href={selectedCompany.excelUrl1}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {selectedCompany.excelName1 || 'Excel 1'} ↗
                      </a>
                    ) : (
                      <span>Excel 1 · link ainda não configurado</span>
                    )}
                    {selectedCompany.excelUrl2 ? (
                      <a
                        href={selectedCompany.excelUrl2}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {selectedCompany.excelName2 || 'Excel 2'} ↗
                      </a>
                    ) : (
                      <span>Excel 2 · link ainda não configurado</span>
                    )}
                  </div>
                </article>
              </>
            )}
          </section>
        )}
        {editor && (
          <div className={styles.modalBackdrop} role="presentation">
            <form
              className={styles.modal}
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                const title = String(data.get('title'));
                if (editor === 'achado') {
                  setCustomFindings((current) => [
                    {
                      title,
                      evidence: String(data.get('detail')),
                      status: 'Em análise',
                      impact: String(data.get('impact')),
                    },
                    ...current,
                  ]);
                }
                setNotice(
                  `${editor === 'achado' ? 'Achado' : 'Decisão'} “${title}” salvo com sucesso.`,
                );
                setEditor(null);
              }}
            >
              <div className={styles.modalTitle}>
                <h2>
                  {editor === 'achado'
                    ? 'Novo achado ou hipótese'
                    : 'Nova decisão e ação'}
                </h2>
                <button type="button" onClick={() => setEditor(null)}>
                  ×
                </button>
              </div>
              <label>
                Título
                <input name="title" required autoFocus />
              </label>
              <label>
                {editor === 'achado' ? 'Evidência e fonte' : 'Ação definida'}
                <textarea name="detail" required />
              </label>
              <div className={styles.modalGrid}>
                <label>
                  Impacto
                  <select name="impact">
                    <option>Alto</option>
                    <option>Médio</option>
                    <option>Baixo</option>
                  </select>
                </label>
                <label>
                  Responsável
                  <input name="owner" defaultValue="Vanessa Rodrigues" />
                </label>
                <label>
                  Prazo
                  <input name="deadline" type="date" />
                </label>
              </div>
              <button type="submit" className={styles.saveButton}>
                Salvar registro
              </button>
            </form>
          </div>
        )}
        {notice && (
          <div className={styles.notice} role="status">
            ✓ {notice}
          </div>
        )}
      </section>
    </main>
  );
}
