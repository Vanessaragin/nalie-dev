-- Two PDF slots reuse the existing company authorization and auditing rules.
begin;
alter table public.company_analysis_links drop constraint company_analysis_links_link_type_check;
alter table public.company_analysis_links add constraint company_analysis_links_link_type_check
check (link_type in ('DASHBOARD', 'PRESENTATION', 'EXCEL_1', 'EXCEL_2', 'PDF_1', 'PDF_2'));
commit;
