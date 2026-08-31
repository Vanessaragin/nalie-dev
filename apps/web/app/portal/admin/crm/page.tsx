'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import AccessLegend from '../../../components/access-legend';
import MenuToggle from '../../../components/menu-toggle';
import PortalNavigation from '../../portal-navigation';
import CompanySwitcher from '../../../components/company-switcher';
import shell from '../../styles.module.css';
import styles from './styles.module.css';
import { createClient } from '../../../../lib/supabase/client';
import {
  type ClientStatus,
  type CrmClient,
  initialCrmData,
  latestByCompetence,
  money,
} from './crm-data';

const tabs = [
  'Resumo',
  'Contato',
  'Acompanhamento',
  'Entregas',
  'Pagamentos',
  'Histórico',
  'Materiais',
  'BI e apresentação',
] as const;
type Tab = (typeof tabs)[number];
const workflowStages = [
  'A fazer',
  'Em andamento',
  'Aguardando',
  'Concluído',
] as const;
type WorkflowStage = (typeof workflowStages)[number];

function whatsappNumber(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

function phoneDigits(value: FormDataEntryValue | null) {
  return String(value ?? '').replace(/\D/g, '');
}

const contactStatuses: ClientStatus[] = [
  'Lead',
  'Em contato',
  'Aguardando informações',
  'Pesquisa / diagnóstico',
  'Cotação solicitada',
  'Proposta enviada',
  'Em negociação',
  'Negociação concluída',
  'Sem interesse',
];
const contractStatuses: ClientStatus[] = [
  'Não contratado',
  'Contratado ativo',
  'Pausado',
  'Encerrado',
];
const administratorEmails = ['naliedados@gmail.com', 'reginaragin@gmail.com'];
const administratorClientId = 'ADMINISTRATOR';
const clientStatuses = [...contactStatuses, ...contractStatuses];

function contactStatus(value: unknown): ClientStatus {
  const status = String(value ?? 'Lead');
  if (status === 'Acompanhamento ativo' || status === 'Cliente')
    return 'Negociação concluída';
  return contactStatuses.includes(status as ClientStatus)
    ? (status as ClientStatus)
    : 'Lead';
}

function contractStatus(value: unknown): ClientStatus {
  const status = String(value ?? 'Não contratado');
  if (status === 'Cliente' || status === 'Acompanhamento ativo')
    return 'Contratado ativo';
  return contractStatuses.includes(status as ClientStatus)
    ? (status as ClientStatus)
    : 'Não contratado';
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(
    `${value.length === 10 ? value + 'T12:00:00' : value}`,
  ).toLocaleDateString('pt-BR');
}

async function persistAnalysisLinks(client: CrmClient, form: FormData) {
  if (!client.companyId) return;
  const supabase = createClient();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) throw new Error('Sessão inválida.');
  const accessScope =
    String(form.get('contentAccess')) === 'Restrito' ? 'RESTRICTED' : 'COMPANY';
  const entries = [
    ['DASHBOARD', 'Dashboard/BI', String(form.get('dashboardUrl'))],
    ['PRESENTATION', 'Apresentação', String(form.get('presentationUrl'))],
    [
      'EXCEL_1',
      String(form.get('excelName1')).trim() || 'Excel 1',
      String(form.get('excelUrl1')),
    ],
    [
      'EXCEL_2',
      String(form.get('excelName2')).trim() || 'Excel 2',
      String(form.get('excelUrl2')),
    ],
  ] as const;
  const configured = entries.filter(([, , url]) => url.trim());
  if (configured.length) {
    const { error } = await supabase.from('company_analysis_links').upsert(
      configured.map(([linkType, displayName, sourceUrl]) => ({
        company_id: client.companyId,
        link_type: linkType,
        display_name: displayName,
        source_url: sourceUrl.trim(),
        access_scope: accessScope,
        status: 'PUBLISHED',
        updated_by: userId,
      })),
      { onConflict: 'company_id,link_type' },
    );
    if (error) throw error;
  }
  const removedTypes = entries
    .filter(([, , url]) => !url.trim())
    .map(([linkType]) => linkType);
  if (removedTypes.length) {
    const { error } = await supabase
      .from('company_analysis_links')
      .delete()
      .eq('company_id', client.companyId)
      .in('link_type', removedTypes);
    if (error) throw error;
  }
}

async function persistClient(client: CrmClient) {
  if (!client.companyId) return;
  const supabase = createClient({ detectSessionInUrl: false });
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) throw new Error('Sessão inválida.');
  const [{ error: companyError }, { error: crmError }] = await Promise.all([
    supabase
      .from('companies')
      .update({
        legal_name: client.company,
        display_name: client.company,
        entity_type: client.personType === 'physical' ? 'personal' : 'company',
        legal_document:
          client.personType === 'legal' ? client.legalDocument || null : null,
        city: client.city || null,
        region: client.state || null,
        updated_at: client.updatedAt,
      })
      .eq('id', client.companyId),
    supabase.from('client_crm').upsert({
      company_id: client.companyId,
      contact_name: client.name,
      contact_phone: client.phone || null,
      contact_email: client.email || null,
      whatsapp: client.whatsapp || null,
      instagram_handle: client.instagram || null,
      notes: client.notes || null,
      lifecycle_stage: client.clientStatus,
      contact_status: client.contactStatus,
      client_status: client.clientStatus,
      service_interest: client.serviceInterest || null,
      contracted_service: client.contractedService || null,
      service_start_date: client.startDate || null,
      contract_value: client.contractValue,
      periodicity: client.periodicity || null,
      owner_name: client.owner || null,
      updated_by: userId,
      updated_at: client.updatedAt,
    }),
  ]);
  if (companyError) throw companyError;
  if (crmError) throw crmError;
}

async function persistCrmActivity(
  client: CrmClient,
  kind: string,
  title: string,
  metadata: Record<string, unknown>,
  occurredAt?: string,
) {
  if (!client.companyId) throw new Error('Cliente sem empresa vinculada.');
  const supabase = createClient({ detectSessionInUrl: false });
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) throw new Error('Sessão inválida.');
  const { error } = await supabase.from('client_activities').insert({
    company_id: client.companyId,
    profile_id: userId,
    kind,
    title,
    metadata,
    occurred_at: occurredAt || new Date().toISOString(),
  });
  if (error) throw error;
}

async function persistAdministrativeActivity(
  title: string,
  metadata: Record<string, unknown>,
) {
  const supabase = createClient({ detectSessionInUrl: false });
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  const email = authData.user?.email?.toLowerCase();
  if (!userId || !email || !administratorEmails.includes(email))
    throw new Error('Acesso mestre não identificado.');
  const { error } = await supabase.from('admin_activities').insert({
    profile_id: userId,
    activity_type: String(metadata.type ?? 'Atividade administrativa'),
    title,
    due_at: String(metadata.dueAt),
    priority: String(metadata.priority),
    owner_name: String(metadata.owner),
    completed: Boolean(metadata.completed),
    metadata: { administrator_emails: administratorEmails },
  });
  if (error) throw error;
}

function State({
  value,
}: {
  value: 'Concluído' | 'Pendente' | 'Atrasado' | 'Aguardando';
}) {
  return (
    <span
      className={`${styles.state} ${styles[value.toLowerCase().replace('í', 'i')]}`}
    >
      ● {value}
    </span>
  );
}

