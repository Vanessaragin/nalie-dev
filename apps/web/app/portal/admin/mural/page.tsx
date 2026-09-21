'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { createClient } from '../../../../lib/supabase/client';
import PortalNavigation from '../../portal-navigation';
import MenuToggle from '../../../components/menu-toggle';
import CompanySwitcher from '../../../components/company-switcher';
import shell from '../../styles.module.css';
import styles from './styles.module.css';
type Note = {
  id: string;
  category: string;
  title: string;
  body: string;
  explanation: string;
  link_url: string;
};
const blank = {
  category: '',
  title: '',
  body: '',
  explanation: '',
  link_url: '',
};
export default function MasterBoard() {
  const [notes, setNotes] = useState<Note[]>([]),
    [ready, setReady] = useState(false),
    [allowed, setAllowed] = useState(false),
    [notice, setNotice] = useState(''),
    [filter, setFilter] = useState(''),
    [editing, setEditing] = useState<string | null>(null),
    [form, setForm] = useState(blank),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [removing, setRemoving] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const db = createClient();
        const auth = await db.rpc('is_super_admin');
        if (auth.error || !auth.data)
          throw new Error('Este mural é exclusivo dos Super Masters.');
        const result = await db
          .from('master_board_notes')
          .select('*')
          .order('created_at', { ascending: false });
        if (result.error) throw new Error('Não foi possível carregar o mural.');
        if (active) {
          setAllowed(true);
          setNotes(result.data ?? []);
        }
      } catch (e) {
        if (active) setNotice((e as Error).message);
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  const categories = [...new Set(notes.map((n) => n.category))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  );
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice('');
    try {
      const values = {
        ...form,
        category: form.category.trim(),
        title: form.title.trim(),
        link_url: form.link_url.trim(),
        updated_at: new Date().toISOString(),
      };
      if (values.link_url && !/^https?:\/\//i.test(values.link_url))
        throw new Error('Use um link iniciado por https:// ou http://.');
      const db = createClient();
      const result = editing
        ? await db
            .from('master_board_notes')
            .update(values)
            .eq('id', editing)
            .select()
            .single()
        : await db.from('master_board_notes').insert(values).select().single();
      if (result.error) throw new Error('Não foi possível salvar o post-it.');
      setNotes((current) =>
        editing
          ? current.map((n) => (n.id === editing ? result.data : n))
          : [result.data, ...current],
      );
      setFilter('');
      setOpen(false);
      setNotice('Post-it salvo.');
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (busy) return;
    setBusy(true);
    const result = await createClient()
      .from('master_board_notes')
      .delete()
      .eq('id', id)
      .select('id');
    if (result.error || !result.data?.length)
      setNotice('Não foi possível excluir o post-it.');
    else {
      setNotes((current) => current.filter((n) => n.id !== id));
      setRemoving(null);
      setNotice('Post-it excluído.');
    }
    setBusy(false);
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
      </aside>
      <section className={`${shell.content} ${styles.content}`}>
        <header className={styles.header}>
          <div>
            <small>ÁREA PRIVADA · SUPER MASTERS</small>
            <h1>Mural de ideias</h1>
            <p>Notas, referências e links organizados por categoria.</p>
          </div>
          {allowed && (
            <button
              className={styles.primary}
              onClick={() => {
                setEditing(null);
                setForm(blank);
                setOpen(true);
              }}
            >
              + Novo post-it
            </button>
          )}
        </header>
        {!ready && <p>Carregando mural…</p>}
        {notice && <p role="status">{notice}</p>}
        {allowed && (
          <>
            <label className={styles.filter}>
              Categoria
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">Todas as categorias</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            {open && (
              <form className={styles.editor} onSubmit={save}>
                <h2>{editing ? 'Editar post-it' : 'Novo post-it'}</h2>
                <label>
                  Categoria
                  <input
                    required
                    maxLength={80}
                    list="board-categories"
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                  />
                  <datalist id="board-categories">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </label>
                <label>
                  Título
                  <input
                    required
                    maxLength={160}
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                  />
                </label>
                <label>
                  Texto
                  <textarea
                    maxLength={10000}
                    rows={5}
                    value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                  />
                </label>
                <label>
                  Breve explicação
                  <textarea
                    maxLength={500}
                    rows={2}
                    value={form.explanation}
                    onChange={(e) =>
                      setForm({ ...form, explanation: e.target.value })
                    }
                  />
                </label>
                <label>
                  Link
                  <input
                    type="url"
                    placeholder="https://..."
                    value={form.link_url}
                    onChange={(e) =>
                      setForm({ ...form, link_url: e.target.value })
                    }
                  />
                </label>
                <div className={styles.actions}>
                  <button className={styles.primary} disabled={busy}>
                    Salvar post-it
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setOpen(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
            {!notes.length && (
              <p className={styles.empty}>
                Seu mural está vazio. Crie o primeiro post-it para começar.
              </p>
            )}
            {categories
              .filter((c) => !filter || c === filter)
              .map((category) => (
                <section key={category}>
                  <h2>{category}</h2>
                  <div className={styles.grid}>
                    {notes
                      .filter((n) => n.category === category)
                      .map((note) => (
                        <article className={styles.note} key={note.id}>
                          <h3>{note.title}</h3>
                          <p className={styles.body}>{note.body}</p>
                          {note.explanation && (
                            <p className={styles.explanation}>
                              {note.explanation}
                            </p>
                          )}
                          {/^https?:\/\//i.test(note.link_url) && (
                            <a
                              className={styles.link}
                              href={note.link_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Acessar link ↗
                            </a>
                          )}
                          <div className={styles.actions}>
                            <button
                              onClick={() => {
                                setEditing(note.id);
                                setForm({
                                  category: note.category,
                                  title: note.title,
                                  body: note.body,
                                  explanation: note.explanation,
                                  link_url: note.link_url,
                                });
                                setOpen(true);
                              }}
                            >
                              Editar
                            </button>
                            <button onClick={() => setRemoving(note.id)}>
                              Excluir
                            </button>
                          </div>
                          {removing === note.id && (
                            <div>
                              <p>Excluir este post-it definitivamente?</p>
                              <div className={styles.actions}>
                                <button
                                  disabled={busy}
                                  onClick={() => void remove(note.id)}
                                >
                                  Confirmar exclusão
                                </button>
                                <button
                                  disabled={busy}
                                  onClick={() => setRemoving(null)}
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}
                        </article>
                      ))}
                  </div>
                </section>
              ))}
          </>
        )}
      </section>
    </main>
  );
}
