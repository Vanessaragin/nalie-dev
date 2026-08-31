export type ClientStatus =
  | 'Lead'
  | 'Em contato'
  | 'Aguardando informações'
  | 'Proposta enviada'
  | 'Cliente'
  | 'Acompanhamento ativo'
  | 'Pausado'
  | 'Encerrado';

export type OperationalState =
  | 'Concluído'
  | 'Pendente'
  | 'Atrasado'
  | 'Aguardando';

export type CrmClient = {
  id: string;
  companyId?: string;
  personType?: 'physical' | 'legal';
  legalDocument?: string;
  portalUsers?: Array<{
    id: string;
    membershipId: string;
    email: string;
    access: 'COMPLETE' | 'LIMITED';
  }>;
  name: string;
  company: string;
  whatsapp: string;
  phone: string;
  email: string;
  instagram: string;
  city: string;
  state: string;
  country: string;
  notes: string;
  contactStatus: ClientStatus;
  clientStatus: ClientStatus;
  serviceInterest: string;
  contractedService: string;
  startDate: string;
  contractValue: number;
  periodicity: string;
  dashboardUrl: string;
  presentationUrl: string;
  excelName1: string;
  excelUrl1: string;
  excelName2: string;
  excelUrl2: string;
  contentAccess: 'Empresa' | 'Restrito';
  owner: string;
  createdAt: string;
  updatedAt: string;
};

export type FollowUp = {
  id: string;
  clientId: string;
  competence: string;
  received: boolean;
  receivedAt: string;
  documentSummary: string;
  completeness: 'Completo' | 'Incompleto';
  pendingItems: string;
  lastDocumentReminderAt: string;
  createdAt: string;
  updatedAt: string;
};

export type Processing = {
  id: string;
  clientId: string;
  competence: string;
  sent: boolean;
  processedAt: string;
  completed: boolean;
  externalProcessingId: string;
  status: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type Delivery = {
  id: string;
  clientId: string;
  competence: string;
  sent: boolean;
  sentAt: string;
  type: string;
  reportSent: boolean;
  reportUrl: string;
  dashboardUrl: string;
  presentationUrl: string;
  otherUrl: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type Payment = {
  id: string;
  clientId: string;
  competence: string;
  expectedAmount: number;
  receivedAmount: number;
  received: boolean;
  paidAt: string;
  method: string;
  status: 'Pendente' | 'Pago' | 'Parcial' | 'Em atraso';
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type Interaction = {
  id: string;
  clientId: string;
  occurredAt: string;
  type: string;
  channel: string;
  description: string;
  owner: string;
  nextAction: string;
  nextActionAt: string;
};

export type NextAction = {
  id: string;
  clientId: string;
  type: string;
  title: string;
  dueAt: string;
  priority: 'Alta' | 'Média' | 'Normal';
  owner: string;
  completed: boolean;
};

export type ClientFile = {
  id: string;
  clientId: string;
  category: string;
  title: string;
  url: string;
  externalReference: boolean;
  createdAt: string;
};

export type CrmData = {
  clients: CrmClient[];
  followUps: FollowUp[];
  processings: Processing[];
  deliveries: Delivery[];
  payments: Payment[];
  interactions: Interaction[];
  nextActions: NextAction[];
  files: ClientFile[];
};

export const initialCrmData: CrmData = {
  clients: [],
  followUps: [],
  processings: [],
  deliveries: [],
  payments: [],
  interactions: [],
  nextActions: [],
  files: [],
};

export const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function latestByCompetence<
  T extends { clientId: string; competence: string },
>(items: T[], clientId: string) {
  return items
    .filter((item) => item.clientId === clientId)
    .sort((a, b) => b.competence.localeCompare(a.competence))[0];
}
