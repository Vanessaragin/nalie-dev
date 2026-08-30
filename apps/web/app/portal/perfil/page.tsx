'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import FixedProfilePhoto from '../../components/fixed-profile-photo';
import { createClient } from '../../../lib/supabase/client';
import shell from '../styles.module.css';
import styles from './styles.module.css';

type ProfileForm = {
  full_name: string;
  phone: string;
  job_title: string;
  preferred_locale: string;
  timezone_name: string;
  professional_whatsapp: string;
  public_email: string;
  instagram_handle: string;
  facebook_url: string;
  website_url: string;
  professional_address: string;
};

const emptyProfile: ProfileForm = {
  full_name: '',
  phone: '',
  job_title: '',
  preferred_locale: 'pt-BR',
  timezone_name: 'America/Sao_Paulo',
  professional_whatsapp: '',
  public_email: '',
  instagram_handle: '',
  facebook_url: '',
  website_url: '',
  professional_address: '',
};

export default function ProfilePage() {
  const [profile, setProfile] = useState(emptyProfile);
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('Administração Nalie');
  const [level, setLevel] = useState('Usuário');
  const [lastLogin, setLastLogin] = useState('Não informado');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient({ detectSessionInUrl: false });
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) throw authError;
        setEmail(authData.user.email ?? '');
        setLastLogin(
          authData.user.last_sign_in_at
            ? new Intl.DateTimeFormat('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short',
              }).format(new Date(authData.user.last_sign_in_at))
            : 'Primeiro acesso',
        );
        const [{ data: profileData, error: profileError }, { data: memberships }] =
          await Promise.all([
            supabase
              .from('profiles')
              .select(
                'full_name,display_name,phone,job_title,preferred_locale,timezone_name,professional_whatsapp,public_email,instagram_handle,facebook_url,website_url,professional_address',
              )
              .eq('id', authData.user.id)
              .single(),
            supabase
              .from('company_users')
              .select('access_level,companies(display_name),roles(code)')
              .eq('profile_id', authData.user.id)
              .eq('status', 'ACTIVE')
              .limit(1),
          ]);
        if (profileError) throw profileError;
        setProfile({
          ...emptyProfile,
          ...profileData,
          full_name: profileData.full_name || profileData.display_name || '',
        });
        const membership = memberships?.[0] as
          | {
              access_level?: string;
              companies?: { display_name?: string } | { display_name?: string }[];
              roles?: { code?: string } | { code?: string }[];
            }
          | undefined;
        const linkedCompany = Array.isArray(membership?.companies)
          ? membership?.companies[0]
          : membership?.companies;
        const linkedRole = Array.isArray(membership?.roles)
          ? membership?.roles[0]
          : membership?.roles;
        if (linkedCompany?.display_name) setCompany(linkedCompany.display_name);
        setLevel(
          linkedRole?.code === 'SUPER_ADMIN'
            ? 'Administradora Geral'
            : membership?.access_level === 'COMPLETE'
              ? 'Acesso completo'
              : membership?.access_level === 'BLOCKED'
                ? 'Acesso bloqueado'
                : 'Acesso limitado',
        );
      } catch {
        setFeedback('Não foi possível carregar o perfil. Atualize a página.');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  function change<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
    setFeedback('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback('Salvando…');
    try {
      const supabase = createClient({ detectSessionInUrl: false });
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error('Sessão inválida');
      const { error } = await supabase
        .from('profiles')
        .update({
          ...profile,
          display_name: profile.full_name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', authData.user.id);
      if (error) throw error;
      setFeedback('✓ Perfil atualizado no Supabase');
    } catch {
      setFeedback('Não foi possível salvar o perfil. Tente novamente.');
    }
  }

  return (
    <main className={styles.page}>
      <header><Link href="/portal/configuracoes">← Voltar para configurações</Link></header>
      <section className={styles.heading}>
        <FixedProfilePhoto className={styles.avatar} />
        <div><span>PERFIL DO USUÁRIO</span><h1>Meu perfil</h1><p>Seus dados pessoais são separados dos dados da empresa.</p></div>
      </section>
      <div className={styles.grid}>
        <form className={styles.card} onSubmit={save}>
          <h2>Dados pessoais</h2>
          {loading ? <p>Carregando dados do perfil…</p> : (
            <>
              <div className={styles.fields}>
                <label>Nome completo<input value={profile.full_name} onChange={(e) => change('full_name', e.target.value)} required /></label>
                <label>E-mail de acesso<input value={email} type="email" readOnly title="A alteração do e-mail de acesso exige confirmação de segurança." /></label>
                <label>Telefone / WhatsApp<input value={profile.phone} onChange={(e) => change('phone', e.target.value)} type="tel" /></label>
                <label>Cargo<input value={profile.job_title} onChange={(e) => change('job_title', e.target.value)} /></label>
                <label>Idioma preferido<select value={profile.preferred_locale} onChange={(e) => change('preferred_locale', e.target.value)}><option value="pt-BR">Português</option><option value="en-US">English</option></select></label>
                <label>Fuso horário<select value={profile.timezone_name} onChange={(e) => change('timezone_name', e.target.value)}><option>America/Sao_Paulo</option><option>America/New_York</option><option>America/Los_Angeles</option></select></label>
              </div>
              <section className={styles.contacts}>
                <h2>Contatos e redes sociais</h2>
                <div className={styles.fields}>
                  <label>WhatsApp profissional<input type="tel" value={profile.professional_whatsapp} onChange={(e) => change('professional_whatsapp', e.target.value)} /></label>
                  <label>E-mail público<input type="email" value={profile.public_email} onChange={(e) => change('public_email', e.target.value)} /></label>
                  <label>Instagram<input value={profile.instagram_handle} onChange={(e) => change('instagram_handle', e.target.value)} placeholder="@seuusuario" /></label>
                  <label>Facebook<input type="url" value={profile.facebook_url} onChange={(e) => change('facebook_url', e.target.value)} /></label>
                  <label>Website<input type="url" value={profile.website_url} onChange={(e) => change('website_url', e.target.value)} /></label>
                </div>
                <label>Endereço profissional<input value={profile.professional_address} onChange={(e) => change('professional_address', e.target.value)} /></label>
              </section>
              <button className={shell.import}>Salvar alterações</button>
            </>
          )}
          {feedback && <span className={styles.saved} role="status">{feedback}</span>}
        </form>
        <aside className={styles.card}>
          <h2>Segurança e acesso</h2>
          <dl>
            <div><dt>Empresa</dt><dd>{company}</dd></div>
            <div><dt>Nível</dt><dd>{level}</dd></div>
            <div><dt>Último login</dt><dd>{lastLogin}</dd></div>
          </dl>
          <Link className={styles.password} href="/primeiro-acesso">Alterar minha senha</Link>
          <p>Uma nova senha será solicitada a cada 90 dias.</p>
        </aside>
      </div>
    </main>
  );
}
