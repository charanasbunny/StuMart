-- Fix: "permission denied for table users" when inserting into orders.
-- The old orders_admin_all policy joined auth.users, which authenticated role cannot read.
-- Run this in Supabase SQL Editor.

drop policy if exists orders_admin_all on public.orders;

create policy orders_admin_all
on public.orders for all
to authenticated
using (
  exists ( select 1 from public.admin_users where auth_user_id = auth.uid() )
)
with check (
  exists ( select 1 from public.admin_users where auth_user_id = auth.uid() )
);
