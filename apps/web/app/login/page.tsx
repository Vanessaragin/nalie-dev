'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

import { createClient } from '../../lib/supabase/client';
import styles from './styles.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(() =>
    typeof window !== 'undefined' &&
    new URL(window.location.href).searchParams.get('reason') === 'blocked'
      ? 'Este acesso está bloqueado. Procure a administradora responsável pela sua empresa.'
      : null,
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      router.push('/portal');
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Não foi possível entrar.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <Link className={styles.back} href="/">
          ← Voltar
        </Link>
        <div
          className={styles.brand}
          aria-label="Nalie Inteligência Financeira"
        >
          <span>N</span>
          <div>
            <strong>NALIE</strong>
            <small>BUSINESS INTELLIGENCE</small>
          </div>
        </div>
        <div className={styles.intro}>
          <h1>Bem-vindo.</h1>
          <p>Acesse os indicadores e planos da sua empresa com segurança.</p>
        </div>
        <form onSubmit={handleSubmit}>
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@empresa.com"
          />
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Sua senha"
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
          {message && (
            <p className={styles.message} role="alert">
              {message}
            </p>
          )}
        </form>
        <p className={styles.invite}>
          O acesso é criado por convite da administração. Não há cadastro
          público.
        </p>
      </section>
      <aside className={styles.visual}>
        <div className={styles.portrait} aria-hidden="true" />
        <div className={styles.quote}>
          <span>“</span>
          <p>Clareza para transformar números em decisões melhores.</p>
          <small>Nalie Intelligence · Vanessa Rodrigues</small>
        </div>
      </aside>
    </main>
  );
}
