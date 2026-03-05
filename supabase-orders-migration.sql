-- Orders table: QR payment + delivery form workflow.
-- Buyer submits payment details; admin verifies and marks delivered.

-- Table
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  buyer_student_pin text not null,
  buyer_name text,
  buyer_email text,
  amount_paid integer not null check (amount_paid >= 0),
  tx_reference text not null,
  payment_method text not null default 'Other',
  delivery_preference text,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'verified', 'delivered')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_product_id on public.orders(product_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_created_at on public.orders(created_at desc);

-- RLS
alter table public.orders enable row level security;

-- Students can insert their own orders (buyer_student_pin must match their pin)
create policy orders_insert_own
on public.orders for insert
to authenticated
with check (
  buyer_student_pin in (
    select pin_number from public.students where auth_user_id = auth.uid()
  )
);

-- Students can select their own orders
create policy orders_select_own
on public.orders for select
to authenticated
using (
  buyer_student_pin in (
    select pin_number from public.students where auth_user_id = auth.uid()
  )
);

-- Admin can do everything (check admin_users only; do not reference auth.users - causes "permission denied for table users")
create policy orders_admin_all
on public.orders for all
to authenticated
using (
  exists ( select 1 from public.admin_users where auth_user_id = auth.uid() )
)
with check (
  exists ( select 1 from public.admin_users where auth_user_id = auth.uid() )
);

-- Trigger to keep updated_at in sync
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- Optional: allow anon read for product (already have); no change needed for orders.

comment on table public.orders is 'QR payment workflow: buyer submits payment details; admin verifies and marks delivered.';
