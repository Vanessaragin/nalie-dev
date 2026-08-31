-- M55: company creation uses this sequence from the secure server route.
grant usage, select, update on sequence public.company_import_identifier_seq
  to service_role;
