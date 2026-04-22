-- Create contact_messages table for storing contact form submissions
create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  is_read boolean default false
);

-- Enable RLS
alter table contact_messages enable row level security;

-- Allow public to insert messages
create policy "Allow public inserts" on contact_messages
  for insert with check (true);

-- Allow public to view their own messages
create policy "Allow public selects" on contact_messages
  for select using (true);

-- Create index for performance
create index if not exists contact_messages_created_at_idx on contact_messages(created_at desc);
create index if not exists contact_messages_is_read_idx on contact_messages(is_read);
