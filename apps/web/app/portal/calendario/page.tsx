'use client';

import Image from 'next/image';
import { FormEvent, useEffect, useState } from 'react';
import AccessLegend from '../../components/access-legend';
import MenuToggle from '../../components/menu-toggle';
import shell from '../styles.module.css';
import styles from './styles.module.css';
import PortalNavigation from '../portal-navigation';
import CompanySwitcher from '../../components/company-switcher';
import { createClient } from '../../../lib/supabase/client';

const days = Array.from({ length: 30 }, (_, index) => index + 1);
type Appointment = {
  day: number;
  time: string;
  title: string;
  client: string;
  priority: string;
  tone: string;
  whatsapp: string;
  email: string;
  details?: string;
  location?: string;
};

const appointments: Appointment[] = [];
const personalAppointments: Appointment[] = [];

function googleCalendarUrl(
  title: string,
  time: string,
  details: string,
  day = '14',
) {
  const [hour, minute] = time.split(':').map(Number);
  const start = `202506${day.padStart(2, '0')}T${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}00`;
  const endHour = String(Math.min(hour + 1, 23)).padStart(2, '0');
  const end = `202506${day.padStart(2, '0')}T${endHour}${String(minute).padStart(2, '0')}00`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${start}/${end}`,
    details,
    location: 'Nalie Business Intelligence',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default function CalendarPage() {
  const en = false;
  const [calendarView, setCalendarView] = useState<'general' | 'personal'>(
    'general',
  );
  const [period, setPeriod] = useState('2025-06');
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [generalItems, setGeneralItems] = useState(appointments);
  const [personalItems, setPersonalItems] = useState(personalAppointments);
  const [appointmentNotice, setAppointmentNotice] = useState('');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [priorityFilter, setPriorityFilter] = useState('Todas');
  const [clientFilter, setClientFilter] = useState('Todos');
  const [clientChoices, setClientChoices] = useState<string[]>([]);
  const calendarAppointments =
    calendarView === 'general' ? generalItems : personalItems;
  const clientOptions = [
    ...new Set(calendarAppointments.map((item) => item.client)),
  ];
  const visibleAppointments = calendarAppointments.filter(
    (item) =>
      (selectedDay === null || item.day === selectedDay) &&
      (priorityFilter === 'Todas' || item.priority === priorityFilter) &&
      (clientFilter === 'Todos' || item.client === clientFilter),
  );
  const calendarFilteredAppointments = calendarAppointments.filter(
    (item) =>
      (priorityFilter === 'Todas' || item.priority === priorityFilter) &&
      (clientFilter === 'Todos' || item.client === clientFilter),
  );
  useEffect(() => {
    async function loadClientChoices() {
      try {
        const supabase = createClient({ detectSessionInUrl: false });
        const { data, error } = await supabase.rpc('admin_list_company_users');
        if (error) throw error;
        setClientChoices(
          (data ?? []).map(
            (row: { company_name: string; profile_name: string; role_name: string }) =>
              `${row.company_name} | ${row.profile_name} | ${
                row.role_name === 'COMPANY_ADMIN' ? 'Administrador' : 'Usuário'
              }`,
          ),
        );
      } catch {
        setClientChoices([]);
      }
    }
    void loadClientChoices();
  }, []);
  function addAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get('title'));
    const client = String(data.get('client'));
    const time = String(data.get('time'));
    const day = Number(String(data.get('date')).split('-')[2]);
    const priority = String(data.get('priority'));
    const tone =
      priority === 'Alta' ? 'high' : priority === 'Média' ? 'medium' : 'normal';
    const phone = String(data.get('phone')).replace(/\D/g, '');
    const emailAddress = String(data.get('email'));
    const details = String(data.get('details'));
    const location = String(data.get('location'));
    const item = {
      day,
      time,
      title,
      client,
      priority,
      tone,
      whatsapp: `https://wa.me/${phone}?text=${encodeURIComponent(`Olá! Lembrete: ${title} às ${time}.`)}`,
      email: `mailto:${emailAddress}?subject=${encodeURIComponent(`Lembrete - ${title}`)}&body=${encodeURIComponent(`${details}${location ? `\nLocal: ${location}` : ''}`)}`,
      details,
      location,
    };
    if (String(data.get('calendar')) === 'personal') {
      setPersonalItems((current) => [...current, item]);
      setCalendarView('personal');
    } else {
      setGeneralItems((current) => [...current, item]);
      setCalendarView('general');
    }
    setShowAppointmentForm(false);
    setSelectedDay(day);
    setAppointmentNotice(`${title} adicionado ao calendário.`);
  }
  function changeMonth(offset: number) {
    const [year, month] = period.split('-').map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    setPeriod(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    );
    setSelectedDay(null);
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
            <h1>{en ? 'Calendar' : 'Calendário'}</h1>
            <p>
              {en
                ? 'See every client appointment without blocking your personal calendar.'
                : 'Veja todos os compromissos dos clientes sem ocupar sua agenda pessoal.'}
            </p>
          </div>
          <div className={shell.filters}>
            <button
              className={shell.import}
              onClick={() => setShowAppointmentForm(true)}
            >
              ＋ {en ? 'New appointment' : 'Novo compromisso'}
            </button>
          </div>
        </header>
        {appointmentNotice && (
          <p className={styles.appointmentNotice}>✓ {appointmentNotice}</p>
        )}
        {showAppointmentForm && (
          <form className={styles.appointmentForm} onSubmit={addAppointment}>
            <header>
              <div>
                <b>Novo compromisso</b>
                <small>
                  Cadastre o evento e escolha em qual agenda ele aparecerá.
                </small>
              </div>
              <button
                type="button"
                onClick={() => setShowAppointmentForm(false)}
              >
                ×
              </button>
            </header>
            <div>
              <label>
                Título
                <input
                  name="title"
                  required
                  placeholder="Ex.: Revisão financeira"
                />
              </label>
              <label>
                Cliente / empresa
                <select name="client" required defaultValue="">
                  <option value="" disabled>
                    Selecione empresa, pessoa e perfil
                  </option>
                  {clientChoices.map((choice) => (
                    <option key={choice} value={choice}>
                      {choice}
                    </option>
                  ))}
                  <option value="Agenda pessoal">Agenda pessoal</option>
                </select>
              </label>
              <label>
                Agenda
                <select name="calendar" defaultValue={calendarView}>
                  <option value="general">Agenda geral</option>
                  <option value="personal">Agenda pessoal</option>
                </select>
              </label>
              <label>
                Data
                <input
                  name="date"
                  type="date"
                  defaultValue={`${period}-${String(selectedDay ?? 14).padStart(2, '0')}`}
                  required
                />
              </label>
              <label>
                Horário
                <input name="time" type="time" required />
              </label>
              <label>
                Duração
                <select name="duration" defaultValue="60">
                  <option value="30">30 minutos</option>
                  <option value="60">1 hora</option>
                  <option value="90">1 hora e 30 minutos</option>
                  <option value="120">2 horas</option>
                </select>
              </label>
              <label>
                Recorrência
                <select name="recurrence" defaultValue="Não repetir">
                  <option>Não repetir</option>
                  <option>Semanal</option>
                  <option>Quinzenal</option>
                  <option>Mensal</option>
                </select>
              </label>
              <label>
                Prioridade
                <select name="priority">
                  <option>Alta</option>
                  <option>Média</option>
                  <option>Normal</option>
                </select>
              </label>
              <label>
                WhatsApp
                <input name="phone" type="tel" placeholder="5511999999999" />
              </label>
              <label>
                E-mail
                <input
                  name="email"
                  type="email"
                  placeholder="cliente@empresa.com"
                />
              </label>
              <label>
                Local ou link da reunião
                <input
                  name="location"
                  placeholder="Endereço, Google Meet ou outro link"
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
              <label className={styles.fullField}>
                Detalhes e pauta
                <textarea
                  name="details"
                  rows={4}
                  placeholder="Objetivo, assuntos que serão tratados, documentos necessários e observações"
                />
              </label>
            </div>
            <footer>
              <button
                type="button"
                onClick={() => setShowAppointmentForm(false)}
              >
                Cancelar
              </button>
              <button>Salvar compromisso</button>
            </footer>
          </form>
        )}
        <section
          className={styles.calendarFilters}
          aria-label="Filtros da agenda"
        >
          <div>
            <b>Filtrar agenda</b>
            <small>Veja todos ou selecione uma empresa e uma pessoa.</small>
          </div>
          <label>
            Cliente / empresa
            <select
              value={clientFilter}
              onChange={(event) => {
                setClientFilter(event.target.value);
                setSelectedDay(null);
              }}
            >
              <option value="Todos">Todos os clientes</option>
              {clientOptions.map((client) => (
                <option value={client} key={client}>
                  {client}
                </option>
              ))}
            </select>
          </label>
          <label>
            Prioridade
            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
            >
              <option>Todas</option>
              <option value="Alta">Prioridade alta</option>
              <option>Média</option>
              <option>Normal</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setClientFilter('Todos');
              setPriorityFilter('Todas');
              setSelectedDay(null);
            }}
          >
            Limpar filtros
          </button>
        </section>
        <div
          className={styles.calendarViews}
          role="group"
          aria-label="Tipo de agenda"
        >
          <button
            className={calendarView === 'general' ? styles.viewActive : ''}
            onClick={() => {
              setCalendarView('general');
              setClientFilter('Todos');
              setSelectedDay(null);
            }}
            type="button"
          >
            <span>▦</span>
            <b>Agenda geral</b>
            <small>Clientes e empresas</small>
          </button>
          <button
            className={calendarView === 'personal' ? styles.viewActive : ''}
            onClick={() => {
              setCalendarView('personal');
              setClientFilter('Todos');
              setSelectedDay(null);
            }}
            type="button"
          >
            <span>◷</span>
            <b>Agenda pessoal</b>
            <small>Somente seus compromissos</small>
          </button>
          <div>
            <b>Visibilidade protegida</b>
            <small>Compromissos pessoais aparecem apenas para você.</small>
          </div>
        </div>
        <div className={styles.notice}>
          ◎{' '}
          <span>
            <b>
              {calendarView === 'general'
                ? en
                  ? 'Overlay view'
                  : 'Visão sobreposta'
                : en
                  ? 'Private calendar'
                  : 'Agenda pessoal privada'}
            </b>
            <small>
              {calendarView === 'general'
                ? en
                  ? 'Appointments booked with you appear here, but are not added to your personal calendar.'
                  : 'Os compromissos marcados com você aparecem aqui, mas não são adicionados à sua agenda pessoal.'
                : en
                  ? 'Only you can see the personal appointments displayed in this view.'
                  : 'Somente você visualiza os compromissos pessoais exibidos nesta visão.'}
            </small>
          </span>
        </div>
        <section className={styles.calendarGrid}>
          <article className={styles.calendar}>
            <div className={styles.calendarTitle}>
              <button onClick={() => changeMonth(-1)} aria-label="Mês anterior">
                ‹
              </button>
              <b>
                {new Intl.DateTimeFormat(en ? 'en-US' : 'pt-BR', {
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
              {(en
                ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                : ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
              ).map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className={styles.days}>
              {days.map((day) => {
                const item = calendarFilteredAppointments.find(
                  (appointment) => appointment.day === day,
                );
                return (
                  <button
                    className={`${item ? styles.hasEvent : ''} ${day === selectedDay ? styles.selected : ''}`}
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    aria-label={`Dia ${day}${item ? `: ${item.title}` : ''}`}
                  >
                    <span>{day}</span>
                    {item && (
                      <i>{item.title.split(' ').slice(0, 2).join(' ')}</i>
                    )}
                  </button>
                );
              })}
            </div>
            <div className={styles.legend}>
              <span>● Alta prioridade</span>
              <span>● Média</span>
              <span>● Normal</span>
            </div>
          </article>
          <aside className={styles.upcoming}>
            <div className={styles.title}>
              <div>
                <b>{en ? 'Upcoming appointments' : 'Próximos compromissos'}</b>
                <small>
                  {en
                    ? 'Sorted by date and priority'
                    : 'Ordenados por data e prioridade'}
                </small>
              </div>
            </div>
            <div className={styles.today}>
              {selectedDay
                ? `DIA ${selectedDay} · ${period.split('-').reverse().join('/')}`
                : en
                  ? 'ALL UPCOMING APPOINTMENTS'
                  : 'TODOS OS PRÓXIMOS COMPROMISSOS'}
            </div>
            {selectedDay !== null && (
              <button
                className={styles.showAllAppointments}
                onClick={() => setSelectedDay(null)}
              >
                Mostrar todos
              </button>
            )}
            {visibleAppointments.map((item) => (
              <article key={`${item.title}-${item.time}`}>
                <strong>{item.time}</strong>
                <span className={styles[item.tone]} />
                <p>
                  <b>{item.title}</b>
                  <small>{item.client}</small>
                  {item.location && <small>Local: {item.location}</small>}
                  {item.details && <small>Pauta: {item.details}</small>}
                </p>
                <em className={styles[item.tone]}>{item.priority}</em>
                <div className={styles.contactActions}>
                  <a
                    className={styles.whatsapp}
                    href={item.whatsapp}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`WhatsApp: ${item.title}`}
                    title="WhatsApp"
                  >
                    <Image
                      src="/whatsapp-icon.png"
                      alt=""
                      width={22}
                      height={22}
                    />
                  </a>
                  <a
                    className={styles.email}
                    href={item.email}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`E-mail: ${item.title}`}
                    title="E-mail"
                  >
                    <Image
                      src="/email-icon.png"
                      alt=""
                      width={22}
                      height={22}
                    />
                  </a>
                  <a
                    className={styles.googleCalendar}
                    href={googleCalendarUrl(
                      item.title,
                      item.time,
                      `${item.client} · Prioridade ${item.priority}${item.details ? ` · ${item.details}` : ''}${item.location ? ` · Local: ${item.location}` : ''}`,
                      String(item.day),
                    )}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Adicionar ao Google Agenda: ${item.title}`}
                    title="Adicionar ao Google Agenda"
                  >
                    <b>G</b>
                  </a>
                </div>
              </article>
            ))}
            {visibleAppointments.length === 0 && (
                <p className={styles.noAppointments}>
                  Nenhum compromisso corresponde ao cliente, prioridade e dia
                  selecionados.
                </p>
              )}
            <div className={styles.suggestion}>
              <span>✦</span>
              <p>
                <b>{en ? 'Suggested agenda' : 'Sugestão de pauta'}</b>
                <small>
                  {en
                    ? 'Revenue, expenses, margin and next actions based on the appointment topic.'
                    : 'Receita, despesas, margem e próximas ações conforme o tema do compromisso.'}
                </small>
              </p>
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}
