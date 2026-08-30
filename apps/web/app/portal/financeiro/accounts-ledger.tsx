'use client';

import { FormEvent, useMemo, useState } from 'react';
import styles from './subpage.module.css';

type Entry = {
  id: number;
  date: string;
  description: string;
  category: string;
  account: string;
  status: string;
  amount: number;
  series?: string;
};

const accounts = ['Itaú PJ ***20', 'Nubank PJ ***20', 'Conta pessoal ***20'];

export default function AccountsLedger({
  kind,
  initialEntries,
}: {
  kind: 'payable' | 'receivable';
  initialEntries: Entry[];
}) {
  const payable = kind === 'payable';
  const categories = payable
    ? ['Insumos', 'Estrutura', 'Mão de obra', 'Impostos', 'Marketing', 'Outros']
    : ['Vendas no cartão', 'Clientes B2B', 'Delivery', 'Serviços', 'Outros'];
  const statuses = payable
    ? ['Pendente', 'Agendada', 'Paga', 'Vencida']
    : ['Prevista', 'Aguardando', 'Confirmada', 'Recebida', 'Em atraso'];
  const [entries, setEntries] = useState(initialEntries);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('2025-06');
  const [account, setAccount] = useState('Todas');
  const [category, setCategory] = useState('Todas');
  const [status, setStatus] = useState('Todos');

  const visible = useMemo(
    () =>
      entries.filter(
        (item) =>
          item.date.startsWith(period) &&
          (account === 'Todas' || item.account === account) &&
          (category === 'Todas' || item.category === category) &&
          (status === 'Todos' || item.status === status) &&
          item.description.toLowerCase().includes(search.toLowerCase()),
      ),
    [account, category, entries, period, search, status],
  );
  const openStatuses = payable
    ? ['Pendente', 'Agendada', 'Vencida']
    : ['Prevista', 'Aguardando', 'Confirmada', 'Em atraso'];
  const total = entries
    .filter((entry) => openStatuses.includes(entry.status))
    .reduce((sum, entry) => sum + entry.amount, 0);

  function startEdit(entry: Entry) {
    setEditingId(entry.id);
    setShowForm(true);
    setNotice('');
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const base = {
      description: String(form.get('description')),
      amount: Number(form.get('amount')),
      date: String(form.get('date')),
      category: String(form.get('category')),
      account: String(form.get('account')),
      status: String(form.get('status')),
    };
    if (editingId !== null) {
      const current = entries.find((item) => item.id === editingId);
      const scope = String(form.get('editScope'));
      setEntries((items) =>
        items.map((item) =>
          item.id === editingId ||
          (scope === 'series' &&
            current?.series &&
            item.series === current.series &&
            item.date >= current.date)
            ? {
                ...item,
                ...base,
                date: item.id === editingId ? base.date : item.date,
              }
            : item,
        ),
      );
      setNotice(
        scope === 'series'
          ? 'Este lançamento e os próximos da série foram atualizados.'
          : 'Lançamento atualizado.',
      );
    } else {
      const mode = String(form.get('mode'));
      const quantity = mode === 'series' ? Number(form.get('quantity')) : 1;
      const frequency = String(form.get('frequency'));
      const series = mode === 'series' ? `serie-${Date.now()}` : undefined;
      const startDate = new Date(`${base.date}T12:00:00`);
      const additions = Array.from({ length: quantity }, (_, index) => {
        const date = new Date(startDate);
        if (frequency === 'Semanal') date.setDate(date.getDate() + index * 7);
        else if (frequency === 'Quinzenal')
          date.setDate(date.getDate() + index * 15);
        else if (frequency === 'Anual')
          date.setFullYear(date.getFullYear() + index);
        else date.setMonth(date.getMonth() + index);
        return {
          ...base,
          id: Date.now() + index,
          date: date.toISOString().slice(0, 10),
          description:
            quantity > 1
              ? `${base.description} · ${index + 1}/${quantity}`
              : base.description,
          series,
        };
      });
      setEntries((items) => [...items, ...additions]);
      setNotice(
        quantity > 1
          ? `Série com ${quantity} lançamentos criada.`
          : 'Lançamento individual criado.',
      );
    }
    setEditingId(null);
    setShowForm(false);
  }

  const editing = entries.find((item) => item.id === editingId);
  return (
    <>
      <section className={styles.summary}>
        <article>
          <small>{payable ? 'Total em aberto' : 'Total previsto'}</small>
          <strong className={payable ? styles.negative : styles.positive}>
            {total.toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })}
          </strong>
          <span>{entries.length} lançamentos cadastrados</span>
        </article>
        <article>
          <small>{payable ? 'Vencidas' : 'Em atraso'}</small>
          <strong>R$ 0,00</strong>
          <span>✓ Nenhum lançamento atrasado</span>
        </article>
        <article className={styles.newEntry}>
          <small>Novo lançamento</small>
          <button
            onClick={() => {
              setEditingId(null);
              setShowForm(true);
            }}
          >
            ＋{' '}
            {payable ? 'Adicionar conta a pagar' : 'Adicionar conta a receber'}
          </button>
          <span>Individual ou série recorrente</span>
        </article>
      </section>

      {showForm && (
        <form className={styles.entryForm} onSubmit={save}>
          <div className={styles.formTitle}>
            <div>
              <b>{editing ? 'Editar lançamento' : 'Cadastrar lançamento'}</b>
              <small>
                Preencha os dados e escolha se será individual ou recorrente.
              </small>
            </div>
            <button type="button" onClick={() => setShowForm(false)}>
              ×
            </button>
          </div>
          <div className={styles.formGrid}>
            <label>
              Descrição
              <input
                name="description"
                required
                defaultValue={editing?.description || ''}
              />
            </label>
            <label>
              Valor
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                defaultValue={editing?.amount || ''}
              />
            </label>
            <label>
              {payable ? 'Vencimento' : 'Previsão'}
              <input
                name="date"
                type="date"
                required
                defaultValue={editing?.date || '2025-06-20'}
              />
            </label>
            <label>
              Categoria
              <select
                name="category"
                defaultValue={editing?.category || categories[0]}
              >
                {categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              Conta
              <select
                name="account"
                defaultValue={editing?.account || accounts[0]}
              >
                {accounts.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                name="status"
                defaultValue={editing?.status || statuses[0]}
              >
                {statuses.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            {editing ? (
              editing.series && (
                <label>
                  Aplicar alteração
                  <select name="editScope">
                    <option value="single">Somente neste lançamento</option>
                    <option value="series">
                      Neste e nos próximos da série
                    </option>
                  </select>
                </label>
              )
            ) : (
              <>
                <label>
                  Tipo de lançamento
                  <select name="mode" defaultValue="single">
                    <option value="single">Individual</option>
                    <option value="series">Série recorrente</option>
                  </select>
                </label>
                <label>
                  Quantidade na série
                  <input
                    name="quantity"
                    type="number"
                    min="2"
                    max="60"
                    defaultValue="12"
                  />
                </label>
                <label>
                  Frequência
                  <select name="frequency">
                    <option>Mensal</option>
                    <option>Semanal</option>
                    <option>Quinzenal</option>
                    <option>Anual</option>
                  </select>
                </label>
              </>
            )}
          </div>
          <div className={styles.formActions}>
            <button type="button" onClick={() => setShowForm(false)}>
              Cancelar
            </button>
            <button type="submit">
              {editing ? 'Salvar alterações' : 'Criar lançamento'}
            </button>
          </div>
        </form>
      )}

      {notice && (
        <p className={styles.notice} role="status">
          ✓ {notice}
        </p>
      )}
      <section className={styles.filtersPanel}>
        <div>
          <b>Filtros dos lançamentos</b>
          <small>Combine os filtros para localizar qualquer conta.</small>
        </div>
        <input
          aria-label="Pesquisar lançamentos"
          placeholder="Pesquisar descrição..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <input
          aria-label="Período"
          type="month"
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
        />
        <select
          aria-label="Filtrar por conta"
          value={account}
          onChange={(event) => setAccount(event.target.value)}
        >
          <option>Todas</option>
          {accounts.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select
          aria-label="Filtrar por categoria"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option>Todas</option>
          {categories.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select
          aria-label="Filtrar por status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option>Todos</option>
          {statuses.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </section>

      <section className={styles.panel}>
        <div className={styles.ledgerHead}>
          <span>{payable ? 'Vencimento' : 'Previsão'}</span>
          <span>Descrição</span>
          <span>Categoria</span>
          <span>Conta</span>
          <span>Status</span>
          <span>Valor</span>
          <span>Ações</span>
        </div>
        {visible.map((item) => (
          <div className={styles.ledgerRow} key={item.id}>
            <span>
              {new Date(`${item.date}T12:00:00`).toLocaleDateString('pt-BR')}
            </span>
            <span>
              <b>{item.description}</b>
              {item.series && <small>Série recorrente</small>}
            </span>
            <span>{item.category}</span>
            <span>{item.account}</span>
            <em>{item.status}</em>
            <strong className={payable ? styles.negative : styles.positive}>
              {payable ? '− ' : '＋ '}
              {item.amount.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </strong>
            <button onClick={() => startEdit(item)}>Editar</button>
          </div>
        ))}
        {!visible.length && (
          <p className={styles.empty}>
            Nenhum lançamento encontrado com esses filtros.
          </p>
        )}
      </section>
    </>
  );
}
