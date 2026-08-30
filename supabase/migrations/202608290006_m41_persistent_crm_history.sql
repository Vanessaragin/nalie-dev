-- M41: histórico administrativo do CRM em client_activities.

alter table public.client_activities
  drop constraint if exists client_activities_kind_check;

alter table public.client_activities
  add constraint client_activities_kind_check check (
    kind in (
      'LOGIN','IMPORT','DOWNLOAD','CLASSIFICATION','USER_CHANGE','MEETING',
      'FOLLOW_UP','PROCESSING','DELIVERY','PAYMENT','INTERACTION',
      'NEXT_ACTION','MATERIAL'
    )
  );

create index if not exists client_activities_company_kind_time_idx
  on public.client_activities(company_id, kind, occurred_at desc);

