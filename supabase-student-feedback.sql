-- Student feedback table + policies

create table if not exists public.student_feedback (
  id uuid primary key default gen_random_uuid(),
  student_pin_number text not null references public.students(pin_number),
  description text not null,
  image_url text,
  created_at timestamp with time zone default now()
);

alter table public.student_feedback enable row level security;

-- Students can insert their own feedback (auth user must match students record)
drop policy if exists students_can_insert_feedback on public.student_feedback;
create policy students_can_insert_feedback
  on public.student_feedback
  for insert
  with check (
    exists (
      select 1
      from public.students
      where students.pin_number = student_feedback.student_pin_number
        and students.auth_user_id = auth.uid()
    )
  );

-- Admins can read all feedback
drop policy if exists admins_can_read_feedback on public.student_feedback;
create policy admins_can_read_feedback
  on public.student_feedback
  for select
  using (
    exists (
      select 1
      from public.admin_users
      where admin_users.auth_user_id = auth.uid()
    )
  );

-- Storage bucket for feedback images
-- Create bucket (public read)
insert into storage.buckets (id, name, public)
values ('feedback-images', 'feedback-images', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload into their own folder
drop policy if exists feedback_images_insert on storage.objects;
create policy feedback_images_insert
  on storage.objects
  for insert
  with check (
    bucket_id = 'feedback-images'
    and auth.role() = 'authenticated'
    and name like auth.uid()::text || '/%'
  );

-- Allow public read of feedback images (bucket is public)
drop policy if exists feedback_images_select on storage.objects;
create policy feedback_images_select
  on storage.objects
  for select
  using (
    bucket_id = 'feedback-images'
  );
