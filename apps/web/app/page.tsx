'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '../lib/supabase/client';

const modules = [
  [
    '01',
    'Envie seus dados',
    'Planilhas, relatórios e arquivos em um ambiente organizado.',
  ],
  [
    '02',
    'Nós organizamos',
    'Conferência, tratamento e estruturação das informações.',
  ],
  [
    '03',
    'Transformamos em análise',
    'Indicadores claros para entender resultados e oportunidades.',
  ],
  [
    '04',
    'Você acompanha',
    'Power BI e apresentações sempre disponíveis no portal.',
  ],
];

const segments = [
  [
    '◇',
    'Clareza',
    'Informações organizadas para você enxergar o negócio por inteiro.',
  ],
  ['◎', 'Direção', 'Análises que mostram onde agir e o que acompanhar.'],
  [
    '↗',
    'Evolução',
    'Histórico e acompanhamento para decisões mais consistentes.',
  ],
];

function CashFlowChart() {
  return (
    <svg
      className="line-chart"
      viewBox="0 0 520 185"
      role="img"
      aria-label="Fluxo de caixa de janeiro a junho"
    >
      <defs>
        <linearGradient id="areaGreen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#78c49a" stopOpacity=".34" />
          <stop offset="1" stopColor="#78c49a" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="areaCoral" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f59482" stopOpacity=".25" />
          <stop offset="1" stopColor="#f59482" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[25, 65, 105, 145].map((y) => (
        <line key={y} x1="45" y1={y} x2="505" y2={y} stroke="#eceaf1" />
      ))}
      <path
        d="M45 135 C90 120 110 112 150 116 S220 105 255 116 S315 100 345 82 S400 102 425 58 S475 42 505 55 L505 160 L45 160Z"
        fill="url(#areaGreen)"
      />
      <path
        d="M45 144 C90 140 120 130 155 137 S220 140 255 132 S315 135 345 140 S405 150 425 122 S475 95 505 105 L505 160 L45 160Z"
        fill="url(#areaCoral)"
      />
      <path
        d="M45 135 C90 120 110 112 150 116 S220 105 255 116 S315 100 345 82 S400 102 425 58 S475 42 505 55"
        fill="none"
        stroke="#67b88a"
        strokeWidth="3"
      />
      <path
        d="M45 144 C90 140 120 130 155 137 S220 140 255 132 S315 135 345 140 S405 150 425 122 S475 95 505 105"
        fill="none"
        stroke="#f18479"
        strokeWidth="3"
      />
      <path
        d="M45 149 C90 148 120 157 155 155 S220 154 255 153 S315 158 345 162 S405 166 425 148 S475 100 505 112"
        fill="none"
        stroke="#8f7ddd"
        strokeWidth="3"
      />
      {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'].map((m, i) => (
        <text key={m} x={45 + i * 92} y="180" fontSize="12" fill="#777287">
          {m}
        </text>
      ))}
    </svg>
  );
}

function DonutChart() {
  return (
    <div className="donut-wrap">
      <div className="donut" role="img" aria-label="Despesas por categoria" />
      <ul>
        <li>
          <i className="dot purple" />
          Mão de obra <b>31%</b>
        </li>
        <li>
          <i className="dot coral" />
          Fornecedores <b>24%</b>
        </li>
        <li>
          <i className="dot blue-dot" />
          Taxas/Plataformas <b>11%</b>
        </li>
        <li>
          <i className="dot sand" />
          Estrutura <b>9%</b>
        </li>
        <li>
          <i className="dot mint-dot" />
          Marketing <b>6%</b>
        </li>
        <li>
          <i className="dot gray" />
          Outros <b>19%</b>
        </li>
      </ul>
    </div>
  );
}

