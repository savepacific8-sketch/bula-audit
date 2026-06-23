-- BULA AUDIT — Supabase Storage buckets

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'receipts',
    'receipts',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
  ),
  (
    'payment-proofs',
    'payment-proofs',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  )
on conflict (id) do nothing;

-- Receipt files: company members can read/write their company's folder
create policy receipts_storage_select on storage.objects
  for select using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] in (select public.accessible_company_ids())
  );

create policy receipts_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] in (select public.accessible_company_ids())
  );

create policy receipts_storage_update on storage.objects
  for update using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] in (select public.accessible_company_ids())
  );

create policy receipts_storage_delete on storage.objects
  for delete using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] in (select public.accessible_company_ids())
  );

-- Payment proof files
create policy payment_proofs_storage_select on storage.objects
  for select using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] in (select public.accessible_company_ids())
  );

create policy payment_proofs_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] in (select public.accessible_company_ids())
  );

create policy payment_proofs_storage_update on storage.objects
  for update using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] in (select public.accessible_company_ids())
  );

create policy payment_proofs_storage_delete on storage.objects
  for delete using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] in (select public.accessible_company_ids())
  );
