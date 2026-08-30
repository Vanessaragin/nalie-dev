'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { createClient } from '../../lib/supabase/client';
import styles from './styles.module.css';

export default function FirstAccessPage() {
  const [complete, setComplete] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [recoverySession, setRecoverySession] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const recoveryAttemptStarted = useRef(false);

  useEffect(() => {
    // React Strict Mode intentionally replays effects in development. A
    // recovery token is single-use, so the replay must not start a second
    // verification while the first request is still in flight.
    if (recoveryAttemptStarted.current) return;
    recoveryAttemptStarted.current = true;

    async function prepareRecoverySession() {
      const currentUrl = new URL(window.location.href);
      const code = currentUrl.searchParams.get('code');
      const tokenHash = currentUrl.searchParams.get('token_hash');
      // Capture hash credentials before createBrowserClient can consume and
      // remove them from the address bar.
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const accessToken = hash.get('access_token');
      const refreshToken = hash.get('refresh_token');
      try {
        const supabase = createClient({ detectSessionInUrl: false });
        // In development React can run this effect twice. The first pass may
        // already have exchanged the one-use recovery token, so always reuse
        // the session it created instead of trying to consume the token again.
        const { data: existingData, error: existingError } =
          await supabase.auth.getSession();
        if (existingError) throw existingError;

        if (existingData.session) {
          setRecoverySession(true);
          window.history.replaceState(null, '', window.location.pathname);
          return;
        }

        if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          });
          if (error) throw error;
          window.history.replaceState(null, '', window.location.pathname);
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          window.history.replaceState(null, '', window.location.pathname);
        }
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) throw error ?? new Error('Sessão ausente.');
        setRecoverySession(true);
      } catch (error) {
        const description = new URLSearchParams(
          window.location.hash.replace(/^#/, ''),
        ).get('error_description');
        setMessage(
          description
            ? 'O link de acesso é inválido ou expirou. Solicite um novo link.'
            : error instanceof Error && error.message
              ? `Não foi possível validar o link: ${error.message}`
              : 'Abra o link recebido por e-mail ou solicite um novo link.',
        );
      } finally {
        setSessionChecked(true);
      }
    }
    void prepareRecoverySession();
    const handleHashChange = () => void prepareRecoverySession();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    if (newPassword !== confirmation) {
      setMessage('As senhas não coincidem.');
      return;
    }
    if (newPassword.length < 12) {
      setMessage('A nova senha deve ter pelo menos 12 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      if (!recoverySession) throw new Error('O link de acesso não está válido.');
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;
      setComplete(true);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível alterar a senha.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.brand}>
          <span>N</span>
          <p>
            <b>NALIE</b>
            <small>BUSINESS INTELLIGENCE</small>
          </p>
        </div>
        {!complete ? (
          <>
            <span className={styles.step}>
              PRIMEIRO ACESSO · ETAPA OBRIGATÓRIA
            </span>
            <h1>Crie sua nova senha</h1>
            <p className={styles.intro}>
              {recoverySession
                ? 'Escolha sua senha pessoal para concluir o primeiro acesso.'
                : 'O acesso para criar a senha deve ser aberto pelo link recebido por e-mail.'}
            </p>
            {sessionChecked && !recoverySession ? (
              <div>
                {message && <p role="alert">{message}</p>}
                <p>
                  Solicite à administração da Nalie um novo link de primeiro
                  acesso.
                </p>
                <Link href="/login">Voltar para o login →</Link>
              </div>
            ) : recoverySession ? (
              <form onSubmit={submit}>
              <label>
                Nova senha
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Mínimo de 12 caracteres"
                />
              </label>
              <label>
                Confirmar nova senha
                <input
                  type="password"
                  required
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  placeholder="Repita a nova senha"
                />
              </label>
              <ul>
                <li>Use pelo menos 12 caracteres</li>
                <li>Inclua letra maiúscula, minúscula, número e símbolo</li>
                <li>Use uma senha exclusiva para o portal</li>
              </ul>
              <button disabled={loading}>
                {loading ? 'Salvando…' : 'Salvar nova senha e entrar'}
              </button>
              {message && <p role="alert">{message}</p>}
              </form>
            ) : (
              <p>Validando seu link de acesso…</p>
            )}
          </>
        ) : (
          <div className={styles.success}>
            <span>✓</span>
            <h1>Senha criada com segurança</h1>
            <p>
              O primeiro acesso foi concluído. A próxima alteração será
              solicitada em 90 dias.
            </p>
            <Link href="/login">Ir para o login →</Link>
          </div>
        )}
      </section>
    </main>
  );
}