export default function CrmPage() {
  const [data, setData] = useState(initialCrmData);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Resumo');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [paymentFilter, setPaymentFilter] = useState('Todos');
  const [pendingFilter, setPendingFilter] = useState('Todos');
  const [sort, setSort] = useState('name');
  const [modal, setModal] = useState<
    | 'client'
    | 'period'
    | 'interaction'
    | 'payment'
    | 'delivery'
    | 'action'
    | 'file'
    | null
  >(null);
  const [notice, setNotice] = useState('');
  const [formError, setFormError] = useState('');
  const [savingClient, setSavingClient] = useState(false);
  const [editingClient, setEditingClient] = useState(false);
  const [activityStages, setActivityStages] = useState<
    Record<string, WorkflowStage>
  >({
    'PRX-001': 'Em andamento',
    'PRX-002': 'Aguardando',
    'PRX-003': 'A fazer',
  });
  useEffect(() => {
    let active = true;
    async function loadClients() {
      try {
        const supabase = createClient({ detectSessionInUrl: false });
        const [
          companiesResult,
          crmResult,
          membershipsResult,
          linksResult,
          activitiesResult,
          adminActivitiesResult,
        ] = await Promise.all([
          supabase
            .from('companies')
            .select(
              'id,legal_name,display_name,entity_type,legal_document,city,region,country,created_at,updated_at,status',
            )
            .eq('status', 'ACTIVE')
            .order('display_name'),
          supabase.from('client_crm').select('*'),
          supabase
            .from('company_users')
            .select(
              'id,company_id,profile_id,access_level,profiles(display_name,public_email)',
            ),
          supabase
            .from('company_analysis_links')
            .select(
              'company_id,link_type,display_name,source_url,access_scope',
            ),
          supabase
            .from('client_activities')
            .select('id,company_id,kind,title,metadata,occurred_at')
            .order('occurred_at', { ascending: false }),
          supabase
            .from('admin_activities')
            .select(
              'id,activity_type,title,due_at,priority,owner_name,completed',
            )
            .order('due_at', { ascending: true }),
        ]);
        if (
          companiesResult.error ||
          crmResult.error ||
          membershipsResult.error ||
          linksResult.error ||
          activitiesResult.error ||
          adminActivitiesResult.error ||
          !active
        )
          return;
        const crms = new Map(
          (crmResult.data ?? []).map((row) => [row.company_id, row]),
        );
        const linksByCompany = new Map<string, typeof linksResult.data>();
        for (const link of linksResult.data ?? []) {
          const current = linksByCompany.get(link.company_id) ?? [];
          current.push(link);
          linksByCompany.set(link.company_id, current);
        }
        const clients: CrmClient[] = (companiesResult.data ?? []).map(
          (company) => {
            const crm = crms.get(company.id) as
              | Record<string, unknown>
              | undefined;
            const links = linksByCompany.get(company.id) ?? [];
            const byType = (type: string) =>
              links.find((link) => link.link_type === type);
            const memberships = (membershipsResult.data ?? []).filter(
              (membership) => membership.company_id === company.id,
            );
            return {
              id: `CLI-${company.id.slice(0, 8).toUpperCase()}`,
              companyId: company.id,
              personType:
                company.entity_type === 'personal' ? 'physical' : 'legal',
              legalDocument: String(company.legal_document ?? ''),
              portalUsers: memberships.map((membership) => {
                const profile = Array.isArray(membership.profiles)
                  ? membership.profiles[0]
                  : membership.profiles;
                return {
                  id: membership.profile_id,
                  membershipId: membership.id,
                  email: String(profile?.public_email ?? ''),
                  access: membership.access_level as 'COMPLETE' | 'LIMITED',
                };
              }),
              name: String(crm?.contact_name ?? company.display_name),
              company: company.display_name,
              whatsapp: String(crm?.whatsapp ?? ''),
              phone: String(crm?.contact_phone ?? ''),
              email: String(crm?.contact_email ?? ''),
              instagram: String(crm?.instagram_handle ?? ''),
              city: company.city ?? '',
              state: company.region ?? '',
              country: company.country === 'BR' ? 'Brasil' : company.country,
              notes: String(crm?.notes ?? ''),
              contactStatus: contactStatus(crm?.contact_status),
              clientStatus: contractStatus(crm?.client_status),
              serviceInterest: String(crm?.service_interest ?? ''),
              contractedService: String(crm?.contracted_service ?? ''),
              startDate: String(crm?.service_start_date ?? ''),
              contractValue: Number(crm?.contract_value ?? 0),
              periodicity: String(crm?.periodicity ?? 'Mensal'),
              dashboardUrl: byType('DASHBOARD')?.source_url ?? '',
              presentationUrl: byType('PRESENTATION')?.source_url ?? '',
              excelName1: byType('EXCEL_1')?.display_name ?? '',
              excelUrl1: byType('EXCEL_1')?.source_url ?? '',
              excelName2: byType('EXCEL_2')?.display_name ?? '',
              excelUrl2: byType('EXCEL_2')?.source_url ?? '',
              contentAccess: links.some(
                (link) => link.access_scope === 'RESTRICTED',
              )
                ? 'Restrito'
                : 'Empresa',
              owner: String(crm?.owner_name ?? 'Vanessa Rodrigues'),
              createdAt: company.created_at,
              updatedAt: String(crm?.updated_at ?? company.updated_at),
            };
          },
        );
        const clientIdByCompany = new Map(
          clients.map((client) => [client.companyId, client.id]),
        );
        const activities = activitiesResult.data ?? [];
        const records = (kind: string) =>
          activities.filter(
            (activity) =>
              activity.kind === kind &&
              clientIdByCompany.has(activity.company_id),
          );
        setData((current) => ({
          ...current,
          clients,
          followUps: records('FOLLOW_UP').map((activity) => {
            const m = activity.metadata as Record<string, unknown>;
            return {
              id: String(activity.id),
              clientId: clientIdByCompany.get(activity.company_id)!,
              competence: String(m.competence ?? ''),
              received: Boolean(m.received),
              receivedAt: String(m.receivedAt ?? ''),
              documentSummary: String(m.documentSummary ?? ''),
              completeness: String(m.completeness ?? 'Incompleto') as
                | 'Completo'
                | 'Incompleto',
              pendingItems: String(m.pendingItems ?? ''),
              lastDocumentReminderAt: String(m.lastDocumentReminderAt ?? ''),
              createdAt: activity.occurred_at,
              updatedAt: activity.occurred_at,
            };
          }),
          processings: records('PROCESSING').map((activity) => {
            const m = activity.metadata as Record<string, unknown>;
            return {
              id: String(activity.id),
              clientId: clientIdByCompany.get(activity.company_id)!,
              competence: String(m.competence ?? ''),
              sent: Boolean(m.sent),
              processedAt: String(m.processedAt ?? ''),
              completed: Boolean(m.completed),
              externalProcessingId: String(m.externalProcessingId ?? ''),
              status: String(m.status ?? ''),
              notes: String(m.notes ?? ''),
              createdAt: activity.occurred_at,
              updatedAt: activity.occurred_at,
            };
          }),
          deliveries: records('DELIVERY').map((activity) => {
            const m = activity.metadata as Record<string, unknown>;
            return {
              id: String(activity.id),
              clientId: clientIdByCompany.get(activity.company_id)!,
              competence: String(m.competence ?? ''),
              sent: Boolean(m.sent),
              sentAt: String(m.sentAt ?? ''),
              type: String(m.type ?? ''),
              reportSent: Boolean(m.reportSent),
              reportUrl: String(m.reportUrl ?? ''),
              dashboardUrl: String(m.dashboardUrl ?? ''),
              presentationUrl: String(m.presentationUrl ?? ''),
              otherUrl: String(m.otherUrl ?? ''),
              notes: String(m.notes ?? ''),
              createdAt: activity.occurred_at,
              updatedAt: activity.occurred_at,
            };
          }),
          payments: records('PAYMENT').map((activity) => {
            const m = activity.metadata as Record<string, unknown>;
            return {
              id: String(activity.id),
              clientId: clientIdByCompany.get(activity.company_id)!,
              competence: String(m.competence ?? ''),
              expectedAmount: Number(m.expectedAmount ?? 0),
              receivedAmount: Number(m.receivedAmount ?? 0),
              received: Boolean(m.received),
              paidAt: String(m.paidAt ?? ''),
              method: String(m.method ?? ''),
              status: String(m.status ?? 'Pendente') as
                | 'Pendente'
                | 'Pago'
                | 'Parcial'
                | 'Em atraso',
              notes: String(m.notes ?? ''),
              createdAt: activity.occurred_at,
              updatedAt: activity.occurred_at,
            };
          }),
          interactions: records('INTERACTION').map((activity) => {
            const m = activity.metadata as Record<string, unknown>;
            return {
              id: String(activity.id),
              clientId: clientIdByCompany.get(activity.company_id)!,
              occurredAt: activity.occurred_at,
              type: String(m.type ?? ''),
              channel: String(m.channel ?? ''),
              description: String(m.description ?? ''),
              owner: String(m.owner ?? ''),
              nextAction: String(m.nextAction ?? ''),
              nextActionAt: String(m.nextActionAt ?? ''),
            };
          }),
          nextActions: [
            ...records('NEXT_ACTION').map((activity) => {
              const m = activity.metadata as Record<string, unknown>;
              return {
                id: String(activity.id),
                clientId: clientIdByCompany.get(activity.company_id)!,
                type: String(m.type ?? ''),
                title: activity.title,
                dueAt: String(m.dueAt ?? ''),
                priority: String(m.priority ?? 'Normal') as
                  | 'Alta'
                  | 'Média'
                  | 'Normal',
                owner: String(m.owner ?? ''),
                completed: Boolean(m.completed),
              };
            }),
            ...(adminActivitiesResult.data ?? []).map((activity) => ({
              id: `ADMIN-${activity.id}`,
              clientId: administratorClientId,
              type: activity.activity_type,
              title: activity.title,
              dueAt: activity.due_at,
              priority: activity.priority as 'Alta' | 'Média' | 'Normal',
              owner: activity.owner_name,
              completed: activity.completed,
            })),
          ],
          files: records('MATERIAL').map((activity) => {
            const m = activity.metadata as Record<string, unknown>;
            return {
              id: String(activity.id),
              clientId: clientIdByCompany.get(activity.company_id)!,
              category: String(m.category ?? ''),
              title: activity.title,
              url: String(m.url ?? ''),
              externalReference: true,
              createdAt: activity.occurred_at,
            };
          }),
        }));
      } catch {
        setData(initialCrmData);
      }
    }
    void loadClients();
    return () => {
      active = false;
    };
  }, []);

  const selected =
    data.clients.find((client) => client.id === selectedId) ?? null;
  const rows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return data.clients
      .filter((client) => {
        const follow = latestByCompetence(data.followUps, client.id);
        const payment = latestByCompetence(data.payments, client.id);
        const haystack = [
          client.id,
          client.name,
          client.company,
          client.phone,
          client.whatsapp,
          client.email,
        ]
          .join(' ')
          .toLowerCase();
        return (
          (!normalized || haystack.includes(normalized)) &&
          (statusFilter === 'Todos' ||
            client.clientStatus === statusFilter ||
            client.contactStatus === statusFilter) &&
          (paymentFilter === 'Todos' || payment?.status === paymentFilter) &&
          (pendingFilter === 'Todos' ||
            (pendingFilter === 'Com pendências'
              ? Boolean(follow?.pendingItems)
              : !follow?.pendingItems))
        );
      })
      .sort((a, b) =>
        sort === 'company'
          ? a.company.localeCompare(b.company)
          : sort === 'updated'
            ? b.updatedAt.localeCompare(a.updatedAt)
            : a.name.localeCompare(b.name),
      );
  }, [data, search, statusFilter, paymentFilter, pendingFilter, sort]);

  function setActivityStage(actionId: string, stage: WorkflowStage) {
    setActivityStages((current) => ({ ...current, [actionId]: stage }));
    setData((current) => ({
      ...current,
      nextActions: current.nextActions.map((action) =>
        action.id === actionId
          ? { ...action, completed: stage === 'Concluído' }
          : action,
      ),
    }));
    setNotice(`Atividade movida para ${stage}.`);
  }

  function openClient(client: CrmClient) {
    setSelectedId(client.id);
    setActiveTab('Resumo');
  }

  async function saveClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setSavingClient(true);
    const form = new FormData(event.currentTarget);
    const clientStatus = String(form.get('clientStatus')) as ClientStatus;
    const contracted = clientStatus !== 'Não contratado';
    const contractValue = Number(form.get('contractValue'));
    if (
      contracted &&
      (!String(form.get('contractedService')).trim() || contractValue <= 0)
    ) {
      setFormError(
        'Para liberar o acesso, informe o serviço contratado e um valor maior que zero.',
      );
      setSavingClient(false);
      return;
    }
    const now = new Date().toISOString();
    let companyId = editingClient && selected ? selected.companyId : undefined;
    let portalUsers =
      editingClient && selected ? selected.portalUsers : undefined;
    const needsAccess = contracted && !portalUsers?.length;
    if (!editingClient || needsAccess) {
      setNotice('');
      try {
        const response = await fetch('/api/admin/companies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: editingClient ? companyId : undefined,
            provisionAccess: contracted,
            personType: String(form.get('personType')),
            name: String(form.get('name')),
            company: String(form.get('company') ?? form.get('name')),
            legalDocument: String(form.get('legalDocument') ?? ''),
            city: String(form.get('city')),
            state: String(form.get('state')),
            contractedService: String(form.get('contractedService')),
            contractValue,
            startDate: String(form.get('startDate')),
            periodicity: String(form.get('periodicity')),
            users: [
              {
                name: String(form.get('name')),
                email: String(form.get('email')),
              },
              {
                name: String(form.get('user2Name')),
                email: String(form.get('user2Email')),
              },
            ].filter((user) => user.name.trim() || user.email.trim()),
          }),
        });
        const result = (await response.json()) as {
          error?: string;
          companyId?: string;
          users?: CrmClient['portalUsers'];
        };
        if (!response.ok || !result.companyId) {
          setFormError(result.error ?? 'Não foi possível criar o cliente.');
          setSavingClient(false);
          return;
        }
        companyId = result.companyId;
        portalUsers = result.users;
      } catch {
        setFormError('Não foi possível conectar ao cadastro seguro.');
        setSavingClient(false);
        return;
      }
    }
    const client: CrmClient = {
      id:
        editingClient && selected
          ? selected.id
          : `CLI-${String(data.clients.length + 1).padStart(4, '0')}`,
      companyId,
      personType: String(form.get('personType')) as 'physical' | 'legal',
      legalDocument: String(form.get('legalDocument') ?? ''),
      portalUsers,
      name: String(form.get('name')),
      company: String(form.get('company') ?? form.get('name')),
      whatsapp: phoneDigits(form.get('whatsapp')),
      phone: phoneDigits(form.get('phone')),
      email: String(form.get('email')),
      instagram: String(form.get('instagram')),
      city: String(form.get('city')),
      state: String(form.get('state')),
      country: String(form.get('country')),
      notes: String(form.get('notes')),
      contactStatus: String(form.get('contactStatus')) as ClientStatus,
      clientStatus,
      serviceInterest: String(form.get('serviceInterest')),
      contractedService: String(form.get('contractedService')),
      startDate: String(form.get('startDate')),
      contractValue,
      periodicity: String(form.get('periodicity')),
      dashboardUrl:
        editingClient && selected ? (selected.dashboardUrl ?? '') : '',
      presentationUrl:
        editingClient && selected ? (selected.presentationUrl ?? '') : '',
      excelName1: editingClient && selected ? (selected.excelName1 ?? '') : '',
      excelUrl1: editingClient && selected ? (selected.excelUrl1 ?? '') : '',
      excelName2: editingClient && selected ? (selected.excelName2 ?? '') : '',
      excelUrl2: editingClient && selected ? (selected.excelUrl2 ?? '') : '',
      contentAccess:
        editingClient && selected
          ? (selected.contentAccess ?? 'Empresa')
          : 'Empresa',
      owner: String(form.get('owner')),
      createdAt: editingClient && selected ? selected.createdAt : now,
      updatedAt: now,
    };
    let synchronizationWarning = '';
    try {
      await persistClient(client);
    } catch {
      if (editingClient) {
        setFormError(
          'Não foi possível salvar as alterações. Tente novamente sem fechar o formulário.',
        );
        setSavingClient(false);
        return;
      }
      synchronizationWarning = contracted
        ? 'O acesso foi criado e o convite enviado, mas alguns detalhes do contato não foram sincronizados.'
        : 'O contato foi salvo sem enviar e-mail, mas alguns detalhes não foram sincronizados.';
    }
    setData((current) => ({
      ...current,
      clients: editingClient
        ? current.clients.map((item) => (item.id === client.id ? client : item))
        : [client, ...current.clients],
    }));
    setSavingClient(false);
    setModal(null);
    setSelectedId(client.id);
    setNotice(
      editingClient
        ? `${client.name} atualizado.`
        : synchronizationWarning ||
            (contracted
              ? `${client.name} cadastrado como cliente e acesso(s) vinculados. O convite de primeiro acesso foi enviado.`
              : `${client.name} salvo como contato. Nenhum acesso ou e-mail foi enviado.`),
    );
    setEditingClient(false);
  }

  async function saveRelated(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    const f = new FormData(event.currentTarget);
    if (!selected && modal !== 'action') return;
    const targetClientId = selected?.id ?? String(f.get('clientId'));
    if (!targetClientId) return;
    const now = new Date().toISOString();
    if (modal === 'action') {
      const action = {
        id: uid('PRX'),
        clientId: targetClientId,
        type: String(f.get('type')),
        title: String(f.get('title')),
        dueAt: String(f.get('dueAt')),
        priority: String(f.get('priority')) as 'Alta' | 'Média' | 'Normal',
        owner: String(f.get('owner')),
        completed: false,
      };
      setSavingClient(true);
      try {
        if (targetClientId === administratorClientId) {
          await persistAdministrativeActivity(action.title, action);
        } else {
          const targetClient = data.clients.find(
            (client) => client.id === targetClientId,
          );
          if (!targetClient) throw new Error('Cliente não encontrado.');
          await persistCrmActivity(targetClient, 'NEXT_ACTION', action.title, {
            type: action.type,
            dueAt: action.dueAt,
            priority: action.priority,
            owner: action.owner,
            completed: false,
          });
        }
      } catch {
        setSavingClient(false);
        setFormError(
          'A atividade não foi gravada no banco. O formulário foi mantido aberto para você tentar novamente.',
        );
        return;
      }
      setData((current) => ({
        ...current,
        nextActions: [action, ...current.nextActions],
      }));
      setSavingClient(false);
      setModal(null);
      setNotice('Atividade salva no banco com sucesso.');
      return;
    }
    if (modal === 'period') {
      const competence = String(f.get('competence'));
      setData((current) => ({
        ...current,
        followUps: [
          {
            id: uid('ACO'),
            clientId: targetClientId,
            competence,
            received: f.get('received') === 'yes',
            receivedAt: String(f.get('receivedAt')),
            documentSummary: String(f.get('documents')),
            completeness: String(f.get('completeness')) as
              | 'Completo'
              | 'Incompleto',
            pendingItems: String(f.get('pendingItems')),
            lastDocumentReminderAt: String(f.get('lastReminder')),
            createdAt: now,
            updatedAt: now,
          },
          ...current.followUps,
        ],
        processings: [
          {
            id: uid('PRO'),
            clientId: targetClientId,
            competence,
            sent: f.get('sent') === 'yes',
            processedAt: String(f.get('processedAt')),
            completed: f.get('completed') === 'yes',
            externalProcessingId: String(f.get('processingId')),
            status: String(f.get('processingStatus')),
            notes: String(f.get('processingNotes')),
            createdAt: now,
            updatedAt: now,
          },
          ...current.processings,
        ],
      }));
    }
    if (modal === 'interaction')
      setData((current) => ({
        ...current,
        interactions: [
          {
            id: uid('INT'),
            clientId: targetClientId,
            occurredAt: String(f.get('occurredAt')),
            type: String(f.get('type')),
            channel: String(f.get('channel')),
            description: String(f.get('description')),
            owner: String(f.get('owner')),
            nextAction: String(f.get('nextAction')),
            nextActionAt: String(f.get('nextActionAt')),
          },
          ...current.interactions,
        ],
      }));
    if (modal === 'payment')
      setData((current) => ({
        ...current,
        payments: [
          {
            id: uid('PAG'),
            clientId: targetClientId,
            competence: String(f.get('competence')),
            expectedAmount: Number(f.get('expected')),
            receivedAmount: Number(f.get('receivedAmount')),
            received: String(f.get('status')) === 'Pago',
            paidAt: String(f.get('paidAt')),
            method: String(f.get('method')),
            status: String(f.get('status')) as
              | 'Pendente'
              | 'Pago'
              | 'Parcial'
              | 'Em atraso',
            notes: String(f.get('notes')),
            createdAt: now,
            updatedAt: now,
          },
          ...current.payments,
        ],
      }));
    if (modal === 'delivery')
      setData((current) => ({
        ...current,
        deliveries: [
          {
            id: uid('ENT'),
            clientId: targetClientId,
            competence: String(f.get('competence')),
            sent: f.get('sent') === 'yes',
            sentAt: String(f.get('sentAt')),
            type: String(f.get('type')),
            reportSent: f.get('reportSent') === 'yes',
            reportUrl: String(f.get('reportUrl')),
            dashboardUrl: String(f.get('dashboardUrl')),
            presentationUrl: String(f.get('presentationUrl')),
            otherUrl: String(f.get('otherUrl')),
            notes: String(f.get('notes')),
            createdAt: now,
            updatedAt: now,
          },
          ...current.deliveries,
        ],
      }));
    if (modal === 'file')
      setData((current) => ({
        ...current,
        files: [
          {
            id: uid('ARQ'),
            clientId: targetClientId,
            category: String(f.get('category')),
            title: String(f.get('title')),
            url: String(f.get('url')),
            externalReference: true,
            createdAt: now,
          },
          ...current.files,
        ],
      }));
    const targetClient = data.clients.find(
      (client) => client.id === targetClientId,
    );
    if (targetClient) {
      const save = (
        kind: string,
        title: string,
        metadata: Record<string, unknown>,
        occurredAt?: string,
      ) =>
        persistCrmActivity(
          targetClient,
          kind,
          title,
          metadata,
          occurredAt,
        ).catch(() =>
          setNotice(
            'O registro ficou visível nesta sessão, mas não pôde ser sincronizado com o banco.',
          ),
        );
      if (modal === 'period') {
        const competence = String(f.get('competence'));
        void save('FOLLOW_UP', `Acompanhamento ${competence}`, {
          competence,
          received: f.get('received') === 'yes',
          receivedAt: String(f.get('receivedAt')),
          documentSummary: String(f.get('documents')),
          completeness: String(f.get('completeness')),
          pendingItems: String(f.get('pendingItems')),
          lastDocumentReminderAt: String(f.get('lastReminder')),
        });
        void save('PROCESSING', `Processamento ${competence}`, {
          competence,
          sent: f.get('sent') === 'yes',
          processedAt: String(f.get('processedAt')),
          completed: f.get('completed') === 'yes',
          externalProcessingId: String(f.get('processingId')),
          status: String(f.get('processingStatus')),
          notes: String(f.get('processingNotes')),
        });
      }
      if (modal === 'interaction')
        void save(
          'INTERACTION',
          String(f.get('description')) || 'Interação com cliente',
          {
            type: String(f.get('type')),
            channel: String(f.get('channel')),
            description: String(f.get('description')),
            owner: String(f.get('owner')),
            nextAction: String(f.get('nextAction')),
            nextActionAt: String(f.get('nextActionAt')),
          },
          String(f.get('occurredAt')),
        );
      if (modal === 'payment')
        void save('PAYMENT', `Pagamento ${String(f.get('competence'))}`, {
          competence: String(f.get('competence')),
          expectedAmount: Number(f.get('expected')),
          receivedAmount: Number(f.get('receivedAmount')),
          received: String(f.get('status')) === 'Pago',
          paidAt: String(f.get('paidAt')),
          method: String(f.get('method')),
          status: String(f.get('status')),
          notes: String(f.get('notes')),
        });
      if (modal === 'delivery')
        void save('DELIVERY', `Entrega ${String(f.get('competence'))}`, {
          competence: String(f.get('competence')),
          sent: f.get('sent') === 'yes',
          sentAt: String(f.get('sentAt')),
          type: String(f.get('type')),
          reportSent: f.get('reportSent') === 'yes',
          reportUrl: String(f.get('reportUrl')),
          dashboardUrl: String(f.get('dashboardUrl')),
          presentationUrl: String(f.get('presentationUrl')),
          otherUrl: String(f.get('otherUrl')),
          notes: String(f.get('notes')),
        });
      if (modal === 'file')
        void save('MATERIAL', String(f.get('title')), {
          category: String(f.get('category')),
          url: String(f.get('url')),
          externalReference: true,
        });
    }
    setModal(null);
    setNotice('Registro adicionado sem sobrescrever o histórico anterior.');
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
            <h1>Contatos / Clientes CRM</h1>
            <p>
              Relacionamento, operação, entregas e pagamentos em uma única visão
              administrativa.
            </p>
          </div>
          <div className={shell.filters}>
            <button
              className={shell.import}
              onClick={() => {
                setEditingClient(false);
                setFormError('');
                setModal('client');
              }}
            >
              ＋ Novo contato ou cliente
            </button>
          </div>
        </header>
        {notice && (
          <p className={styles.notice} role="status">
            ✓ {notice}
          </p>
        )}

        <section className={styles.workflow} aria-label="Fluxo de atividades">
          <div className={styles.workflowTitle}>
            <div>
              <h2>Fluxo de atividades</h2>
              <p>Conclua uma atividade ou mova para a próxima etapa.</p>
            </div>
            <button
              onClick={() => {
                setFormError('');
                setModal('action');
              }}
            >
              ＋ Nova atividade
            </button>
          </div>
          {workflowStages.map((stage) => {
            const actions = data.nextActions.filter(
              (action) =>
                (activityStages[action.id] ??
                  (action.completed ? 'Concluído' : 'A fazer')) === stage,
            );
            return (
              <section className={styles.workflowGroup} key={stage}>
                <header>
                  <strong>{stage}</strong>
                  <span>{actions.length}</span>
                </header>
                <div className={styles.activityHeader} aria-hidden="true">
                  <span>Atividade</span>
                  <span>Cliente</span>
                  <span>Responsável</span>
                  <span>Prazo</span>
                  <span>Prioridade</span>
                  <span>Etapa</span>
                </div>
                {actions.map((action) => {
                  const administrative =
                    action.clientId === administratorClientId;
                  const client = administrative
                    ? undefined
                    : data.clients.find((item) => item.id === action.clientId);
                  const index = workflowStages.indexOf(stage);
                  return (
                    <div className={styles.activityRow} key={action.id}>
                      <label className={styles.activityName}>
                        <input
                          type="checkbox"
                          checked={stage === 'Concluído'}
                          onChange={(event) =>
                            setActivityStage(
                              action.id,
                              event.target.checked ? 'Concluído' : 'A fazer',
                            )
                          }
                        />
                        <button
                          type="button"
                          onClick={() => client && openClient(client)}
                        >
                          {action.title}
                        </button>
                      </label>
                      <span>
                        {administrative
                          ? 'Administrador'
                          : (client?.name ?? 'Cliente não encontrado')}
                        <small>
                          {administrative
                            ? administratorEmails.join(' · ')
                            : client?.company || 'Pessoa física'}
                        </small>
                      </span>
                      <span>{action.owner}</span>
                      <span>{formatDate(action.dueAt)}</span>
                      <em data-priority={action.priority}>{action.priority}</em>
                      <div className={styles.stageActions}>
                        <button
                          disabled={index === 0}
                          onClick={() =>
                            setActivityStage(
                              action.id,
                              workflowStages[index - 1],
                            )
                          }
                          aria-label={`Voltar ${action.title}`}
                        >
                          ‹
                        </button>
                        <select
                          aria-label={`Etapa de ${action.title}`}
                          value={stage}
                          onChange={(event) =>
                            setActivityStage(
                              action.id,
                              event.target.value as WorkflowStage,
                            )
                          }
                        >
                          {workflowStages.map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                        <button
                          disabled={index === workflowStages.length - 1}
                          onClick={() =>
                            setActivityStage(
                              action.id,
                              workflowStages[index + 1],
                            )
                          }
                          aria-label={`Avançar ${action.title}`}
                        >
                          ›
                        </button>
                      </div>
                    </div>
                  );
                })}
                {!actions.length && (
                  <p className={styles.noActivities}>
                    Nenhuma atividade nesta etapa.
                  </p>
                )}
              </section>
            );
          })}
        </section>

        <section className={styles.filters} aria-label="Busca e filtros do CRM">
          <label className={styles.search}>
            Buscar
            <input
              aria-label="Buscar cliente"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome, empresa, telefone, e-mail ou ID"
            />
          </label>
          <label>
            Etapa ou contratação
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option>Todos</option>
              {clientStatuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label>
            Pagamento
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
            >
              <option>Todos</option>
              <option>Pendente</option>
              <option>Pago</option>
              <option>Parcial</option>
              <option>Em atraso</option>
            </select>
          </label>
          <label>
            Pendências
            <select
              value={pendingFilter}
              onChange={(e) => setPendingFilter(e.target.value)}
            >
              <option>Todos</option>
              <option>Com pendências</option>
              <option>Sem pendências</option>
            </select>
          </label>
          <label>
            Ordenar
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="name">Nome</option>
              <option value="company">Empresa</option>
              <option value="updated">Atualização</option>
            </select>
          </label>
          <button
            onClick={() => {
              setSearch('');
              setStatusFilter('Todos');
              setPaymentFilter('Todos');
              setPendingFilter('Todos');
            }}
          >
            Limpar
          </button>
        </section>

        <section className={styles.clientTable}>
          <div className={styles.tableHead}>
            <span>Cliente</span>
            <span>Situação</span>
            <span>Pagamento</span>
            <span>Último contato</span>
            <span>Próxima ação</span>
            <span>Data</span>
          </div>
          {rows.map((client) => {
            const payment = latestByCompetence(data.payments, client.id);
            const interaction = data.interactions
              .filter((i) => i.clientId === client.id)
              .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
            const action = data.nextActions
              .filter((a) => a.clientId === client.id && !a.completed)
              .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
            return (
              <button
                className={styles.clientRow}
                key={client.id}
                onClick={() => openClient(client)}
              >
                <span className={styles.clientName}>
                  <b>{client.name}</b>
                  <small>
                    {client.company || 'Pessoa física'} · {client.id}
                  </small>
                </span>
                <span>
                  <em>{client.clientStatus}</em>
                </span>
                <State
                  value={
                    payment?.status === 'Pago'
                      ? 'Concluído'
                      : payment?.status === 'Em atraso'
                        ? 'Atrasado'
                        : 'Pendente'
                  }
                />
                <span>
                  {interaction
                    ? formatDate(interaction.occurredAt.slice(0, 10))
                    : '—'}
                </span>
                <span>{action?.title ?? '—'}</span>
                <span>{formatDate(action?.dueAt)}</span>
              </button>
            );
          })}
          {!rows.length && (
            <p className={styles.empty}>
              Nenhum cliente corresponde aos filtros.
            </p>
          )}
        </section>

        {selected && (
          <section className={styles.detail}>
            <header>
              <div>
                <button
                  className={styles.closeDetail}
                  onClick={() => setSelectedId(null)}
                >
                  ← Voltar à lista
                </button>
                <h2>{selected.name}</h2>
                <p>
                  {selected.company || 'Pessoa física'} · {selected.id} ·
                  Responsável: {selected.owner}
                </p>
              </div>
              <div className={styles.quickLinks}>
                <a
                  href={`https://wa.me/${whatsappNumber(selected.whatsapp)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp ↗
                </a>
                <a href={`mailto:${selected.email}`}>E-mail ↗</a>
                <button
                  onClick={() => {
                    setFormError('');
                    setModal('action');
                  }}
                >
                  ＋ Próxima ação
                </button>
                {[
                  'Lead',
                  'Em contato',
                  'Cotação solicitada',
                  'Proposta enviada',
                  'Em negociação',
                ].includes(selected.contactStatus) && (
                  <button
                    onClick={() => {
                      setNotice(
                        'Preencha a contratação. O acesso e o convite serão criados ao salvar qualquer situação diferente de “Não contratado”.',
                      );
                      setEditingClient(true);
                      setFormError('');
                      setModal('client');
                    }}
                  >
                    Contratar e liberar acesso
                  </button>
                )}
              </div>
            </header>
            <nav className={styles.tabs} aria-label="Ficha do cliente">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  className={activeTab === tab ? styles.activeTab : ''}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </nav>
            <ClientDetail
              tab={activeTab}
              client={selected}
              data={data}
              setData={setData}
              setNotice={setNotice}
              openModal={setModal}
              editClient={() => {
                setEditingClient(true);
                setFormError('');
                setModal('client');
              }}
            />
          </section>
        )}

        {modal && (
          <div className={styles.modalBackdrop} role="presentation">
            <form
              className={styles.modal}
              onSubmit={modal === 'client' ? saveClient : saveRelated}
            >
              <header>
                <div>
                  <h2>
                    {modal === 'client' && editingClient
                      ? 'Editar cadastro'
                      : modalTitle(modal)}
                  </h2>
                  <p>
                    O novo registro será adicionado ao histórico do cliente.
                  </p>
                </div>
                <button type="button" onClick={() => setModal(null)}>
                  ×
                </button>
              </header>
              <ModalFields
                modal={modal}
                clients={data.clients}
                selectedId={selected?.id}
                client={editingClient ? (selected ?? undefined) : undefined}
              />
              {formError ? (
                <p className={styles.formError} role="alert">
                  {formError}
                </p>
              ) : null}
              <footer>
                <button type="button" onClick={() => setModal(null)}>
                  Cancelar
                </button>
                <button className={shell.import} disabled={savingClient}>
                  {savingClient ? 'Salvando no banco…' : 'Salvar registro'}
                </button>
              </footer>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}

function modalTitle(
  modal: NonNullable<
    ReturnType<typeof useState> extends never
      ? never
      :
          | 'client'
          | 'period'
          | 'interaction'
          | 'payment'
          | 'delivery'
          | 'action'
          | 'file'
  >,
) {
  return {
    client: 'Criar cliente e acessos',
    period: 'Novo acompanhamento do período',
    interaction: 'Nova interação',
    payment: 'Novo pagamento',
    delivery: 'Nova entrega',
    action: 'Nova próxima ação',
    file: 'Novo arquivo ou link',
  }[modal];
}

function ModalFields({
  modal,
  clients,
  selectedId,
  client,
}: {
  modal:
    | 'client'
    | 'period'
    | 'interaction'
    | 'payment'
    | 'delivery'
    | 'action'
    | 'file';
  clients: CrmClient[];
  selectedId?: string;
  client?: CrmClient;
}) {
  const [personType, setPersonType] = useState<'physical' | 'legal'>(
    client?.personType ?? 'physical',
  );

  if (modal === 'client')
    return (
      <div className={styles.clientFormSections}>
        <fieldset className={styles.formSection}>
          <legend>1. Dados da pessoa ou empresa</legend>
          <div className={styles.formGrid}>
            <label>
              Tipo de cadastro
              <select
                name="personType"
                value={personType}
                onChange={(event) =>
                  setPersonType(event.target.value as 'physical' | 'legal')
                }
              >
                <option value="physical">Pessoa física</option>
                <option value="legal">Pessoa jurídica</option>
              </select>
            </label>
            {personType === 'legal' ? (
              <>
                <label>
                  Razão social
                  <input
                    name="company"
                    required
                    autoFocus
                    defaultValue={client?.company}
                  />
                </label>
                <label>
                  CNPJ
                  <input
                    name="legalDocument"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="00.000.000/0001-00"
                    defaultValue={client?.legalDocument}
                  />
                </label>
              </>
            ) : null}
            <label>
              Cidade
              <input name="city" defaultValue={client?.city} />
            </label>
            <label>
              Estado
              <input name="state" defaultValue={client?.state} />
            </label>
            <label>
              País
              <input
                name="country"
                defaultValue={client?.country || 'Brasil'}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className={styles.formSection}>
          <legend>2. Responsável e primeiro acesso</legend>
          <p>
            Estes dados identificam o contato. O usuário do portal e o e-mail de
            primeiro acesso só serão criados após a contratação.
          </p>
          <div className={styles.formGrid}>
            <label>
              {personType === 'physical'
                ? 'Nome completo'
                : 'Nome do responsável'}
              <input
                name="name"
                required
                autoFocus={personType === 'physical'}
                defaultValue={client?.name}
              />
            </label>
            <label>
              E-mail principal
              <input
                name="email"
                type="email"
                required
                defaultValue={client?.email}
              />
            </label>
            <label>
              WhatsApp
              <input
                name="whatsapp"
                type="tel"
                required
                placeholder="(11) 99999-9999"
                defaultValue={client?.whatsapp}
              />
            </label>
            <label>
              Telefone alternativo
              <input name="phone" type="tel" defaultValue={client?.phone} />
            </label>
          </div>
        </fieldset>

        <fieldset className={styles.formSection}>
          <legend>3. Interesse, pesquisa e negociação</legend>
          <p>
            Use esta parte antes da contratação: pesquisa, cotação, proposta e
            negociação.
          </p>
          <div className={styles.formGrid}>
            <label>
              Etapa do contato
              <select
                name="contactStatus"
                defaultValue={client?.contactStatus || 'Lead'}
              >
                {contactStatuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
            <label>
              Serviço pesquisado ou de interesse
              <input
                name="serviceInterest"
                defaultValue={client?.serviceInterest}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className={styles.formSection}>
          <legend>4. Serviço contratado</legend>
          <p>
            Preencha somente quando houver contratação. Cotação e pesquisa
            permanecem no bloco anterior.
          </p>
          <div className={styles.formGrid}>
            <label>
              Situação da contratação
              <select
                name="clientStatus"
                defaultValue={client?.clientStatus || 'Não contratado'}
              >
                {contractStatuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
            <label>
              Serviço contratado
              <input
                name="contractedService"
                defaultValue={client?.contractedService}
              />
            </label>
            <label>
              Data de início
              <input
                name="startDate"
                type="date"
                defaultValue={client?.startDate}
              />
            </label>
            <label>
              Valor que este cliente pagará
              <input
                name="contractValue"
                type="number"
                min="0"
                step="0.01"
                defaultValue={client?.contractValue}
              />
            </label>
            <label>
              Tipo da cobrança
              <select
                name="periodicity"
                defaultValue={client?.periodicity || 'Mensal'}
              >
                <option>Semanal</option>
                <option>Quinzenal</option>
                <option>Mensal</option>
              </select>
            </label>
            <label>
              Responsável interno pelo atendimento
              <input
                name="owner"
                defaultValue={client?.owner || 'Vanessa Rodrigues'}
              />
            </label>
          </div>
        </fieldset>

        {!client ? (
          <fieldset className={styles.formSection}>
            <legend>5. Usuário extra (opcional)</legend>
            <p>
              Deixe os dois campos vazios se o cliente terá somente um acesso.
            </p>
            <div className={styles.formGrid}>
              <label>
                Nome do usuário extra
                <input name="user2Name" placeholder="Nome completo" />
              </label>
              <label>
                E-mail do usuário extra
                <input
                  name="user2Email"
                  type="email"
                  placeholder="usuario@empresa.com"
                />
              </label>
            </div>
          </fieldset>
        ) : null}

        <fieldset className={styles.formSection}>
          <legend>6. Rede social e observações</legend>
          <div className={styles.formGrid}>
            <label>
              Instagram
              <input name="instagram" defaultValue={client?.instagram} />
            </label>
            <label className={styles.wide}>
              Observações
              <textarea name="notes" defaultValue={client?.notes} />
            </label>
          </div>
        </fieldset>
      </div>
    );
  if (modal === 'period')
    return (
      <div className={styles.formGrid}>
        <label>
          Competência
          <input name="competence" type="month" required />
        </label>
        <label>
          Informações recebidas?
          <select name="received">
            <option value="yes">Sim</option>
            <option value="no">Não</option>
          </select>
        </label>
        <label>
          Data de recebimento
          <input name="receivedAt" type="date" />
        </label>
        <label>
          Completude
          <select name="completeness">
            <option>Completo</option>
            <option>Incompleto</option>
          </select>
        </label>
        <label className={styles.wide}>
          Documentos/dados recebidos
          <textarea name="documents" />
        </label>
        <label className={styles.wide}>
          Pendências
          <textarea name="pendingItems" />
        </label>
        <label>
          Última cobrança
          <input name="lastReminder" type="date" />
        </label>
        <label>
          Enviado para processamento?
          <select name="sent">
            <option value="no">Não</option>
            <option value="yes">Sim</option>
          </select>
        </label>
        <label>
          Data do processamento
          <input name="processedAt" type="date" />
        </label>
        <label>
          Processamento concluído?
          <select name="completed">
            <option value="no">Não</option>
            <option value="yes">Sim</option>
          </select>
        </label>
        <label>
          ID do processamento
          <input name="processingId" placeholder="App Transformador" />
        </label>
        <label>
          Status
          <input name="processingStatus" defaultValue="Aguardando dados" />
        </label>
        <label className={styles.wide}>
          Observações ou erros
          <textarea name="processingNotes" />
        </label>
      </div>
    );
  if (modal === 'interaction')
    return (
      <div className={styles.formGrid}>
        <label>
          Data e hora
          <input name="occurredAt" type="datetime-local" required />
        </label>
        <label>
          Tipo
          <select name="type">
            <option>WhatsApp</option>
            <option>Ligação</option>
            <option>E-mail</option>
            <option>Reunião</option>
            <option>Cobrança de documentos</option>
            <option>Recebimento de documentos</option>
            <option>Processamento</option>
            <option>Envio de relatório</option>
            <option>Pagamento</option>
            <option>Observação interna</option>
          </select>
        </label>
        <label>
          Canal
          <input name="channel" />
        </label>
        <label>
          Responsável
          <input name="owner" defaultValue="Vanessa Rodrigues" />
        </label>
        <label className={styles.wide}>
          Descrição
          <textarea name="description" required />
        </label>
        <label>
          Próxima ação
          <input name="nextAction" />
        </label>
        <label>
          Data da próxima ação
          <input name="nextActionAt" type="date" />
        </label>
      </div>
    );
  if (modal === 'payment')
    return (
      <div className={styles.formGrid}>
        <label>
          Competência
          <input name="competence" type="month" required />
        </label>
        <label>
          Valor previsto
          <input name="expected" type="number" min="0" step="0.01" required />
        </label>
        <label>
          Valor recebido
          <input name="receivedAmount" type="number" min="0" step="0.01" />
        </label>
        <label>
          Status
          <select name="status">
            <option>Pendente</option>
            <option>Pago</option>
            <option>Parcial</option>
            <option>Em atraso</option>
          </select>
        </label>
        <label>
          Data do pagamento
          <input name="paidAt" type="date" />
        </label>
        <label>
          Forma de pagamento
          <input name="method" />
        </label>
        <label className={styles.wide}>
          Observação financeira
          <textarea name="notes" />
        </label>
      </div>
    );
  if (modal === 'delivery')
    return (
      <div className={styles.formGrid}>
        <label>
          Competência
          <input name="competence" type="month" required />
        </label>
        <label>
          Entrega enviada?
          <select name="sent">
            <option value="no">Não</option>
            <option value="yes">Sim</option>
          </select>
        </label>
        <label>
          Data do envio
          <input name="sentAt" type="date" />
        </label>
        <label>
          Tipo de entrega
          <input name="type" />
        </label>
        <label>
          Relatório enviado?
          <select name="reportSent">
            <option value="no">Não</option>
            <option value="yes">Sim</option>
          </select>
        </label>
        <label>
          Link do relatório
          <input name="reportUrl" type="url" />
        </label>
        <label>
          Link do dashboard/BI
          <input name="dashboardUrl" type="url" />
        </label>
        <label>
          Link da apresentação
          <input name="presentationUrl" type="url" />
        </label>
        <label>
          Outros materiais
          <input name="otherUrl" type="url" />
        </label>
        <label className={styles.wide}>
          Observação
          <textarea name="notes" />
        </label>
      </div>
    );
  if (modal === 'action')
    return (
      <div className={styles.formGrid}>
        <label>
          Cliente
          <select name="clientId" defaultValue={selectedId ?? ''} required>
            <option value="" disabled>
              Selecione o cliente
            </option>
            <option value={administratorClientId}>
              Administrador · atividades da Nalie
            </option>
            {clients.map((client) => (
              <option value={client.id} key={client.id}>
                {client.company || 'Pessoa física'} · {client.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipo
          <select name="type">
            <option>Próximo contato</option>
            <option>Cobrança de documentos</option>
            <option>Próxima entrega</option>
            <option>Pagamento esperado</option>
          </select>
        </label>
        <label>
          Título
          <input name="title" required />
        </label>
        <label>
          Data prevista
          <input name="dueAt" type="date" required />
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
          Responsável
          <input name="owner" defaultValue="Vanessa Rodrigues" />
        </label>
      </div>
    );
  return (
    <div className={styles.formGrid}>
      <label>
        Categoria
        <select name="category">
          <option>Proposta</option>
          <option>Contrato</option>
          <option>Comprovante</option>
          <option>Diagnóstico</option>
          <option>Apresentação</option>
          <option>Relatório</option>
          <option>Outro</option>
        </select>
      </label>
      <label>
        Título
        <input name="title" required />
      </label>
      <label className={styles.wide}>
        Link/referência
        <input name="url" type="url" required />
      </label>
      <p className={styles.wide}>
        Use somente referência ou link para documentos financeiros pertencentes
        ao fluxo do App Transformador.
      </p>
    </div>
  );
}

function ClientDetail({
  tab,
  client,
  data,
  setData,
  setNotice,
  openModal,
  editClient,
}: {
  tab: Tab;
  client: CrmClient;
  data: typeof initialCrmData;
  setData: React.Dispatch<React.SetStateAction<typeof initialCrmData>>;
  setNotice: React.Dispatch<React.SetStateAction<string>>;
  openModal: (
    value:
      | 'period'
      | 'interaction'
      | 'payment'
      | 'delivery'
      | 'action'
      | 'file',
  ) => void;
  editClient: () => void;
}) {
  const follow = latestByCompetence(data.followUps, client.id);
  const processing = latestByCompetence(data.processings, client.id);
  const delivery = latestByCompetence(data.deliveries, client.id);
  const payment = latestByCompetence(data.payments, client.id);
  const action = data.nextActions
    .filter((a) => a.clientId === client.id && !a.completed)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
  if (tab === 'Resumo')
    return (
      <div className={styles.summary}>
        <StatusCard
          icon="📥"
          label="Informações do período"
          state={
            follow?.received
              ? follow.completeness === 'Completo'
                ? 'Concluído'
                : 'Pendente'
              : 'Aguardando'
          }
          detail={
            follow
              ? `${follow.competence} · ${follow.documentSummary || 'Sem descrição'}`
              : 'Sem acompanhamento'
          }
        />
        <StatusCard
          icon="⚙️"
          label="Processamento"
          state={
            processing?.completed
              ? 'Concluído'
              : processing?.status === 'Com erro'
                ? 'Atrasado'
                : 'Pendente'
          }
          detail={
            processing?.externalProcessingId ||
            processing?.status ||
            'Não iniciado'
          }
        />
        <StatusCard
          icon="📤"
          label="Resultado enviado"
          state={delivery?.sent ? 'Concluído' : 'Pendente'}
          detail={delivery?.type || 'Sem entrega'}
        />
        <StatusCard
          icon="💳"
          label="Pagamento"
          state={
            payment?.status === 'Pago'
              ? 'Concluído'
              : payment?.status === 'Em atraso'
                ? 'Atrasado'
                : 'Pendente'
          }
          detail={
            payment
              ? `${payment.competence} · ${money.format(payment.receivedAmount)} de ${money.format(payment.expectedAmount)}`
              : 'Sem cobrança'
          }
        />
        <article className={styles.nextAction}>
          <span>PRÓXIMA AÇÃO</span>
          <h3>{action?.title ?? 'Nenhuma ação pendente'}</h3>
          <p>
            {action
              ? `${formatDate(action.dueAt)} · ${action.priority} · ${action.owner}`
              : 'Cadastre um próximo contato, cobrança, entrega ou pagamento.'}
          </p>
          <button onClick={() => openModal('action')}>
            ＋ Registrar próxima ação
          </button>
        </article>
        <article className={styles.contract}>
          <span>RELACIONAMENTO COMERCIAL</span>
          <dl>
            <div>
              <dt>Situação da contratação</dt>
              <dd>{client.clientStatus}</dd>
            </div>
            <div>
              <dt>Serviço</dt>
              <dd>{client.contractedService || client.serviceInterest}</dd>
            </div>
            <div>
              <dt>Valor</dt>
              <dd>{money.format(client.contractValue)}</dd>
            </div>
            <div>
              <dt>Periodicidade</dt>
              <dd>{client.periodicity}</dd>
            </div>
          </dl>
        </article>
      </div>
    );
  if (tab === 'Contato')
    return (
      <section className={styles.panel}>
        <PanelHeader
          title="Dados e relacionamento"
          action="Editar cadastro"
          onClick={editClient}
        />
        <div className={styles.contactGrid}>
          <Info label="ID único" value={client.id} />
          <Info label="Nome" value={client.name} />
          <Info label="Empresa" value={client.company || '—'} />
          <Info label="WhatsApp" value={client.whatsapp} />
          <Info label="Telefone" value={client.phone} />
          <Info label="E-mail" value={client.email} />
          <Info label="Instagram" value={client.instagram} />
          <Info
            label="Localização"
            value={`${client.city}, ${client.state} · ${client.country}`}
          />
          <Info label="Etapa do contato" value={client.contactStatus} />
          <Info label="Situação da contratação" value={client.clientStatus} />
          <Info
            label="Serviço pesquisado ou de interesse"
            value={client.serviceInterest}
          />
          <Info
            label="Serviço contratado"
            value={client.contractedService || '—'}
          />
          <Info label="Data de início" value={formatDate(client.startDate)} />
          <Info label="Responsável" value={client.owner} />
          <div className={styles.fullInfo}>
            <b>Observações gerais</b>
            <p>{client.notes || 'Sem observações.'}</p>
          </div>
        </div>
      </section>
    );
  if (tab === 'Acompanhamento')
    return (
      <section className={styles.panel}>
        <PanelHeader
          title="Acompanhamentos e processamento"
          action="＋ Novo período"
          onClick={() => openModal('period')}
        />
        {data.followUps
          .filter((i) => i.clientId === client.id)
          .sort((a, b) => b.competence.localeCompare(a.competence))
          .map((item) => {
            const proc = data.processings.find(
              (p) =>
                p.clientId === client.id && p.competence === item.competence,
            );
            return (
              <article className={styles.periodCard} key={item.id}>
                <header>
                  <h3>{item.competence}</h3>
                  <State
                    value={
                      item.received
                        ? item.completeness === 'Completo'
                          ? 'Concluído'
                          : 'Pendente'
                        : 'Aguardando'
                    }
                  />
                </header>
                <dl>
                  <Info
                    label="Recebido em"
                    value={formatDate(item.receivedAt)}
                  />
                  <Info
                    label="Documentos/dados"
                    value={item.documentSummary || '—'}
                  />
                  <Info label="Completude" value={item.completeness} />
                  <Info
                    label="Pendências"
                    value={item.pendingItems || 'Nenhuma'}
                  />
                  <Info
                    label="Última cobrança"
                    value={formatDate(item.lastDocumentReminderAt)}
                  />
                  <Info
                    label="Processamento"
                    value={proc?.status || 'Não iniciado'}
                  />
                  <Info
                    label="ID processamento"
                    value={proc?.externalProcessingId || '—'}
                  />
                  <Info label="Erros/observações" value={proc?.notes || '—'} />
                </dl>
              </article>
            );
          })}
      </section>
    );
  if (tab === 'Entregas')
    return (
      <section className={styles.panel}>
        <PanelHeader
          title="Entregas por competência"
          action="＋ Nova entrega"
          onClick={() => openModal('delivery')}
        />
        {data.deliveries
          .filter((i) => i.clientId === client.id)
          .sort((a, b) => b.competence.localeCompare(a.competence))
          .map((item) => (
            <article className={styles.periodCard} key={item.id}>
              <header>
                <h3>
                  {item.competence} · {item.type}
                </h3>
                <State value={item.sent ? 'Concluído' : 'Pendente'} />
              </header>
              <p>{item.notes}</p>
              <div className={styles.linkList}>
                {item.reportUrl && (
                  <a href={item.reportUrl} target="_blank" rel="noreferrer">
                    Relatório ↗
                  </a>
                )}
                {item.dashboardUrl && (
                  <a href={item.dashboardUrl} target="_blank" rel="noreferrer">
                    Dashboard/BI ↗
                  </a>
                )}
                {item.presentationUrl && (
                  <a
                    href={item.presentationUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Apresentação ↗
                  </a>
                )}
                {item.otherUrl && (
                  <a href={item.otherUrl} target="_blank" rel="noreferrer">
                    Outro material ↗
                  </a>
                )}
              </div>
            </article>
          ))}
      </section>
    );
  if (tab === 'Pagamentos')
    return (
      <section className={styles.panel}>
        <PanelHeader
          title="Histórico financeiro"
          action="＋ Novo pagamento"
          onClick={() => openModal('payment')}
        />
        <div className={styles.historyTable}>
          <div>
            <b>Competência</b>
            <b>Previsto</b>
            <b>Recebido</b>
            <b>Status</b>
            <b>Data</b>
            <b>Forma</b>
            <b>Observação</b>
          </div>
          {data.payments
            .filter((i) => i.clientId === client.id)
            .sort((a, b) => b.competence.localeCompare(a.competence))
            .map((item) => (
              <div key={item.id}>
                <span>{item.competence}</span>
                <span>{money.format(item.expectedAmount)}</span>
                <span>{money.format(item.receivedAmount)}</span>
                <span>{item.status}</span>
                <span>{formatDate(item.paidAt)}</span>
                <span>{item.method}</span>
                <span>{item.notes || '—'}</span>
              </div>
            ))}
        </div>
      </section>
    );
  if (tab === 'Histórico')
    return (
      <section className={styles.panel}>
        <PanelHeader
          title="Histórico cronológico"
          action="＋ Nova interação"
          onClick={() => openModal('interaction')}
        />
        <div className={styles.timeline}>
          {data.interactions
            .filter((i) => i.clientId === client.id)
            .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
            .map((item) => (
              <article key={item.id}>
                <span>{new Date(item.occurredAt).toLocaleString('pt-BR')}</span>
                <div>
                  <b>
                    {item.type} · {item.channel}
                  </b>
                  <p>{item.description}</p>
                  <small>
                    {item.owner} · Próxima ação: {item.nextAction || '—'}{' '}
                    {item.nextActionAt
                      ? `em ${formatDate(item.nextActionAt)}`
                      : ''}
                  </small>
                </div>
              </article>
            ))}
        </div>
      </section>
    );
  if (tab === 'BI e apresentação')
    return (
      <section className={styles.panel}>
        <PanelHeader title="BI e apresentação do cliente" />
        <p className={styles.helper}>
          Área administrativa para vincular o conteúdo desta empresa. Os
          endereços não são exibidos como texto ou botão para os usuários.
        </p>
        <form
          className={styles.contentConfig}
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setData((current) => ({
              ...current,
              clients: current.clients.map((item) =>
                item.id === client.id
                  ? {
                      ...item,
                      dashboardUrl: String(form.get('dashboardUrl')),
                      presentationUrl: String(form.get('presentationUrl')),
                      excelName1: String(form.get('excelName1')).trim(),
                      excelUrl1: String(form.get('excelUrl1')),
                      excelName2: String(form.get('excelName2')).trim(),
                      excelUrl2: String(form.get('excelUrl2')),
                      contentAccess: String(form.get('contentAccess')) as
                        | 'Empresa'
                        | 'Restrito',
                      updatedAt: new Date().toISOString(),
                    }
                  : item,
              ),
            }));
            setNotice(
              `BI, apresentação e planilhas de ${client.name} atualizados.`,
            );
            void persistAnalysisLinks(client, form).catch(() =>
              setNotice(
                'A configuração foi mantida nesta sessão, mas não foi possível gravá-la no banco.',
              ),
            );
          }}
        >
          <label>
            Link do BI — Power BI ou Google Looker Studio
            <input
              name="dashboardUrl"
              type="url"
              defaultValue={client.dashboardUrl ?? ''}
              placeholder="Cole o link administrativo"
            />
          </label>
          <label>
            Link da apresentação — PowerPoint ou Google Slides
            <input
              name="presentationUrl"
              type="url"
              defaultValue={client.presentationUrl ?? ''}
              placeholder="Cole o link administrativo"
            />
          </label>
          <label>
            Nome visível do Excel 1
            <input
              name="excelName1"
              defaultValue={client.excelName1 ?? ''}
              placeholder="Ex.: Fluxo de caixa mensal"
            />
          </label>
          <label>
            Link do Excel 1
            <input
              name="excelUrl1"
              type="url"
              defaultValue={client.excelUrl1 ?? ''}
              placeholder="Cole o link do primeiro Excel"
            />
          </label>
          <label>
            Nome visível do Excel 2
            <input
              name="excelName2"
              defaultValue={client.excelName2 ?? ''}
              placeholder="Ex.: Controle de despesas"
            />
          </label>
          <label>
            Link do Excel 2
            <input
              name="excelUrl2"
              type="url"
              defaultValue={client.excelUrl2 ?? ''}
              placeholder="Cole o link do segundo Excel"
            />
          </label>
          <label>
            Acesso ao conteúdo
            <select
              name="contentAccess"
              defaultValue={client.contentAccess ?? 'Empresa'}
            >
              <option value="Empresa">
                Todos os usuários ativos da empresa
              </option>
              <option value="Restrito">
                Somente usuários com permissão de Análises
              </option>
            </select>
            <small>
              Esta regra controla somente BI, PowerPoint e Excel. No modo
              restrito, o usuário também precisa ter “Análise · BI e
              apresentações” liberado em suas permissões individuais.
            </small>
          </label>
          <div className={styles.contentConfigActions}>
            <button className={shell.import}>Salvar configuração</button>
            <small>
              Apague um link e salve para o cliente voltar à mensagem “em
              produção”.
            </small>
          </div>
        </form>
      </section>
    );
  return (
    <section className={styles.panel}>
      <PanelHeader
        title="Materiais entregues e referências"
        action="＋ Vincular arquivo/link"
        onClick={() => openModal('file')}
      />
      <p className={styles.helper}>
        Aqui ficam links de apresentações, relatórios, contratos e outros
        materiais relacionados ao acompanhamento. Os arquivos originais
        importados pelo cliente ficam em Relatórios.
      </p>
      <div className={styles.fileGrid}>
        {data.files
          .filter((i) => i.clientId === client.id)
          .map((item) => (
            <a href={item.url} target="_blank" rel="noreferrer" key={item.id}>
              <span>📎</span>
              <div>
                <b>{item.title}</b>
                <small>{item.category} · Referência externa</small>
              </div>
              <i>↗</i>
            </a>
          ))}
      </div>
    </section>
  );
}

function StatusCard({
  icon,
  label,
  state,
  detail,
}: {
  icon: string;
  label: string;
  state: 'Concluído' | 'Pendente' | 'Atrasado' | 'Aguardando';
  detail: string;
}) {
  return (
    <article className={styles.statusCard}>
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <State value={state} />
        <p>{detail}</p>
      </div>
    </article>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.info}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
function PanelHeader({
  title,
  action,
  onClick,
}: {
  title: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <header className={styles.panelHeader}>
      <div>
        <h3>{title}</h3>
        <p>Registros vinculados pelo cliente_id e preservados por período.</p>
      </div>
      {action && <button onClick={onClick}>{action}</button>}
    </header>
  );
}
