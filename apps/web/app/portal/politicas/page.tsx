'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import AccessLegend from '../../components/access-legend';
import MenuToggle from '../../components/menu-toggle';
import shell from '../styles.module.css';
import styles from './styles.module.css';
import PortalNavigation from '../portal-navigation';
import CompanySwitcher, {
  SELECTED_COMPANY_EVENT,
  SELECTED_COMPANY_KEY,
} from '../../components/company-switcher';
import { useCurrentPagePermissions } from '../../components/page-permissions';
import { createClient } from '../../../lib/supabase/client';


export default function PoliciesPage() {
  const canEdit = useCurrentPagePermissions().includes('super');
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [version, setVersion] = useState('15/08/2026');
  const [introTitle, setIntroTitle] = useState(
    'Transparência e controle dos seus dados',
  );
  const [introText, setIntroText] = useState(
    'A NALIE utiliza as informações fornecidas pelo cliente exclusivamente para a prestação dos serviços contratados, incluindo organização, tratamento, análise, elaboração de indicadores, projeções e relatórios.',
  );
  const [customPolicy, setCustomPolicy] = useState('');
  const [policyDraft, setPolicyDraft] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [feedback, setFeedback] = useState('');
  const documentRef = useRef<HTMLElement>(null);
  useEffect(() => {
    async function load(requestedCompanyId?: string) {
      const selected =
        requestedCompanyId ||
        window.localStorage.getItem(SELECTED_COMPANY_KEY) ||
        '';
      setCompanyId(selected);
      if (!selected) return;
      try {
        const { data, error } = await createClient({ detectSessionInUrl: false })
          .from('company_settings')
          .select('policies')
          .eq('company_id', selected)
          .single();
        if (error) throw error;
        const policy = (data?.policies ?? {}) as {
          version?: string;
          introTitle?: string;
          introText?: string;
          policy?: string;
        };
        if (policy.version) setVersion(policy.version);
        if (policy.introTitle) setIntroTitle(policy.introTitle);
        if (policy.introText) setIntroText(policy.introText);
        setCustomPolicy(policy.policy ?? '');
        setFeedback('');
      } catch {
        setFeedback('Não foi possível carregar as políticas desta empresa.');
      }
    }
    const timer = window.setTimeout(() => void load(), 250);
    const changed = (event: Event) => {
      const id = (event as CustomEvent<{ companyId: string }>).detail?.companyId;
      void load(id);
    };
    window.addEventListener(SELECTED_COMPANY_EVENT, changed);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(SELECTED_COMPANY_EVENT, changed);
    };
  }, []);
  function openEditor() {
    setPolicyDraft(customPolicy || documentRef.current?.innerText || '');
    setEditing(true);
  }
  async function savePolicies(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const updated = {
      version: String(form.get('version')),
      introTitle: String(form.get('introTitle')),
      introText: String(form.get('introText')),
      policy: String(form.get('policy')),
    };
    if (!companyId) {
      setFeedback('Selecione uma empresa antes de salvar.');
      return;
    }
    setFeedback('Salvando…');
    try {
      const { error } = await createClient({ detectSessionInUrl: false })
        .from('company_settings')
        .update({
          policies: updated,
          updated_at: new Date().toISOString(),
        })
        .eq('company_id', companyId);
      if (error) throw error;
      setVersion(updated.version);
      setIntroTitle(updated.introTitle);
      setIntroText(updated.introText);
      setCustomPolicy(updated.policy);
      setEditing(false);
      setSaved(true);
      setFeedback('✓ Políticas salvas no Supabase para esta empresa.');
    } catch {
      setFeedback('Não foi possível salvar as políticas. Tente novamente.');
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
            <h1>Políticas e regras de uso</h1>
            <p>
              Condições de uso, responsabilidades, pagamentos e controle dos
              seus dados.
            </p>
          </div>
          <div className={shell.filters}>
            {canEdit && (
              <button onClick={openEditor}>Editar políticas e regras</button>
            )}
          </div>
        </header>
        {saved && (
          <p className={styles.savedNotice}>
            ✓ Políticas atualizadas. Versão {version}.
          </p>
        )}
        {feedback && <p className={styles.savedNotice} role="status">{feedback}</p>}
        {canEdit && editing && (
          <form className={styles.policyEditor} onSubmit={savePolicies}>
            <header>
              <div>
                <b>Editar políticas e regras de uso</b>
                <small>
                  O texto salvo passa a ser a versão apresentada na plataforma.
                </small>
              </div>
              <button type="button" onClick={() => setEditing(false)}>
                ×
              </button>
            </header>
            <div className={styles.editorGrid}>
              <label>
                Data da versão
                <input
                  name="version"
                  defaultValue={version}
                  placeholder="dd/mm/aaaa"
                />
              </label>
              <label>
                Título de abertura
                <input name="introTitle" defaultValue={introTitle} />
              </label>
              <label className={styles.fullField}>
                Texto de abertura
                <textarea name="introText" defaultValue={introText} />
              </label>
              <label className={styles.fullField}>
                Políticas e regras completas
                <textarea name="policy" defaultValue={policyDraft} />
              </label>
            </div>
            <footer>
              <button type="button" onClick={() => setEditing(false)}>
                Cancelar
              </button>
              <button>Salvar nova versão</button>
            </footer>
          </form>
        )}
        <section className={styles.intro}>
          <span>🛡️</span>
          <div>
            <h2>{introTitle}</h2>
            <p>{introText}</p>
            <small>Versão vigente · {version}</small>
          </div>
        </section>
        <div className={styles.layout}>
          <article className={styles.document} ref={documentRef}>
            {customPolicy ? (
              <section className={styles.customPolicy}>{customPolicy}</section>
            ) : (
              <>
                <section>
                  <h2>Transparência e controle dos seus dados</h2>
                  <ul>
                    <li>
                      O cliente pode solicitar uma cópia dos dados mantidos na
                      plataforma.
                    </li>
                    <li>
                      Solicitações de exportação serão processadas em até{' '}
                      <strong>72 horas</strong>, após a validação do pedido.
                    </li>
                    <li>
                      O cliente pode solicitar a exclusão de seus dados,
                      observados os prazos e obrigações legais aplicáveis.
                    </li>
                    <li>
                      Ações relevantes, como importações, alterações, downloads
                      e exclusões, poderão ser registradas para segurança e
                      auditoria.
                    </li>
                    <li>
                      Os dados do cliente não serão vendidos nem utilizados para
                      finalidades diferentes das previstas na prestação do
                      serviço.
                    </li>
                    <li>
                      O acesso às informações será restrito aos usuários
                      autorizados e às pessoas necessárias à execução do
                      serviço.
                    </li>
                  </ul>
                </section>
                <section>
                  <h2>Nossa responsabilidade</h2>
                  <p>
                    A NALIE é responsável por tratar e analisar os dados
                    disponibilizados pelo cliente dentro do{' '}
                    <strong>período e escopo contratados</strong>, mantendo
                    medidas adequadas de segurança e confidencialidade.
                  </p>
                  <p>
                    As análises, indicadores e projeções têm a finalidade de{' '}
                    <strong>apoiar a tomada de decisão</strong>. A decisão final
                    e sua execução permanecem sob responsabilidade do cliente.
                  </p>
                  <p>
                    Previsões e cenários são estimativas baseadas nos dados e
                    premissas disponíveis e, portanto,{' '}
                    <strong>
                      não representam garantia de resultados futuros
                    </strong>
                    .
                  </p>
                </section>
                <section>
                  <h2>Responsabilidade do cliente</h2>
                  <p>
                    É responsabilidade do cliente disponibilizar, dentro do
                    prazo combinado, os dados necessários para realização das
                    análises.
                  </p>
                  <p>
                    O cliente também é responsável pela{' '}
                    <strong>
                      origem, veracidade, integridade e autorização de uso das
                      informações fornecidas
                    </strong>
                    .
                  </p>
                  <p>
                    Dados incompletos, incorretos ou enviados fora do período
                    acordado podem comprometer ou atrasar a análise.
                  </p>
                </section>
                <section>
                  <h2>Período de análise e novos dados</h2>
                  <p>
                    Cada contratação corresponde a um{' '}
                    <strong>período específico de análise</strong>.
                  </p>
                  <p>
                    Os dados disponibilizados dentro desse período serão
                    processados conforme o serviço contratado. Informações
                    referentes a períodos posteriores ou enviadas após o
                    encerramento do ciclo contratado poderão ser consideradas{' '}
                    <strong>um novo período de processamento e análise</strong>,
                    sujeito à cobrança correspondente.
                  </p>
                  <p>
                    Isso evita uma situação como contratar janeiro, entregar
                    janeiro e, posteriormente, enviar fevereiro esperando que
                    esteja incluído no mesmo pagamento.
                  </p>
                </section>
                <section>
                  <h2>Pagamento</h2>
                  <p>
                    A cobrança é realizada <strong>antecipadamente</strong>,
                    antes do início de cada período de serviço.
                  </p>
                  <p>
                    O processamento e a análise começam após a confirmação do
                    pagamento e a disponibilização dos dados necessários pelo
                    cliente.
                  </p>
                  <p>
                    A ausência ou atraso no envio dos dados pelo cliente{' '}
                    <strong>
                      não transfere automaticamente o período contratado para
                      outro ciclo
                    </strong>
                    , salvo quando previamente acordado entre as partes.
                  </p>
                </section>
                <section>
                  <h2>Limites do serviço</h2>
                  <p>
                    A NALIE oferece{' '}
                    <strong>análise de dados e inteligência de negócios</strong>
                    . O serviço não substitui contabilidade, auditoria,
                    assessoria jurídica, consultoria tributária ou consultoria
                    de investimentos.
                  </p>
                </section>
                <section>
                  <h2>Pagamento e liberação do serviço</h2>
                  <p>
                    A NALIE trabalha com <strong>pagamento antecipado</strong>.
                    Cada pagamento corresponde ao período e aos serviços
                    definidos no plano contratado.
                  </p>
                  <p>
                    Após a confirmação do pagamento, o período é liberado para
                    recebimento dos dados, processamento e realização das
                    análises.
                  </p>
                </section>
                <section>
                  <h2>Responsabilidade pelo envio dos dados</h2>
                  <p>
                    É responsabilidade do cliente disponibilizar os dados e
                    documentos necessários para a análise dentro do período
                    contratado.
                  </p>
                  <p>
                    A NALIE realizará as análises com base nas informações
                    efetivamente fornecidas. A ausência, atraso ou insuficiência
                    de dados pode limitar os resultados e não gera
                    responsabilidade para a NALIE por análises que não puderam
                    ser realizadas.
                  </p>
                </section>
                <section>
                  <h2>Novos períodos e novos dados</h2>
                  <p>
                    O pagamento realizado cobre{' '}
                    <strong>somente o período contratado</strong>.
                  </p>
                  <p>
                    Dados referentes a um novo mês, período ou ciclo de análise
                    não são incluídos automaticamente no pagamento anterior.
                  </p>
                  <div className={styles.example}>
                    Pagamento → análise de janeiro → entrega e fechamento do
                    ciclo.
                    <br />
                    Dados de fevereiro → novo ciclo → novo pagamento →
                    processamento e análise.
                  </div>
                </section>
                <section>
                  <h2>Renovação</h2>
                  <p>
                    A continuidade do serviço depende da confirmação do
                    pagamento do próximo período.{' '}
                    <strong>
                      Sem a renovação, um novo ciclo de processamento e análise
                      não é iniciado.
                    </strong>
                  </p>
                  <p>
                    O cliente continuará acessando o histórico já contratado.
                    Após o vencimento, somente novas importações e novos
                    processamentos ficam suspensos até a renovação ou liberação
                    manual pela administradora.
                  </p>
                </section>
                <section>
                  <h2>Aceite, alterações e consentimento para cobranças</h2>
                  <p>
                    Ao confirmar a contratação de um plano ou serviço, o cliente
                    declara que leu, compreendeu e concorda com estas Políticas
                    e regras de uso e com as condições específicas apresentadas
                    na proposta ou no contrato.
                  </p>
                  <p>
                    A NALIE poderá atualizar estas políticas, as regras
                    operacionais, o escopo dos planos e os valores aplicáveis a
                    contratações ou renovações futuras, inclusive sem aviso
                    prévio individual. A versão vigente e sua data permanecerão
                    disponíveis na plataforma.
                  </p>
                  <p>
                    Uma alteração não autoriza cobrança automática ou
                    retroativa.
                    <strong>
                      {' '}
                      Nenhuma cobrança nova, adicional ou com valor alterado
                      será realizada sem a ciência e o consentimento expresso do
                      cliente.
                    </strong>
                  </p>
                </section>
              </>
            )}
          </article>
        </div>
      </section>
    </main>
  );
}