export default function Home() {
  const [whatsAppUrl, setWhatsAppUrl] = useState(
    'https://wa.me/5511999990020?text=Olá%2C%20gostaria%20de%20conhecer%20melhor%20a%20Nalie.',
  );

  useEffect(() => {
    try {
      void createClient({ detectSessionInUrl: false })
        .from('site_branding')
        .select('specialist_url')
        .eq('id', 'nalie-main')
        .single()
        .then(({ data }) => {
          if (data?.specialist_url) setWhatsAppUrl(data.specialist_url);
        });
    } catch {
      // Mantém o link empacotado quando o Supabase não está disponível.
    }
  }, []);

  return (
    <main className="page">
      <header className="topbar">
        <div className="brand" aria-label="Nalie Inteligência Financeira">
          <span className="brand-mark">N</span>
          <span>
            <strong>NALIE</strong>
            <small>BUSINESS INTELLIGENCE</small>
          </span>
        </div>
        <div className="nav-actions">
          <Link className="login" href="/login">
            Entrar
          </Link>
        </div>
      </header>

      <section className="hero-new" id="inicio">
        <div className="hero-message">
          <h1>
            Seus números precisam
            <br />
            <em>fazer sentido.</em>
          </h1>
          <p>
            Organização e análise das suas informações financeiras para ajudar
            você a entender o que entra, o que sai, onde está gastando e o que
            precisa de atenção. Para quem precisa colocar as finanças em ordem,
            entender melhor os próprios números ou ter uma visão mais clara de
            um pequeno negócio.
          </p>
          <div className="benefits">
            <span>
              ✓ <b>Dados organizados</b>
              <small>em um só lugar</small>
            </span>
            <span>
              ✓ <b>Análises claras</b>
              <small>para o seu negócio</small>
            </span>
            <span>
              ✓ <b>Visão contínua</b>
              <small>em BI e apresentações</small>
            </span>
          </div>
          <div className="hero-actions">
            <a
              href={whatsAppUrl}
              className="cta"
              target="_blank"
              rel="noreferrer"
            >
              Falar com um especialista <b>→</b>
            </a>
            <a href="#funcionalidades" className="secondary">
              Como funciona
            </a>
          </div>
          <small className="secure">
            Atendimento próximo, análise personalizada e informações seguras.
          </small>
        </div>

        <div className="dashboard" id="painel">
          <div className="security-badge">
            <span>♢</span>
            <div>
              <b>Visão clara do negócio</b>
              <small>Dados organizados • análises acessíveis</small>
            </div>
          </div>
          <div className="dashboard-head">
            <h2>Visão do negócio</h2>
            <span className="period">Atualização mais recente</span>
          </div>
          <div className="kpis">
            <article>
              <small>Receita</small>
              <strong>R$ 128.450</strong>
              <em>↑ 12,4%</em>
            </article>
            <article>
              <small>Lucro líquido</small>
              <strong>R$ 21.780</strong>
              <em>↑ 8,7%</em>
            </article>
            <article>
              <small>Margem</small>
              <strong>16,9%</strong>
              <em>↑ 2,1 p.p.</em>
            </article>
            <article>
              <small>Disponível</small>
              <strong>R$ 18.920</strong>
              <em>Estável</em>
            </article>
          </div>
          <div className="charts">
            <article className="chart-card">
              <header>
                <b>Fluxo de caixa</b>
                <span>
                  <i className="dot mint-dot" />
                  Entradas <i className="dot coral" />
                  Saídas <i className="dot purple" />
                  Saldo
                </span>
              </header>
              <CashFlowChart />
            </article>
            <article className="chart-card">
              <header>
                <b>Despesas por categoria</b>
              </header>
              <DonutChart />
            </article>
          </div>
        </div>
      </section>

      <section className="module-strip" id="funcionalidades">
        <header className="section-heading">
          <small>COMO FUNCIONA</small>
          <h2>Um processo simples</h2>
          <p>
            Você envia as informações. A Nalie transforma dados em uma visão
            clara para decidir melhor.
          </p>
        </header>
        {modules.map(([icon, title, desc]) => (
          <article key={title}>
            <span>{icon}</span>
            <b>{title}</b>
            <small>{desc}</small>
          </article>
        ))}
      </section>

      <section className="segment-strip" id="segmentos">
        <div className="segment-title">
          <small>O QUE MUDA</small>
          <h2>Dados que ajudam a enxergar melhor os resultados.</h2>
        </div>
        {segments.map(([icon, title, desc]) => (
          <article key={title}>
            <span>{icon}</span>
            <div>
              <b>{title}</b>
              <p>{desc}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="capabilities" id="solucao">
        <header className="section-heading">
          <small>ENTREGAS</small>
          <h2>Informação pronta para ser usada</h2>
          <p>
            Acesse no portal as análises e os materiais preparados para a sua
            empresa.
          </p>
        </header>
        <article>
          <span>▦</span>
          <b>Power BI incorporado</b>
          <p>Indicadores e gráficos reunidos em uma visão interativa.</p>
        </article>
        <article>
          <span>▤</span>
          <b>Apresentações</b>
          <p>
            Materiais em PowerPoint ou Google para apoiar reuniões e decisões.
          </p>
        </article>
        <article>
          <span>⇅</span>
          <b>Importação e exportação</b>
          <p>Envio das bases e exportação do compilado completo do cliente.</p>
        </article>
        <article>
          <span>◷</span>
          <b>Histórico organizado</b>
          <p>Atualizações e materiais preservados por cliente e período.</p>
        </article>
        <article>
          <span>♧</span>
          <b>Consultoria próxima</b>
          <p>
            Dúvidas, leituras e próximos passos acompanhados pela consultora.
          </p>
        </article>
        <div className="proof-row">
          <article>
            <span>♢</span>
            <div>
              <b>100% seguro</b>
              <p>
                Seus dados protegidos com criptografia e controle de acesso.
              </p>
            </div>
          </article>
          <article>
            <span>♧</span>
            <div>
              <b>+10 formatos</b>
              <p>CSV, Excel, OFX, TXT, JSON e muito mais.</p>
            </div>
          </article>
          <article>
            <span>▦</span>
            <div>
              <b>Diversos bancos</b>
              <p>
                Trabalhamos com arquivos e informações de diferentes bancos.
              </p>
            </div>
          </article>
          <article>
            <span>☆</span>
            <div>
              <b>Decisões melhores</b>
              <p>Mais clareza, menos achismo e resultados consistentes.</p>
            </div>
          </article>
        </div>
      </section>

      <section className="coverage" aria-labelledby="coverage-title">
        <div className="coverage-copy">
          <h2 id="coverage-title">
            Atendimento no Brasil e nos Estados Unidos
          </h2>
          <p>
            Suporte próximo, humano e especializado para ajudar você a focar no
            que realmente importa: o seu negócio.
          </p>
        </div>
        <div className="coverage-grid">
          <article className="country">
            <span className="flag-circle">🇧🇷</span>
            <div>
              <h3>Brasil</h3>
              <p>
                Atendimento em português, com especialistas que entendem a
                realidade do seu mercado.
              </p>
            </div>
            <ul>
              <li>Suporte dedicado para clientes brasileiros</li>
              <li>Comunicação clara e prática no seu idioma</li>
              <li>Conhecimento das particularidades do Brasil</li>
              <li>Ambiente em conformidade com a LGPD</li>
            </ul>
          </article>
          <div
            className="world-map"
            role="img"
            aria-label="Mapa de atendimento entre Brasil e Estados Unidos"
          >
            <div className="land one" />
            <div className="land two" />
            <div className="land three" />
            <svg viewBox="0 0 500 245" aria-hidden="true">
              <path className="route" d="M100 170 Q225 55 390 85" />
              <circle className="br-circle" cx="100" cy="170" r="9" />
              <circle className="us-circle" cx="390" cy="85" r="9" />
            </svg>
          </div>
          <article className="country">
            <span className="flag-circle">🇺🇸</span>
            <div>
              <h3>Estados Unidos</h3>
              <p>
                Atendimento em português para empresários brasileiros nos EUA e
                negócios americanos.
              </p>
            </div>
            <ul>
              <li>Suporte especializado para clientes nos EUA</li>
              <li>Comunicação transparente em português</li>
              <li>Entendimento das práticas e bancos locais</li>
              <li>Ambiente seguro com padrões internacionais</li>
            </ul>
          </article>
        </div>
        <div className="support-bar">
          <span>🎧</span>
          <div>
            <b>Você nunca estará sozinho.</b>
            <p>
              Estamos ao seu lado para transformar dados em decisões melhores,
              em qualquer lugar.
            </p>
          </div>
          <ul>
            <li>
              ♢{' '}
              <small>
                Dados protegidos
                <br />
                em qualquer país
              </small>
            </li>
            <li>
              ☵{' '}
              <small>
                Suporte dedicado
                <br />e contínuo
              </small>
            </li>
            <li>
              ♙{' '}
              <small>
                Relacionamento
                <br />
                de longo prazo
              </small>
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
