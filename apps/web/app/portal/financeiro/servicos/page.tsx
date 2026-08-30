'use client';

import { FormEvent, useEffect, useState } from 'react';
import AccessLegend from '../../../components/access-legend';
import MenuToggle from '../../../components/menu-toggle';
import CompanySwitcher from '../../../components/company-switcher';
import PortalNavigation from '../../portal-navigation';
import shell from '../../styles.module.css';
import styles from './styles.module.css';
import { createClient } from '../../../../lib/supabase/client';

const initialPayments: string[][] = [];

export default function ServiceFinancePage() {
  const [payments, setPayments] = useState(initialPayments);
  const [nextPaymentId, setNextPaymentId] = useState<string | null>(null);
  const [nextPayment, setNextPayment] = useState({
    due: 'Não definido',
    value: 'Não definido',
    plan: 'Não definido',
    status: 'Sem cobrança cadastrada',
  });
  const [billingStatus, setBillingStatus] = useState({
    label: 'Sem cobrança cadastrada',
    detail: 'Nenhum pagamento registrado',
  });
  const [pixKey, setPixKey] = useState('Carregando…');
  const [copied, setCopied] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [paymentNotice, setPaymentNotice] = useState('');
  useEffect(() => {
    const update = (event?: Event) => {
      const value = (event as CustomEvent<string> | undefined)?.detail;
      if (value) setPixKey(value);
    };
    window.addEventListener('nalie-pix-updated', update);
    return () => window.removeEventListener('nalie-pix-updated', update);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadBilling() {
      try {
        const supabase = createClient({ detectSessionInUrl: false });
        const brandingResult = await supabase
          .from('site_branding')
          .select('pix_key')
          .eq('id', 'nalie-main')
          .maybeSingle();
        if (!active) return;
        setPixKey(
          brandingResult.data?.pix_key || 'Chave PIX não cadastrada',
        );
        const { data: companyId } = await supabase.rpc('current_company_id');
        if (!companyId) return;
        const paymentsResult = await supabase
          .from('service_payments')
          .select('id,service_name,amount,due_date,paid_at,payment_status')
          .eq('company_id', companyId)
          .order('due_date', { ascending: false });
        if (!active) return;
        if (paymentsResult.error) return;
        const currency = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        });
        const rows = paymentsResult.data ?? [];
        const paidPayments = rows
          .filter(
            (payment) =>
              payment.paid_at ||
              ['PAID', 'RECEIVED'].includes(payment.payment_status),
          )
          .sort((a, b) =>
            String(b.paid_at ?? b.due_date).localeCompare(
              String(a.paid_at ?? a.due_date),
            ),
          );
        const hasOverduePayment = rows.some(
          (payment) => !payment.paid_at && payment.payment_status === 'OVERDUE',
        );
        const latestPaid = paidPayments[0];
        setBillingStatus({
          label:
            rows.length === 0
              ? 'Sem cobrança cadastrada'
              : hasOverduePayment
                ? 'Pagamento pendente'
                : 'Em dia',
          detail: latestPaid
            ? `Último pagamento em ${new Date(
                `${latestPaid.due_date}T12:00:00`,
              ).toLocaleDateString('pt-BR')}`
            : 'Nenhum pagamento confirmado',
        });
        setPayments(
          rows.map((payment) => [
            new Date(`${payment.due_date}T12:00:00`).toLocaleDateString(
              'pt-BR',
            ),
            payment.service_name,
            currency.format(Number(payment.amount)),
            payment.payment_status === 'PAID' ||
            payment.payment_status === 'RECEIVED'
              ? 'Pago'
              : payment.payment_status === 'AWAITING_CONFIRMATION'
                ? 'Aguardando confirmação'
                : 'Pendente',
          ]),
        );
        const pending = [...rows]
          .reverse()
          .find(
            (payment) =>
              !payment.paid_at &&
              !['PAID', 'RECEIVED'].includes(payment.payment_status),
          );
        if (pending) {
          setNextPaymentId(pending.id);
          setNextPayment({
            due: new Date(`${pending.due_date}T12:00:00`).toLocaleDateString(
              'pt-BR',
            ),
            value: currency.format(Number(pending.amount)),
            plan: pending.service_name,
            status:
              pending.payment_status === 'AWAITING_CONFIRMATION'
                ? 'Aguardando confirmação'
                : 'Agendado',
          });
        }
      } catch {
        setPayments([]);
        setPixKey('Chave PIX não cadastrada');
      }
    }
    void loadBilling();
    return () => {
      active = false;
    };
  }, []);

  async function confirmPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nextPaymentId) {
      try {
        const supabase = createClient({ detectSessionInUrl: false });
        const { data: companyId } = await supabase.rpc('current_company_id');
        if (!companyId) throw new Error('Empresa não encontrada');
        let receiptPath: string | null = null;
        if (receiptFile) {
          const safeName = receiptFile.name.replace(/[^a-zA-Z0-9._-]/g, '-');
          receiptPath = `${companyId}/${nextPaymentId}/${crypto.randomUUID()}-${safeName}`;
          const { error: uploadError } = await supabase.storage
            .from('payment-receipts')
            .upload(receiptPath, receiptFile, {
              contentType: receiptFile.type,
              upsert: false,
            });
          if (uploadError) throw uploadError;
        }
        const { error } = await supabase.rpc(
          'submit_service_payment_confirmation',
          {
            target_payment_id: nextPaymentId,
            receipt_file_path: receiptPath,
          },
        );
        if (error) throw error;
        setNextPayment((current) => ({
          ...current,
          status: 'Aguardando confirmação',
        }));
      } catch {
        setPaymentNotice(
          'Não foi possível informar o pagamento. Tente novamente.',
        );
        return;
      }
    }
    setPaymentNotice(
      'Pagamento informado. A situação ficará como aguardando confirmação até a validação pela Nalie.',
    );
    setShowConfirmation(false);
    setReceiptFile(null);
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

      <section className={shell.content + ' ' + styles.content}>
        <header>
          <div>
            <span className={styles.eyebrow}>SERVIÇOS NALIE</span>
            <h1>Financeiro</h1>
            <p>Consulte seus pagamentos, vencimentos e histórico do serviço.</p>
          </div>
        </header>

        <section className={styles.summary} aria-label="Resumo do pagamento">
          <article>
            <span>Próximo pagamento</span>
            <strong>{nextPayment.due}</strong>
            <small>Próxima cobrança cadastrada</small>
          </article>
          <article>
            <span>Valor</span>
            <strong>{nextPayment.value}</strong>
            <small>{nextPayment.plan}</small>
          </article>
          <article>
            <span>Situação atual</span>
            <strong className={styles.paid}>{billingStatus.label}</strong>
            <small>{billingStatus.detail}</small>
          </article>
        </section>

        <section className={styles.nextPayment}>
          <div>
            <span>PRÓXIMA COBRANÇA</span>
            <h2>{nextPayment.plan}</h2>
            <p>
              {nextPaymentId
                ? `Vencimento em ${nextPayment.due} · ${nextPayment.value}`
                : 'Nenhuma cobrança futura cadastrada.'}
            </p>
          </div>
          <span className={styles.pending}>{nextPayment.status}</span>
        </section>

        <section className={styles.pixCard} aria-label="Pagamento por PIX">
          <div>
            <span>PAGAMENTO POR PIX</span>
            <h2>Copie a chave para realizar o pagamento</h2>
            <p>Favorecido: Nalie Business Intelligence</p>
          </div>
          <div className={styles.pixKey}>
            <code>{pixKey}</code>
            <button
              type="button"
              disabled={pixKey === 'Chave PIX não cadastrada'}
              onClick={async () => {
                await navigator.clipboard?.writeText(pixKey);
                setCopied(true);
              }}
            >
              {copied ? 'Chave copiada ✓' : 'Copiar chave PIX'}
            </button>
            <button type="button" onClick={() => setShowConfirmation(true)}>
              Já paguei
            </button>
          </div>
        </section>

        {showConfirmation && (
          <form
            className={styles.paymentConfirmation}
            onSubmit={(event) => void confirmPayment(event)}
          >
            <div>
              <h2>Informar pagamento</h2>
              <p>A Nalie confirmará o recebimento após conferir o pagamento.</p>
            </div>
            <label>
              Comprovante
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(event) =>
                  setReceiptFile(event.target.files?.[0] ?? null)
                }
              />
            </label>
            <div className={styles.confirmationActions}>
              <button type="button" onClick={() => setShowConfirmation(false)}>
                Cancelar
              </button>
              <button type="submit">Enviar para confirmação</button>
            </div>
          </form>
        )}
        {paymentNotice && (
          <p className={styles.paymentNotice} role="status">
            {paymentNotice}
          </p>
        )}

        <section className={styles.history}>
          <div className={styles.title}>
            <div>
              <h2>Histórico de pagamentos</h2>
              <p>Valores pagos à Nalie pelos serviços contratados.</p>
            </div>
          </div>
          <div
            className={styles.table}
            role="table"
            aria-label="Pagamentos à Nalie"
          >
            <div className={styles.tableHeader} role="row">
              <span>Data</span>
              <span>Referência</span>
              <span>Valor</span>
              <span>Situação</span>
            </div>
            {payments.map((payment) => (
              <div className={styles.row} role="row" key={payment[1]}>
                <span>{payment[0]}</span>
                <b>{payment[1]}</b>
                <span>{payment[2]}</span>
                <span className={styles.paidTag}>{payment[3]}</span>
              </div>
            ))}
          </div>
        </section>
        <p className={styles.help}>
          Dúvidas sobre valores ou vencimentos? Entre em contato com o seu
          consultor.
        </p>
      </section>
    </main>
  );
}
