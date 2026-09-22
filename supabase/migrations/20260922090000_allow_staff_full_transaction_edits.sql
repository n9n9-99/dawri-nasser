alter table public.transactions
  drop constraint if exists transactions_transaction_no_format;

alter table public.transactions
  add constraint transactions_transaction_no_format
  check (transaction_no ~ '^[A-Za-zء-ي0-9]+([/-][A-Za-zء-ي0-9]+)*$');

alter table public.transactions
  drop constraint if exists transactions_outgoing_letter_no_ascii;

alter table public.transactions
  add constraint transactions_outgoing_letter_no_ascii
  check (
    outgoing_letter_no is null
    or outgoing_letter_no ~ '^[A-Za-zء-ي0-9]+([/-][A-Za-zء-ي0-9]+)*$'
  );

drop function if exists public.update_transaction_work(uuid, text, text, text, date, text, text);
drop function if exists public.update_transaction_work(uuid, text, text, text, date, text, text, text);

create function public.update_transaction_work(
  p_id uuid,
  p_transaction_no text,
  p_entry_date date,
  p_subject text,
  p_entity text,
  p_transaction_type text,
  p_status text,
  p_required_action text,
  p_notes text,
  p_sent_date date,
  p_outgoing_letter_no text,
  p_sent_to text
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.transactions;
  v_transaction_no text := trim(p_transaction_no);
begin
  if not public.is_active_user() then
    raise exception 'not authorized';
  end if;

  if v_transaction_no is null
     or v_transaction_no !~ '^[A-Za-zء-ي0-9]+([/-][A-Za-zء-ي0-9]+)*$' then
    raise exception 'invalid transaction number';
  end if;

  if p_entry_date is null
     or coalesce(trim(p_subject), '') = ''
     or coalesce(trim(p_entity), '') = ''
     or coalesce(trim(p_required_action), '') = '' then
    raise exception 'required transaction data is missing';
  end if;

  if p_transaction_type not in ('واردة', 'صادرة', 'داخلية') then
    raise exception 'invalid transaction type';
  end if;

  if p_status not in ('قيد الإجراء', 'تحت الإجراء', 'بانتظار رد', 'تحتاج إلحاقي', 'متأخرة', 'منتهية') then
    raise exception 'invalid status';
  end if;

  if p_status in ('بانتظار رد', 'تحتاج إلحاقي', 'متأخرة')
     and (p_sent_date is null or coalesce(trim(p_sent_to), '') = '') then
    raise exception 'sent date and recipient required';
  end if;

  update public.transactions
     set transaction_no = v_transaction_no,
         entry_date = p_entry_date,
         subject = trim(p_subject),
         entity = trim(p_entity),
         transaction_type = p_transaction_type,
         status = p_status,
         required_action = trim(p_required_action),
         notes = nullif(trim(p_notes), ''),
         sent_date = p_sent_date,
         outgoing_letter_no = p_outgoing_letter_no,
         sent_to = nullif(trim(p_sent_to), ''),
         updated_by = auth.uid()
   where id = p_id
   returning * into v_row;

  if v_row.id is null then
    raise exception 'transaction not found';
  end if;

  return v_row;
end;
$$;

revoke all on function public.update_transaction_work(uuid, text, date, text, text, text, text, text, text, date, text, text) from public, anon;
grant execute on function public.update_transaction_work(uuid, text, date, text, text, text, text, text, text, date, text, text) to authenticated;
