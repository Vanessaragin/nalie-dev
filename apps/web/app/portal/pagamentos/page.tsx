'use client';

import { FormEvent, useEffect, useState } from 'react';
import AccessLegend from '../../components/access-legend';
import MenuToggle from '../../components/menu-toggle';
import shell from '../styles.module.css';
import styles from './styles.module.css';
import PortalNavigation from '../portal-navigation';
import CompanySwitcher from '../../components/company-switcher';
import {
  appendNaliePolicyToCsv,
  downloadTextFile,
} from '../../../lib/nalie-data-policy';
import { initialCrmData } from '../admin/crm/crm-data';
import { createClient } from '../../../lib/supabase/client';

type PaymentRow = {
  client: string;
  plan: string;
  due: string;
  value: number;
  status: string;
  importsBlocked: boolean;
  id?: string;
  companyId?: string;
  subscriptionId?: string | null;
  seriesKey?: string | null;
  receiptPath?: string | null;
};

const initialPayments: PaymentRow[] = [];

const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export default function PaymentsPage() {
  const [payments, setPayments] = useState(initialPayments);
  const [editFeedback, setEditFeedback] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [pixSaved, setPixSaved] = useState(false);
  const [period, setPeriod] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [clientFilter, setClientFilter] = useState('Todos');
  const [crmClients, setCrmClients] = useState(initialCrmData.clients);
  const [editor, setEditor] = useState<{
    index: number | null;
    series: boolean;
  } | null>(null);
  useEffect(() => {
    let active = true;
    async function loadBilling() {
      try {
        const supabase = createClient({ detectSessionInUrl: false });
        const [
          companiesResult,
          paymentsResult,
          subscriptionsResult,
          brandingResult,
        ] = await Promise.all([
          supabase
            .from('companies')
            .select('id,display_name,status')
            .eq('status', 'ACTIVE')
            .order('display_name'),
          supabase
            .from('service_payments')
            .select(
              'id,company_id,subscription_id,series_key,service_name,amount,due_date,paid_at,is_prelaunch,payment_status,confirmation_file_path',
            )
            .order('due_date', { ascending: false }),
          supabase
            .from('service_subscriptions')
            .select('id,company_id,imports_blocked'),
          supabase
            .from('site_branding')
            .select('pix_key')
            .eq('id', 'nalie-main')
            .maybeSingle(),
        ]);
        if (!active) return;
        if (brandingResult.data?.pix_key) {
          setPixKey(brandingResult.data.pix_key);
        } else if (brandingResult.error) {
          setEditFeedback('Não foi possível carregar a Chave PIX do banco.');
        }
        if (paymentsResult.error) {
          setEditFeedback('Não foi possível carregar as cobranças do banco.');
          return;
        }
        const companies = new Map(
          (companiesResult.data ?? []).map((company) => [company.id, company]),
        );
        const subscriptions = new Map(
          (subscriptionsResult.data ?? []).map((subscription) => [
            subscription.company_id,
            subscription,
          ]),
        );
        const labels: Record<string, string> = {
          PRELAUNCH: 'Pré-lançamento',
          PENDING: 'Pendente',
          DUE_SOON: 'Vence em breve',
          OVERDUE: 'Atrasado',
          AWAITING_CONFIRMATION: 'Aguardando confirmação',
          PAID: 'Pago',
          RECEIVED: 'Recebido',
        };
        setPayments(
          (paymentsResult.data ?? []).map((payment) => ({
            id: payment.id,
            companyId: payment.company_id,
            subscriptionId: payment.subscription_id,
            seriesKey: payment.series_key,
            receiptPath: payment.confirmation_file_path,
            client:
              companies.get(payment.company_id)?.display_name ??
              'Empresa não encontrada',
            plan: payment.service_name,
            due: payment.due_date,
            value: Number(payment.amount),
            status: labels[payment.payment_status] ?? 'Pendente',
            importsBlocked:
              subscriptions.get(payment.company_id)?.imports_blocked ?? false,
          })),
        );
        const template = initialCrmData.clients[0];
        setCrmClients(
          [...companies.values()].map((company) => ({
            ...template,
            id: `CLI-${company.id.slice(0, 8).toUpperCase()}`,
            companyId: company.id,
            name: company.display_name,
            company: company.display_name,
          })),
        );
      } catch {
        setPayments([]);
        setCrmClients([]);
      }
    }
    void loadBilling();
    return () => {
      active = false;
    };
  }, []);
  async function savePixKey() {
    try {
      const response = await fetch('/api/admin/site-branding', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pixKey }),
      });
      const result = (await response.json()) as {
        pixKey?: string;
        error?: string;
      };
      if (!response.ok || !result.pixKey) throw new Error(result.error);
      setPixKey(result.pixKey);
      window.dispatchEvent(
        new CustomEvent('nalie-pix-updated', { detail: result.pixKey }),
      );
      setPixSaved(true);
    } catch {
      setEditFeedback('A chave PIX não pôde ser gravada no banco.');
    }
  }
  function markPaid(index: number) {
    const payment = payments[index];
    setPayments((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, status: 'Pago', importsBlocked: false }
          : item,
      ),
    );
    if (payment.id)
      void (async () => {
        const supabase = createClient({ detectSessionInUrl: false });
        const { error } = await supabase
          .from('service_payments')
          .update({
            payment_status: 'PAID',
            paid_at: new Date().toISOString(),
          })
          .eq('id', payment.id);
        if (error) setEditFeedback('Não foi possível confirmar o pagamento.');
      })();
  }
  async function openReceipt(payment: PaymentRow) {
    if (!payment.receiptPath) return;
    try {
      const supabase = createClient({ detectSessionInUrl: false });
      const { data, error } = await supabase.storage
        .from('payment-receipts')
        .createSignedUrl(payment.receiptPath, 60);
      if (error || !data?.signedUrl) throw error;
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      setEditFeedback(
        `Comprovante de ${payment.client} aberto por link privado válido por 1 minuto.`,
      );
    } catch {
      setEditFeedback('Não foi possível abrir o comprovante desta cobrança.');
    }
  }
  function toggleImports(index: number) {
    const selectedPayment = payments[index];
    setPayments((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const importsBlocked = !item.importsBlocked;
        return { ...item, importsBlocked };
      }),
    );
    if (selectedPayment.companyId)
      void (async () => {
        const supabase = createClient({ detectSessionInUrl: false });
        const { error } = await supabase.rpc('set_company_import_access', {
          target_company_id: selectedPayment.companyId,
          allow_imports: selectedPayment.importsBlocked,
          reason: 'Alterado em Pagamentos dos serviços',
        });
        if (error)
          setEditFeedback('Não foi possível alterar o acesso às importações.');
      })();
  }
  function saveCharge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const edited = {
      client: String(data.get('client')),
      plan: String(data.get('plan')),
      due: String(data.get('due')),
      value: Number(data.get('value')),
      status: String(data.get('status')),
      importsBlocked:
        editor?.index === null
          ? false
          : payments[editor?.index ?? 0].importsBlocked,
    };
    if (editor?.index === null) {
      setPayments((current) => [edited, ...current]);
      setEditFeedback(`Nova cobrança criada para ${edited.client}.`);
    } else if (editor?.series) {
      const originalClient = payments[editor.index].client;
      setPayments((current) =>
        current.map((item) =>
          item.client === originalClient
            ? { ...item, plan: edited.plan, value: edited.value }
            : item,
        ),
      );
      setEditFeedback(
        `Valor e plano atualizados em toda a série de ${originalClient}.`,
      );
    } else {
      setPayments((current) =>
        current.map((item, index) => (index === editor?.index ? edited : item)),
      );
      setEditFeedback(`Cobrança de ${edited.client} atualizada.`);
    }
    const original =
      editor && editor.index !== null ? payments[editor.index] : null;
    const companyId =
      original?.companyId ??
      crmClients.find(
        (client) => (client.company || client.name) === edited.client,
      )?.companyId;
    if (companyId)
      void (async () => {
        try {
          const supabase = createClient({ detectSessionInUrl: false });
          const { data: authData } = await supabase.auth.getUser();
          const userId = authData.user?.id;
          if (!userId) throw new Error('Sessão inválida.');
          const statuses: Record<string, string> = {
            'Pré-lançamento': 'PRELAUNCH',
            Pendente: 'PENDING',
            'Vence em breve': 'DUE_SOON',
            Atrasado: 'OVERDUE',
            'Aguardando confirmação': 'AWAITING_CONFIRMATION',
            Pago: 'PAID',
            Recebido: 'RECEIVED',
          };
          if (!original?.id) {
            const { error } = await supabase.from('service_payments').insert({
              company_id: companyId,
              created_by: userId,
              service_name: edited.plan,
              amount: edited.value,
              due_date: edited.due,
              payment_status: statuses[edited.status] ?? 'PENDING',
              paid_at: ['Pago', 'Recebido'].includes(edited.status)
                ? new Date().toISOString()
                : null,
              is_prelaunch: edited.status === 'Pré-lançamento',
            });
            if (error) throw error;
          } else if (editor?.series && original.subscriptionId) {
            const [{ error: subscriptionError }, { error: paymentsError }] =
              await Promise.all([
                supabase
                  .from('service_subscriptions')
                  .update({ recurring_amount: edited.value })
                  .eq('id', original.subscriptionId),
                supabase
                  .from('service_payments')
                  .update({ service_name: edited.plan, amount: edited.value })
                  .eq('subscription_id', original.subscriptionId),
              ]);
            if (subscriptionError || paymentsError)
              throw subscriptionError ?? paymentsError;
          } else {
            const { error } = await supabase
              .from('service_payments')
              .update({
                service_name: edited.plan,
                amount: edited.value,
                due_date: edited.due,
                payment_status: statuses[edited.status] ?? 'PENDING',
                paid_at: ['Pago', 'Recebido'].includes(edited.status)
                  ? new Date().toISOString()
                  : null,
              })
              .eq('id', original.id);
            if (error) throw error;
          }
        } catch {
          setEditFeedback(
            'A alteração ficou visível nesta sessão, mas não foi gravada no banco.',
          );
        }
      })();
    setEditor(null);
  }
  function exportPayments() {
    const rows = [
      ['Cliente', 'Plano', 'Vencimento', 'Valor', 'Situação'],
      ...payments.map((item) => [
        item.client,
        item.plan,
        item.due,
        String(item.value),
        item.status,
      ]),
    ];
    const csv = appendNaliePolicyToCsv(
      `\uFEFF${rows.map((row) => row.join(';')).join('\r\n')}`,
      {
        clientName:
          clientFilter === 'Todos' ? 'Carteira de clientes' : clientFilter,
        clientId: clientFilter === 'Todos' ? 'NALIE-ADMIN' : undefined,
        processingId: `NALIE-COBRANCAS-${period.replace('-', '')}`,
        source: 'Cobranças por cliente no portal Nalie',
      },
    );
    downloadTextFile(csv, 'pagamentos-clientes.csv');
  }
  const filteredPayments = payments.filter(
    (item) =>
      (clientFilter === 'Todos' || item.client === clientFilter) &&
      item.due.startsWith(period),
  );
  const receivedPayments = filteredPayments.filter((item) =>
    ['Pago', 'Recebido'].includes(item.status),
  );
  const overduePayments = filteredPayments.filter(
    (item) => item.status === 'Atrasado',
  );
  const pendingPayments = filteredPayments.filter(
    (item) => !['Pago', 'Recebido'].includes(item.status),
  );
  const sumPayments = (items: PaymentRow[]) =>
    items.reduce((total, item) => total + item.value, 0);
  const activeClients = new Set(payments.map((item) => item.client)).size;
  const firstDue = [...payments].sort((a, b) => a.due.localeCompare(b.due))[0]
    ?.due;
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
            <h1>Pagamentos dos meus serviços</h1>
            <p>
              Controle cobranças, vencimentos e recebimentos de cada cliente.
            </p>
          </div>
          <div className={shell.filters}>
            <button
              className={shell.import}
              onClick={() => setEditor({ index: null, series: false })}
            >
              ＋ Nova cobrança
            </button>
          </div>
        </header>
        <section className={styles.pixSettings}>
          <div>
            <b>PIX para pagamento dos serviços</b>
            <small>
              Esta chave aparece para todos os clientes na página Financeiro.
            </small>
          </div>
          <label>
            Chave PIX
            <input
              value={pixKey}
              onChange={(event) => {
                setPixKey(event.target.value);
                setPixSaved(false);
              }}
              placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
            />
          </label>
          <button type="button" onClick={() => void savePixKey()}>
            Salvar chave
          </button>
          {pixSaved && <span role="status">✓ Chave PIX atualizada</span>}
        </section>
        <section className={styles.automation}>
          <span>⚡</span>
          <div className={styles.automationCopy}>
            <b>Automação ao criar uma empresa</b>
            <p>
              O tipo Pessoa ou Empresa, o valor individual e a frequência
              escolhida no cadastro geram automaticamente o pré-lançamento.
            </p>
            <div className={styles.ruleCopy}>
              <b>Vencimento não apaga o acesso ao histórico</b>
              <p>
                Após a data limite, os dois usuários continuam consultando os
                dados já processados, mas novas importações ficam suspensas.
                Somente você pode bloquear ou liberar a empresa.
              </p>
            </div>
          </div>
          <dl>
            <div>
              <dt>Cliente</dt>
              <dd>Pessoa ou Empresa</dd>
            </div>
            <div>
              <dt>Primeiro vencimento</dt>
              <dd>
                {firstDue
                  ? new Date(`${firstDue}T12:00:00`).toLocaleDateString('pt-BR')
                  : 'Nenhum'}
              </dd>
            </div>
            <div>
              <dt>Tipo da cobrança</dt>
              <dd>Semanal, quinzenal ou mensal</dd>
            </div>
          </dl>
        </section>
        <section className={styles.metrics}>
          <article>
            <small>Recebido no mês</small>
            <strong>{money.format(sumPayments(receivedPayments))}</strong>
            <span>{receivedPayments.length} pagamentos</span>
          </article>
          <article>
            <small>A receber</small>
            <strong>{money.format(sumPayments(pendingPayments))}</strong>
            <span>{pendingPayments.length} cobranças</span>
          </article>
          <article>
            <small>Em atraso</small>
            <strong>{money.format(sumPayments(overduePayments))}</strong>
            <span>
              {new Set(overduePayments.map((item) => item.client)).size}{' '}
              clientes
            </span>
          </article>
          <article>
            <small>Receita recorrente</small>
            <strong>{money.format(sumPayments(payments))}</strong>
            <span>{activeClients} clientes ativos</span>
          </article>
        </section>
        <section className={styles.payments}>
          <div className={styles.title}>
            <div>
              <b>Cobranças por cliente</b>
              <small>Planos, vencimentos e histórico dos seus serviços.</small>
            </div>
            <div className={styles.tableTools}>
              <label>
                Período
                <input
                  type="month"
                  value={period}
                  onChange={(event) => setPeriod(event.target.value)}
                  aria-label="Período das cobranças"
                />
              </label>
              <select
                value={clientFilter}
                onChange={(event) => setClientFilter(event.target.value)}
                aria-label="Filtrar cliente"
              >
                <option>Todos</option>
                {[...new Set(payments.map((item) => item.client))].map(
                  (client) => (
                    <option key={client}>{client}</option>
                  ),
                )}
              </select>
              <button onClick={exportPayments}>Exportar relatório ↓</button>
            </div>
          </div>
          {editor && (
            <form className={styles.chargeForm} onSubmit={saveCharge}>
              <div>
                <b>
                  {editor.index === null
                    ? 'Nova cobrança'
                    : editor.series
                      ? 'Editar série'
                      : 'Editar cobrança'}
                </b>
                <small>Altere o valor, vencimento, serviço e situação.</small>
              </div>
              <label>
                Cliente
                <select
                  name="client"
                  required
                  defaultValue={
                    editor.index === null ? '' : payments[editor.index].client
                  }
                >
                  <option value="" disabled>
                    Selecione o cliente
                  </option>
                  {crmClients.map((client) => (
                    <option
                      key={client.id}
                      value={client.company || client.name}
                    >
                      {client.company || 'Pessoa física'} · {client.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Serviço / plano
                <input
                  name="plan"
                  required
                  defaultValue={
                    editor.index === null ? '' : payments[editor.index].plan
                  }
                />
              </label>
              <label>
                Vencimento
                <input
                  name="due"
                  type="date"
                  required
                  defaultValue={
                    editor.index === null
                      ? `${period}-10`
                      : payments[editor.index].due
                  }
                />
              </label>
              <label>
                Valor
                <input
                  name="value"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  defaultValue={
                    editor.index === null ? '' : payments[editor.index].value
                  }
                />
              </label>
              <label>
                Situação
                <select
                  name="status"
                  defaultValue={
                    editor.index === null
                      ? 'Pendente'
                      : payments[editor.index].status
                  }
                >
                  <option>Pré-lançamento</option>
                  <option>Pendente</option>
                  <option>Vence em breve</option>
                  <option>Atrasado</option>
                  <option>Aguardando confirmação</option>
                  <option>Pago</option>
                  <option>Recebido</option>
                </select>
              </label>
              <div className={styles.formActions}>
                <button type="button" onClick={() => setEditor(null)}>
                  Cancelar
                </button>
                <button type="submit">Salvar</button>
              </div>
            </form>
          )}
          <div className={styles.tableHead}>
            <span>Cliente</span>
            <span>Serviço / plano</span>
            <span>Vencimento</span>
            <span>Valor</span>
            <span>Situação</span>
            <span>Ações</span>
          </div>
          {filteredPayments.map((payment) => {
            const index = payments.indexOf(payment);
            return (
              <div
                className={styles.row}
                key={`${payment.client}-${payment.due}`}
              >
                <b>{payment.client}</b>
                <span>{payment.plan}</span>
                <span>
                  {new Date(`${payment.due}T12:00:00`).toLocaleDateString(
                    'pt-BR',
                  )}
                </span>
                <strong>{money.format(payment.value)}</strong>
                <em
                  className={
                    styles[
                      payment.status === 'Pago' || payment.status === 'Recebido'
                        ? 'paid'
                        : payment.status === 'Atrasado'
                          ? 'late'
                          : 'pending'
                    ]
                  }
                >
                  {payment.status}
                </em>
                <div>
                  {payment.receiptPath && (
                    <button onClick={() => void openReceipt(payment)}>
                      Ver comprovante
                    </button>
                  )}
                  <button onClick={() => markPaid(index)}>
                    Marcar como pago
                  </button>
                  <button onClick={() => setEditor({ index, series: false })}>
                    Editar esta
                  </button>
                  <button onClick={() => setEditor({ index, series: true })}>
                    Editar série
                  </button>
                  <button aria-label={`Enviar cobrança para ${payment.client}`}>
                    WhatsApp
                  </button>
                  <button
                    className={
                      payment.importsBlocked ? styles.unlock : styles.block
                    }
                    onClick={() => toggleImports(index)}
                  >
                    {payment.importsBlocked
                      ? 'Liberar importações'
                      : 'Bloquear importações'}
                  </button>
                </div>
                <small className={styles.companyAccess}>
                  {payment.importsBlocked
                    ? 'Importações bloqueadas · afeta os 2 usuários'
                    : 'Importações liberadas para a empresa'}
                </small>
              </div>
            );
          })}
          {filteredPayments.length === 0 && (
            <p className={styles.emptyState}>
              Nenhuma cobrança encontrada neste cliente e período.
            </p>
          )}
          {editFeedback && (
            <p className={styles.editFeedback} role="status">
              {editFeedback}
            </p>
          )}
        </section>
      </section>
    </main>
  );
}
