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

function currentPeriod() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}
type Appointment = {
  id: string;
  sourceId: string;
  companyId: string;
  date: string;
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
  calendar: 'general' | 'personal';
  duration: number;
  recurrence: string;
  reminder: string;
};

type ClientChoice = {
  id: string;
  label: string;
  whatsapp: string;
  email: string;
};

const appointments: Appointment[] = [];
const personalAppointments: Appointment[] = [];

function recurringAppointments(items: Appointment[], period: string) {
  const [year, month] = period.split('-').map(Number);
  const rangeStart = new Date(year, month - 1, 1);
  const rangeEnd = new Date(year, month, 0, 23, 59, 59);
  return items.flatMap((item) => {
    if (item.recurrence === 'Não repetir')
      return item.date.startsWith(period) ? [item] : [];
    const cursor = new Date(`${item.date}T12:00:00`);
    const originalDay = cursor.getDate();
    const occurrences: Appointment[] = [];
    for (let count = 0; count < 400 && cursor <= rangeEnd; count += 1) {
      if (cursor >= rangeStart) {
        const date = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
        occurrences.push({
          ...item,
          id: `${item.sourceId}:${date}`,
          date,
          day: cursor.getDate(),
        });
      }
      if (item.recurrence === 'Semanal') cursor.setDate(cursor.getDate() + 7);
      else if (item.recurrence === 'Quinzenal')
        cursor.setDate(cursor.getDate() + 14);
      else {
        cursor.setDate(1);
        cursor.setMonth(cursor.getMonth() + 1);
        cursor.setDate(
          Math.min(
            originalDay,
            new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate(),
          ),
        );
      }
    }
    return occurrences;
  });
}

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
  const [period, setPeriod] = useState(currentPeriod);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [generalItems, setGeneralItems] = useState(appointments);
  const [personalItems, setPersonalItems] = useState(personalAppointments);
  const [appointmentNotice, setAppointmentNotice] = useState('');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [priorityFilter, setPriorityFilter] = useState('Todas');
  const [clientFilter, setClientFilter] = useState('Todos');
  const [clientChoices, setClientChoices] = useState<ClientChoice[]>([]);
  const [appointmentClientId, setAppointmentClientId] = useState('');
  const [appointmentPhone, setAppointmentPhone] = useState('');
  const [appointmentEmail, setAppointmentEmail] = useState('');
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [editingAppointment, setEditingAppointment] =
    useState<Appointment | null>(null);
  const storedCalendarAppointments =
    calendarView === 'general' ? generalItems : personalItems;
  const calendarAppointments = recurringAppointments(
    storedCalendarAppointments,
    period,
  );
  const clientOptions = [
    ...new Set([
      ...clientChoices.map((choice) => choice.label),
      ...storedCalendarAppointments.map((item) => item.client),
    ]),
  ];
  const visibleAppointments = calendarAppointments.filter(
    (item) =>
      item.date.startsWith(period) &&
      (selectedDay === null || item.day === selectedDay) &&
      (priorityFilter === 'Todas' || item.priority === priorityFilter) &&
      (clientFilter === 'Todos' || item.client === clientFilter),
  );
  const calendarFilteredAppointments = calendarAppointments.filter(
    (item) =>
      item.date.startsWith(period) &&
      (priorityFilter === 'Todas' || item.priority === priorityFilter) &&
      (clientFilter === 'Todos' || item.client === clientFilter),
  );
  const [periodYear, periodMonth] = period.split('-').map(Number);
  const days = Array.from(
    { length: new Date(periodYear, periodMonth, 0).getDate() },
    (_, index) => index + 1,
  );
  useEffect(() => {
    async function loadCalendar() {
      try {
        const supabase = createClient({ detectSessionInUrl: false });
        const [companiesResult, crmResult, eventsResult] = await Promise.all([
          supabase
            .from('companies')
            .select('id,display_name,status')
            .eq('status', 'ACTIVE')
            .order('display_name'),
          supabase
            .from('client_crm')
            .select(
              'company_id,contact_name,contact_email,contact_phone,whatsapp,client_status',
            ),
          supabase
            .from('calendar_events')
            .select(
              'id,company_id,title,starts_at,ends_at,suggested_agenda,priority,scope',
            )
            .order('starts_at', { ascending: true }),
        ]);
        if (companiesResult.error || crmResult.error || eventsResult.error)
          throw companiesResult.error ?? crmResult.error ?? eventsResult.error;

        const crmByCompany = new Map(
          (crmResult.data ?? []).map((row) => [row.company_id, row]),
        );
        const choices = (companiesResult.data ?? [])
          .filter((company) => {
            const status = String(
              crmByCompany.get(company.id)?.client_status ?? 'Não contratado',
            );
            return status !== 'Não contratado';
          })
          .map((company) => {
            const crm = crmByCompany.get(company.id);
            return {
              id: company.id,
              label: String(crm?.contact_name || company.display_name),
              whatsapp: String(crm?.whatsapp || crm?.contact_phone || ''),
              email: String(crm?.contact_email || ''),
            };
          });
        const choiceById = new Map(
          choices.map((choice) => [choice.id, choice]),
        );
        const mappedEvents = (eventsResult.data ?? []).flatMap((row) => {
          const choice = choiceById.get(row.company_id);
          if (!choice) return [];
          const startsAt = new Date(String(row.starts_at));
          const date = `${startsAt.getFullYear()}-${String(startsAt.getMonth() + 1).padStart(2, '0')}-${String(startsAt.getDate()).padStart(2, '0')}`;
          const agenda = Array.isArray(row.suggested_agenda)
            ? row.suggested_agenda.map(String)
            : [];
          const priority =
            row.priority === 'HIGH'
              ? 'Alta'
              : row.priority === 'MEDIUM'
                ? 'Média'
                : 'Normal';
          return [
            {
              scope: String(row.scope),
              appointment: {
                id: String(row.id),
                sourceId: String(row.id),
                companyId: String(row.company_id),
                date,
                day: startsAt.getDate(),
                time: startsAt.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                title: String(row.title),
                client: choice.label,
                priority,
                tone:
                  priority === 'Alta'
                    ? 'high'
                    : priority === 'Média'
                      ? 'medium'
                      : 'normal',
                whatsapp: choice.whatsapp
                  ? `https://wa.me/${choice.whatsapp.replace(/\D/g, '')}`
                  : '',
                email: choice.email ? `mailto:${choice.email}` : '',
                details:
                  agenda
                    .find((item) => item.startsWith('Detalhes: '))
                    ?.slice(10) ?? '',
                location:
                  agenda.find((item) => item.startsWith('Local: '))?.slice(7) ??
                  '',
                calendar:
                  String(row.scope) === 'PERSONAL'
                    ? ('personal' as const)
                    : ('general' as const),
                duration: Math.max(
                  30,
                  Math.round(
                    (new Date(String(row.ends_at)).getTime() -
                      startsAt.getTime()) /
                      60_000,
                  ) || 60,
                ),
                recurrence:
                  agenda
                    .find((item) => item.startsWith('Recorrência: '))
                    ?.slice(12) ?? 'Não repetir',
                reminder:
                  agenda
                    .find((item) => item.startsWith('Lembrete: '))
                    ?.slice(10) ?? '1 dia antes',
              },
            },
          ];
        });
        setClientChoices(choices);
        setGeneralItems(
          mappedEvents
            .filter((item) => item.scope !== 'PERSONAL')
            .map((item) => item.appointment),
        );
        setPersonalItems(
          mappedEvents
            .filter((item) => item.scope === 'PERSONAL')
            .map((item) => item.appointment),
        );
      } catch (error) {
        setClientChoices([]);
        setAppointmentNotice(
          `Não foi possível carregar o calendário: ${error instanceof Error ? error.message : 'erro de acesso ao banco'}.`,
        );
      }
    }
    void loadCalendar();
  }, []);
  async function addAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get('title')).trim();
    const clientId = String(data.get('client'));
    const selectedClient = clientChoices.find(
      (choice) => choice.id === clientId,
    );
    if (!selectedClient) {
      setAppointmentNotice('Selecione um cliente ou empresa válido.');
      return;
    }
    const time = String(data.get('time'));
    const date = String(data.get('date'));
    const startsAt = new Date(`${date}T${time}:00`);
    if (!title || !date || !time || Number.isNaN(startsAt.getTime())) {
      setAppointmentNotice('Preencha título, data e horário corretamente.');
      return;
    }
    const day = Number(date.split('-')[2]);
    const priority = String(data.get('priority'));
    const tone =
      priority === 'Alta' ? 'high' : priority === 'Média' ? 'medium' : 'normal';
    const phone = String(data.get('phone')).replace(/\D/g, '');
    const emailAddress = String(data.get('email')).trim();
    const details = String(data.get('details')).trim();
    const location = String(data.get('location')).trim();
    const calendar = String(data.get('calendar'));
    const duration = Number(data.get('duration') || 60);
    const recurrence = String(data.get('recurrence'));
    const reminder = String(data.get('reminder'));
    setSavingAppointment(true);
    setAppointmentNotice('Salvando compromisso no banco...');
    let savedId = '';
    try {
      const supabase = createClient({ detectSessionInUrl: false });
      const { data: authData, error: authError } =
        await supabase.auth.getUser();
      if (authError || !authData.user)
        throw authError ?? new Error('Sessão inválida');
      const values = {
        company_id: clientId,
        created_by: authData.user.id,
        assigned_profile_id: calendar === 'personal' ? authData.user.id : null,
        title,
        theme: 'Compromisso',
        starts_at: startsAt.toISOString(),
        ends_at: new Date(startsAt.getTime() + duration * 60_000).toISOString(),
        suggested_agenda: [
          `Detalhes: ${details}`,
          `Local: ${location}`,
          `Lembrete: ${reminder}`,
          `Recorrência: ${recurrence}`,
          `WhatsApp: ${phone}`,
          `E-mail: ${emailAddress}`,
        ],
        whatsapp_reminder_enabled: false,
        priority:
          priority === 'Alta'
            ? 'HIGH'
            : priority === 'Média'
              ? 'MEDIUM'
              : 'NORMAL',
        booked_with_owner: true,
        scope: calendar === 'personal' ? 'PERSONAL' : 'COMPANY',
      };
      const request = editingAppointment
        ? supabase
            .from('calendar_events')
            .update(values)
            .eq('id', editingAppointment.sourceId)
        : supabase.from('calendar_events').insert(values);
      const { data: saved, error } = await request.select('id').single();
      if (error) throw error;
      savedId = String(saved.id);
    } catch (error) {
      setAppointmentNotice(
        `Compromisso não salvo: ${error instanceof Error ? error.message : 'o banco recusou os dados'}.`,
      );
      setSavingAppointment(false);
      return;
    }
    const item: Appointment = {
      id: savedId,
      sourceId: savedId,
      companyId: clientId,
      date,
      day,
      time,
      title,
      client: selectedClient.label,
      priority,
      tone,
      whatsapp: phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(`Olá! Lembrete: ${title} às ${time}.`)}`
        : '',
      email: emailAddress
        ? `mailto:${emailAddress}?subject=${encodeURIComponent(`Lembrete - ${title}`)}&body=${encodeURIComponent(`${details}${location ? `\nLocal: ${location}` : ''}`)}`
        : '',
      details,
      location,
      calendar: calendar === 'personal' ? 'personal' : 'general',
      duration,
      recurrence,
      reminder,
    };
    setGeneralItems((current) =>
      current.filter((currentItem) => currentItem.sourceId !== item.sourceId),
    );
    setPersonalItems((current) =>
      current.filter((currentItem) => currentItem.sourceId !== item.sourceId),
    );
    if (calendar === 'personal') {
      setPersonalItems((current) => [...current, item]);
      setCalendarView('personal');
    } else {
      setGeneralItems((current) => [...current, item]);
      setCalendarView('general');
    }
    setShowAppointmentForm(false);
    setSelectedDay(day);
    setPeriod(date.slice(0, 7));
    setAppointmentNotice(
      `${title} foi ${editingAppointment ? 'atualizado' : 'salvo'} no banco e no calendário.`,
    );
    setEditingAppointment(null);
    setAppointmentClientId('');
    setAppointmentPhone('');
    setAppointmentEmail('');
    setSavingAppointment(false);
  }
  function openAppointmentForm(item?: Appointment) {
    setEditingAppointment(item ?? null);
    setAppointmentClientId(item?.companyId ?? '');
    const choice = clientChoices.find(
      (client) => client.id === item?.companyId,
    );
    setAppointmentPhone(choice?.whatsapp ?? '');
    setAppointmentEmail(choice?.email ?? '');
    setShowAppointmentForm(true);
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
              onClick={() => openAppointmentForm()}
            >
              ＋ {en ? 'New appointment' : 'Novo compromisso'}
            </button>
          </div>
        </header>
        {appointmentNotice && (
          <p className={styles.appointmentNotice}>✓ {appointmentNotice}</p>
        )}
        {showAppointmentForm && (
          <form
            key={editingAppointment?.id ?? 'new'}
            className={styles.appointmentForm}
            onSubmit={addAppointment}
          >
            <header>
              <div>
                <b>
                  {editingAppointment
                    ? 'Editar compromisso'
                    : 'Novo compromisso'}
                </b>
                <small>
                  Cadastre o evento e escolha em qual agenda ele aparecerá.
                </small>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAppointmentForm(false);
                  setEditingAppointment(null);
                }}
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
                  defaultValue={editingAppointment?.title ?? ''}
                />
              </label>
              <label>
                Cliente / empresa
                <select
                  name="client"
                  required
                  value={appointmentClientId}
                  onChange={(event) => {
                    const id = event.target.value;
                    const choice = clientChoices.find((item) => item.id === id);
                    setAppointmentClientId(id);
                    setAppointmentPhone(choice?.whatsapp ?? '');
                    setAppointmentEmail(choice?.email ?? '');
                  }}
                >
                  <option value="" disabled>
                    Selecione empresa, pessoa e perfil
                  </option>
                  {clientChoices.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Agenda
                <select
                  name="calendar"
                  defaultValue={editingAppointment?.calendar ?? calendarView}
                >
                  <option value="general">Agenda geral</option>
                  <option value="personal">Agenda pessoal</option>
                </select>
              </label>
              <label>
                Data
                <input
                  name="date"
                  type="date"
                  defaultValue={
                    editingAppointment?.date ??
                    `${period}-${String(selectedDay ?? 14).padStart(2, '0')}`
                  }
                  required
                />
              </label>
              <label>
                Horário
                <input
                  name="time"
                  type="time"
                  required
                  defaultValue={editingAppointment?.time ?? ''}
                />
              </label>
              <label>
                Duração
                <select
                  name="duration"
                  defaultValue={String(editingAppointment?.duration ?? 60)}
                >
                  <option value="30">30 minutos</option>
                  <option value="60">1 hora</option>
                  <option value="90">1 hora e 30 minutos</option>
                  <option value="120">2 horas</option>
                </select>
              </label>
              <label>
                Recorrência
                <select
                  name="recurrence"
                  defaultValue={editingAppointment?.recurrence ?? 'Não repetir'}
                >
                  <option>Não repetir</option>
                  <option>Semanal</option>
                  <option>Quinzenal</option>
                  <option>Mensal</option>
                </select>
              </label>
              <label>
                Prioridade
                <select
                  name="priority"
                  defaultValue={editingAppointment?.priority ?? 'Alta'}
                >
                  <option>Alta</option>
                  <option>Média</option>
                  <option>Normal</option>
                </select>
              </label>
              <label>
                WhatsApp
                <input
                  name="phone"
                  type="tel"
                  placeholder="5511999999999"
                  value={appointmentPhone}
                  onChange={(event) => setAppointmentPhone(event.target.value)}
                />
              </label>
              <label>
                E-mail
                <input
                  name="email"
                  type="email"
                  placeholder="cliente@empresa.com"
                  value={appointmentEmail}
                  onChange={(event) => setAppointmentEmail(event.target.value)}
                />
              </label>
              <label>
                Local ou link da reunião
                <input
                  name="location"
                  placeholder="Endereço, Google Meet ou outro link"
                  defaultValue={editingAppointment?.location ?? ''}
                />
              </label>
              <label>
                Lembrete
                <select
                  name="reminder"
                  defaultValue={editingAppointment?.reminder ?? '1 dia antes'}
                >
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
                  defaultValue={editingAppointment?.details ?? ''}
                />
              </label>
            </div>
            <footer>
              <button
                type="button"
                onClick={() => {
                  setShowAppointmentForm(false);
                  setEditingAppointment(null);
                }}
              >
                Cancelar
              </button>
              <button disabled={savingAppointment}>
                {savingAppointment
                  ? 'Salvando...'
                  : editingAppointment
                    ? 'Salvar alterações'
                    : 'Salvar compromisso'}
              </button>
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
            <div className={styles.upcomingScroller}>
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
                <article className={styles.upcomingRow} key={item.id}>
                  <strong>{item.time}</strong>
                  <span className={styles[item.tone]} />
                  <div className={styles.appointmentDetails}>
                    <p className={styles.appointmentMain}>
                      <b>{item.title}</b>
                      <small>{item.client}</small>
                    </p>
                    <p className={styles.appointmentMeta}>
                      <small>{item.duration} min</small>
                      <small>{item.recurrence}</small>
                      <small>{item.reminder}</small>
                      {item.location && (
                        <small title={item.location}>
                          Local: {item.location}
                        </small>
                      )}
                      {item.details && (
                        <small title={item.details}>
                          Pauta: {item.details}
                        </small>
                      )}
                    </p>
                  </div>
                  <em className={styles[item.tone]}>{item.priority}</em>
                  <div className={styles.contactActions}>
                    <button
                      type="button"
                      className={styles.editAppointment}
                      onClick={() => openAppointmentForm(item)}
                    >
                      Editar
                    </button>
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
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}
