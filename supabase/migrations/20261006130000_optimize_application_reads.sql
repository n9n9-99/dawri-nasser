-- Performance-only migration. It does not insert, update, or delete business data.

create index if not exists audit_logs_transaction_id_idx
  on public.audit_logs (transaction_id);

create index if not exists report_logs_recipient_user_id_idx
  on public.report_logs (recipient_user_id);

create index if not exists transactions_created_by_idx
  on public.transactions (created_by);

create index if not exists transactions_updated_by_idx
  on public.transactions (updated_by);

create index if not exists transactions_entry_date_idx
  on public.transactions (entry_date desc);

create index if not exists transactions_status_entry_date_idx
  on public.transactions (status, entry_date desc);

drop policy if exists profiles_self_or_admin_select on public.profiles;
create policy profiles_self_or_admin_select
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_admin())
  );

drop policy if exists tx_all_active_select on public.transactions;
create policy tx_all_active_select
  on public.transactions
  for select
  to authenticated
  using ((select public.is_active_user()));

drop policy if exists tx_active_insert on public.transactions;
create policy tx_active_insert
  on public.transactions
  for insert
  to authenticated
  with check (
    (select public.is_active_user())
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

drop policy if exists tx_active_update on public.transactions;
create policy tx_active_update
  on public.transactions
  for update
  to authenticated
  using ((select public.is_active_user()))
  with check (
    (select public.is_active_user())
    and updated_by = (select auth.uid())
  );

-- tx_active_update already grants the same update path to active admins.
drop policy if exists tx_admin_update on public.transactions;

drop policy if exists settings_active_select on public.app_settings;
create policy settings_active_select
  on public.app_settings
  for select
  to authenticated
  using ((select public.is_active_user()));

drop policy if exists settings_admin_update on public.app_settings;
create policy settings_admin_update
  on public.app_settings
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
