-- M63: allow the secure admin route to keep the initial charge in sync
-- when contract value, due date or service name changes in CRM.

grant select, insert, update, delete on table public.service_payments
to service_role;
