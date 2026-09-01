'use client';

import { FormEvent, useEffect, useState } from 'react';
import MenuToggle from '../../../components/menu-toggle';
import shell from '../../styles.module.css';
import styles from './styles.module.css';
import PortalNavigation from '../../portal-navigation';
import AccessLegend from '../../../components/access-legend';
import CompanySwitcher from '../../../components/company-switcher';
import { createClient } from '../../../../lib/supabase/client';

const initialEvents: Array<{
  date: string;
  day: string;
  time: string;
  title: string;
  type: string;
  reminder: string;
  details: string;
  location: string;
}> = [];

function currentPeriod() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

function googleCalendarUrl(
  day: string,
  time: string,
  title: string,
  type: string,
) {
  const [hour, minute] = time.split(':').map(Number);
  const paddedDay = day.padStart(2, '0');
  const start = `202506${paddedDay}T${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}00`;
  const end = `202506${paddedDay}T${String(Math.min(hour + 1, 23)).padStart(2, '0')}${String(minute).padStart(2, '0')}00`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${start}/${end}`,
    details: `${type} · Nalie Business Intelligence`,
    location: 'Nalie Business Intelligence',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default function ClientCalendarPage() {
  const [events, setEvents] = useState(initialEvents);
  const [showForm, setShowForm] = useState(false);
  const [period, setPeriod] = useState(currentPeriod);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  function changeMonth(offset: number) {
    const [year, month] = period.split('-').map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    setPeriod(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    );
  }

  useEffect(() => {
    let active = true;
    async function loadEvents() {
      try {
        const supabase = createClient({ detectSessionInUrl: false });
        const { data: companyId } = await supabase.rpc('current_company_id');
        if (!companyId) return;
        const { data, error } = await supabase
          .from('calendar_events')
          .select(
            'id,title,theme,starts_at,ends_at,suggested_agenda,priority,scope',
          )
          .eq('company_id', companyId)
          .order('starts_at', { ascending: true });
        if (error || !data || !active) return;
        setEvents(
          data.map((row) => {
            const startsAt = new Date(String(row.starts_at));
            const agenda = Array.isArray(row.suggested_agenda)
              ? row.suggested_agenda.map(String)
              : [];
            return {
              date: startsAt.toISOString().slice(0, 10),
              day: String(startsAt.getDate()),
              time: startsAt.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              }),
              title: String(row.title),
              type: String(row.theme || 'Empresa'),
              reminder:
                agenda
                  .find((item) => item.startsWith('Lembrete: '))
                  ?.slice(10) ?? 'Sem lembrete',
              details:
                agenda
                  .find((item) => item.startsWith('Detalhes: '))
                  ?.slice(10) ?? '',
              location:
                agenda.find((item) => item.startsWith('Local: '))?.slice(7) ??
                '',
            };
          }),
        );
      } catch {
        setEvents([]);
      }
    }
    void loadEvents();
    return () => {
      active = false;
    };
  }, []);

  async function addEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = String(form.get('date'));
    const time = String(form.get('time'));
    const title = String(form.get('title'));
    const reminder = String(form.get('reminder'));
    const details = String(form.get('details'));
    const location = String(form.get('location'));
    const duration = Number(form.get('duration') || 60);
    const startsAt = new Date(`${date}T${time}:00`);
    if (!title.trim() || Number.isNaN(startsAt.getTime())) {
      setNotice('Preencha título, data e horário corretamente.');
      return;
    }
    setSaving(true);
    setNotice('Salvando compromisso no banco...');
    try {
      const supabase = createClient({ detectSessionInUrl: false });
      const [{ data: companyId }, { data: authData }] = await Promise.all([
        supabase.rpc('current_company_id'),
        supabase.auth.getUser(),
      ]);
      const userId = authData.user?.id;
      if (!companyId || !userId) throw new Error('Sessão sem empresa.');
      const endsAt = new Date(startsAt.getTime() + duration * 60_000);
      const { error } = await supabase.from('calendar_events').insert({
        company_id: companyId,
        created_by: userId,
        assigned_profile_id: userId,
        title: title.trim(),
        theme: 'Empresa',
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        suggested_agenda: [
          `Detalhes: ${details}`,
          `Local: ${location}`,
          `Lembrete: ${reminder}`,
        ],
        whatsapp_reminder_enabled: false,
        priority: 'NORMAL',
        booked_with_owner: false,
        scope: 'COMPANY',
      });
      if (error) throw error;
      setEvents((current) => [
        ...current,
        {
          date,
          day: date.split('-')[2],
          time,
          title: title.trim(),
          type: 'Empresa',
          reminder,
          details,
          location,
        },
      ]);
      setPeriod(date.slice(0, 7));
      setShowForm(false);
      setNotice(`${title.trim()} foi salvo no banco e no calendário.`);
    } catch (error) {
      setNotice(
        `Compromisso não salvo: ${error instanceof Error ? error.message : 'o banco recusou os dados'}.`,
      );
    } finally {
      setSaving(false);
    }
  }
  const newestEvent = events.at(-1);
  const visibleEvents = events.filter((item) => item.date.startsWith(period));
  const [periodYear, periodMonth] = period.split('-').map(Number);
  const daysInMonth = new Date(periodYear, periodMonth, 0).getDate();
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
            <h1>Meu calendário</h1>
            <p>
              Compromissos da empresa, pré-lançamentos e reuniões com Vanessa.
            </p>
          </div>
          <div className={shell.filters}>
            <button onClick={() => setShowForm(true)}>
              ＋ Adicionar compromisso
            </button>
          </div>
        </header>
        {newestEvent ? (
          <section className={styles.paymentReminder}>
            <span>🔔</span>
            <div>
              <b>
                Próximo lembrete · dia {newestEvent.day}, às {newestEvent.time}
              </b>
              <p>
                {newestEvent.title} · aviso configurado para{' '}
                {newestEvent.reminder}. Todo compromisso salvo aparece no dia
                correto do calendário e nesta área de lembretes.
              </p>
            </div>
          </section>
        ) : (
          <section className={styles.paymentReminder}>
            <span>🔔</span>
            <div>
              <b>Nenhum compromisso cadastrado</b>
              <p>Os eventos reais da empresa aparecerão aqui.</p>
            </div>
          </section>
        )}
        {notice && <p role="status">{notice}</p>}
        {showForm && (
          <form className={styles.eventForm} onSubmit={addEvent}>
            <label>
              Título
              <input
                name="title"
                required
                defaultValue="Novo compromisso da empresa"
              />
            </label>
            <label>
              Data
              <input
                name="date"
                type="date"
                required
                defaultValue={`${period}-01`}
              />
            </label>
            <label>
              Horário
              <input name="time" type="time" required defaultValue="14:00" />
            </label>
            <label>
              Duração
              <select name="duration" defaultValue="60">
                <option value="30">30 minutos</option>
                <option value="60">1 hora</option>
                <option value="90">1 hora e 30 minutos</option>
              </select>
            </label>
            <label>
              Local ou link da reunião
              <input
                name="location"
                placeholder="Endereço ou link da reunião"
              />
            </label>
            <label>
              Lembrete
              <select name="reminder" defaultValue="1 dia antes">
                <option>15 minutos antes</option>
                <option>1 hora antes</option>
                <option>1 dia antes</option>
                <option>2 dias antes</option>
              </select>
            </label>
            <label>
              Detalhes e pauta
              <textarea
                name="details"
                rows={4}
                placeholder="Objetivo, assuntos e observações"
              />
            </label>
            <button disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar compromisso'}
            </button>
          </form>
        )}
        <section className={styles.grid}>
          <article className={styles.calendar}>
            <div className={styles.calendarTitle}>
              <button onClick={() => changeMonth(-1)} aria-label="Mês anterior">
                ‹
              </button>
              <b>
                {new Intl.DateTimeFormat('pt-BR', {
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'UTC',
                }).format(new Date(`${period}-01T12:00:00Z`))}
              </b>
              <button onClick={() => changeMonth(1)} aria-label="Próximo mês">
                ›
              </button>
            </div>
            <div className={styles.week}>
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className={styles.days}>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(
                (day) => (
                  <div key={day}>
                    <span>{day}</span>
                    {visibleEvents
                      .filter((item) => Number(item.day) === day)
                      .map((item) => (
                        <small
                          className={
                            styles[
                              item.type === 'Pré-lançamento'
                                ? 'billing'
                                : item.type === 'Com Vanessa'
                                  ? 'vanessa'
                                  : 'company'
                            ]
                          }
                          key={item.title}
                        >
                          {item.title}
                        </small>
                      ))}
                  </div>
                ),
              )}
            </div>
          </article>
          <aside className={styles.upcoming}>
            <div className={styles.title}>
              <b>Próximos compromissos</b>
              <small>Todos os eventos desta empresa</small>
            </div>
            {visibleEvents.map((item) => (
              <article key={`${item.day}-${item.title}`}>
                <time>
                  {new Date(`${item.date}T12:00:00`).toLocaleDateString(
                    'pt-BR',
                    {
                      day: '2-digit',
                      month: 'short',
                    },
                  )}
                  <br />
                  {item.time}
                </time>
                <p>
                  <b>{item.title}</b>
                  <small>{item.type}</small>
                  <small>{item.reminder}</small>
                </p>
                <a
                  className={styles.googleCalendar}
                  href={googleCalendarUrl(
                    item.day,
                    item.time,
                    item.title,
                    item.type,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Adicionar ao Google Agenda: ${item.title}`}
                  title="Adicionar ao Google Agenda"
                >
                  <b>G</b>
                </a>
              </article>
            ))}
          </aside>
        </section>
      </section>
    </main>
  );
}
