'use client';

import { FormEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import AccessLegend from '../../components/access-legend';
import MenuToggle from '../../components/menu-toggle';
import shell from '../styles.module.css';
import styles from './styles.module.css';
import PortalNavigation from '../portal-navigation';
import CompanySwitcher from '../../components/company-switcher';
import { useCurrentPagePermissions } from '../../components/page-permissions';
import { NALIE_PROFILE_PHOTO } from '../../components/fixed-profile-photo';
import { createClient } from '../../../lib/supabase/client';

const profileDefaults = {
  name: 'Vanessa Rodrigues',
  role: 'FUNDADORA · ESTRATEGISTA DE NEGÓCIOS',
  bio: 'Ajudo pequenos negócios a transformar informações financeiras em decisões mais claras, seguras e estratégicas.',
  proposalTitle: 'Clareza para decidir. Estratégia para crescer.',
  proposal:
    'Minha proposta é apoiar empresários na organização e interpretação dos números do negócio, transformando dados dispersos em uma visão simples e prática. O trabalho combina análise financeira, acompanhamento próximo e recomendações aplicáveis à realidade de cada empresa.\n\nEste é um texto provisório. Depois, ele poderá ser substituído pela sua história, sua experiência, seu método de trabalho e pela mensagem que deseja transmitir aos seus clientes.',
  quote:
    'Cada número conta uma história. Meu trabalho é ajudar você a entendê-la e usá-la para construir resultados melhores.',
  email: 'contato@nalie.com',
  whatsapp: 'Adicionar número de contato',
  linkedin: 'Adicionar perfil no Instagram',
  location: 'Brasil e Estados Unidos',
  services:
    'Organização financeira — Estruturação de dados, contas, categorias e rotinas para uma visão confiável do negócio.\nAnálise e diagnóstico — Leitura dos indicadores, identificação de riscos e oportunidades e orientação para decisões.\nPlanejamento estratégico — Metas, cenários, prioridades e plano de ação acompanhados de forma prática.\nAcompanhamento empresarial — Reuniões periódicas, revisão de resultados e recomendações adaptadas à realidade da empresa.',
};

export default function AboutPage() {
  const canEdit = useCurrentPagePermissions().includes('super');
  const [data, setData] = useState(profileDefaults);
  const [photoUrl, setPhotoUrl] = useState(NALIE_PROFILE_PHOTO);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showContactOptions, setShowContactOptions] = useState(false);
  useEffect(() => {
    try {
      void createClient()
        .from('site_branding')
        .select('profile, photo_url')
        .eq('id', 'nalie-main')
        .single()
        .then(({ data: branding }) => {
          if (branding?.profile)
            setData({
              ...profileDefaults,
              ...(branding.profile as typeof profileDefaults),
            });
          if (branding?.photo_url) setPhotoUrl(branding.photo_url);
        });
    } catch {
      // Mantém os dados empacotados quando o Supabase não está disponível.
    }
  }, []);
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const updated = Object.fromEntries(
      Object.keys(profileDefaults).map((key) => [
        key,
        String(form.get(key) ?? ''),
      ]),
    ) as typeof profileDefaults;
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const phone = updated.whatsapp.replace(/\D/g, '');
    const { error } = await supabase
      .from('site_branding')
      .update({
        profile: updated,
        specialist_url:
          phone.length >= 10
            ? `https://wa.me/${phone}?text=${encodeURIComponent('Olá, gostaria de conhecer melhor a Nalie.')}`
            : undefined,
        updated_by: authData.user?.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 'nalie-main');
    if (error) return;
    setData(updated);
    setEditing(false);
    setSaved(true);
  }
  const services = data.services.split('\n').filter(Boolean);
  const emailUrl = `mailto:${data.email}?subject=${encodeURIComponent('Contato pelo portal Nalie')}`;
  const phoneDigits = data.whatsapp.replace(/\D/g, '');
  const whatsappNumber =
    phoneDigits.length >= 10 && phoneDigits.length <= 11
      ? `55${phoneDigits}`
      : phoneDigits;
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Olá, gostaria de conversar sobre o meu negócio.')}`;
  const instagramHandle = data.linkedin
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/$/, '');
  const instagramUrl = `https://www.instagram.com/${instagramHandle}`;
  const hasWhatsapp = whatsappNumber.length >= 12;
  const hasInstagram = Boolean(
    instagramHandle && !/adicionar perfil/i.test(data.linkedin),
  );
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
            <h1>Sobre mim e contatos</h1>
            <p>
              Conheça a profissional por trás da Nalie e saiba como entrar em
              contato.
            </p>
          </div>
          <div className={shell.filters}>
            {canEdit && (
              <button className={shell.import} onClick={() => setEditing(true)}>
                Editar informações
              </button>
            )}
          </div>
        </header>
        {saved && <p className={styles.savedNotice}>✓ Informações salvas.</p>}
        {canEdit && editing && (
          <form className={styles.editor} onSubmit={saveProfile}>
            <header>
              <div>
                <b>Editar meus dados</b>
                <small>Todos os campos abaixo aparecerão nesta página.</small>
              </div>
              <button type="button" onClick={() => setEditing(false)}>
                ×
              </button>
            </header>
            <div className={styles.editorGrid}>
              <label>
                Nome
                <input name="name" defaultValue={data.name} />
              </label>
              <label>
                Cargo / título
                <input name="role" defaultValue={data.role} />
              </label>
              <label>
                E-mail
                <input name="email" type="email" defaultValue={data.email} />
              </label>
              <label>
                WhatsApp
                <input name="whatsapp" defaultValue={data.whatsapp} />
              </label>
              <label>
                Instagram
                <input name="linkedin" defaultValue={data.linkedin} />
              </label>
              <label>
                Local de atendimento
                <input name="location" defaultValue={data.location} />
              </label>
              <label className={styles.fullField}>
                Bio
                <textarea name="bio" defaultValue={data.bio} />
              </label>
              <label className={styles.fullField}>
                Título da proposta
                <input name="proposalTitle" defaultValue={data.proposalTitle} />
              </label>
              <label className={styles.fullField}>
                Proposta de trabalho
                <textarea name="proposal" defaultValue={data.proposal} />
              </label>
              <label className={styles.fullField}>
                Frase de destaque
                <textarea name="quote" defaultValue={data.quote} />
              </label>
              <label className={styles.fullField}>
                Serviços — um por linha
                <textarea name="services" defaultValue={data.services} />
              </label>
            </div>
            <footer>
              <button type="button" onClick={() => setEditing(false)}>
                Cancelar
              </button>
              <button>Salvar alterações</button>
            </footer>
          </form>
        )}
        <section className={styles.hero}>
          <div className={styles.photo}>
            <Image
              src={photoUrl}
              alt="Foto de Vanessa Rodrigues"
              width={420}
              height={520}
              unoptimized
            />
            {canEdit && (
              <label>
                Alterar foto oficial
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    void (async () => {
                      const supabase = createClient();
                      const extension = file.name.split('.').pop() ?? 'jpeg';
                      const path = `official/vanessa-profile.${extension}`;
                      const { error: uploadError } = await supabase.storage
                        .from('brand-assets')
                        .upload(path, file, {
                          upsert: true,
                          contentType: file.type,
                        });
                      if (uploadError) return;
                      const { data: publicFile } = supabase.storage
                        .from('brand-assets')
                        .getPublicUrl(path);
                      const nextPhoto = `${publicFile.publicUrl}?v=${Date.now()}`;
                      const { data: authData } = await supabase.auth.getUser();
                      const { error: updateError } = await supabase
                        .from('site_branding')
                        .update({
                          photo_url: nextPhoto,
                          updated_by: authData.user?.id,
                          updated_at: new Date().toISOString(),
                        })
                        .eq('id', 'nalie-main');
                      if (!updateError) setPhotoUrl(nextPhoto);
                    })();
                  }}
                />
              </label>
            )}
          </div>
          <div className={styles.intro}>
            <small>{data.role}</small>
            <h2>{data.name}</h2>
            <p>{data.bio}</p>
            <div>
              <span>Brasil</span>
              <span>Estados Unidos</span>
              <span>Atendimento personalizado</span>
            </div>
          </div>
        </section>
        <section className={styles.columns}>
          <article>
            <span>COMO A NALIE TRABALHA</span>
            <h3>{data.proposalTitle}</h3>
            {data.proposal.split('\n\n').map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <blockquote>“{data.quote}”</blockquote>
          </article>
          <aside>
            <span>FALE COMIGO</span>
            <h3>Vamos conversar sobre o seu negócio?</h3>
            <ul>
              <li>
                <i>✉</i>
                <p>
                  <b>E-mail</b>
                  <small>{data.email}</small>
                </p>
              </li>
              <li>
                <i>◉</i>
                <p>
                  <b>WhatsApp</b>
                  <small>{data.whatsapp}</small>
                </p>
              </li>
              <li>
                <i>◎</i>
                <p>
                  <b>Instagram</b>
                  <small>{data.linkedin}</small>
                </p>
              </li>
              <li>
                <i>⌖</i>
                <p>
                  <b>Atendimento</b>
                  <small>{data.location}</small>
                </p>
              </li>
            </ul>
            <button
              type="button"
              onClick={() => setShowContactOptions((current) => !current)}
              aria-expanded={showContactOptions}
            >
              Enviar uma mensagem →
            </button>
            {showContactOptions && (
              <div className={styles.contactOptions}>
                <a href={emailUrl}>✉ Enviar por e-mail</a>
                {hasWhatsapp && (
                  <a href={whatsappUrl} target="_blank" rel="noreferrer">
                    ◉ Enviar pelo WhatsApp
                  </a>
                )}
                {hasInstagram && (
                  <a href={instagramUrl} target="_blank" rel="noreferrer">
                    ◎ Abrir conversa no Instagram
                  </a>
                )}
              </div>
            )}
          </aside>
        </section>
        <section className={styles.services}>
          <div className={styles.sectionTitle}>
            <span>MEUS SERVIÇOS</span>
            <h3>Como posso apoiar cada empresa</h3>
            <p>Descrições institucionais sem apresentação de valores.</p>
          </div>
          <div className={styles.serviceGrid}>
            {services.map((service, index) => {
              const [title, description = ''] = service.split(' — ');
              return (
                <article key={service}>
                  <span>{['📊', '🔎', '🗺️', '🤝'][index % 4]}</span>
                  <b>{title}</b>
                  <p>{description}</p>
                </article>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}
