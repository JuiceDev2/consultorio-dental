-- ============================================================
-- ESQUEMA: Consultorio Dental - Supabase
-- Ejecutar completo en el SQL Editor de Supabase (una sola vez)
-- ============================================================

create extension if not exists "uuid-ossp";

-- ---------- TIPOS ----------
do $$ begin
  create type user_role as enum ('admin', 'dentist');
exception when duplicate_object then null; end $$;

do $$ begin
  create type appointment_status as enum ('confirmed', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type appointment_source as enum ('online', 'walk_in');
exception when duplicate_object then null; end $$;

-- ---------- PERFILES (admin / dentista) ----------
-- id = auth.users.id. El cliente NO tiene cuenta, así que no aparece aquí.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role user_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- SERVICIOS ----------
create table if not exists services (
  id uuid primary key default uuid_generate_v4(),
  name text not null check (char_length(name) between 2 and 120),
  description text check (char_length(description) <= 300),
  price numeric(10,2) not null check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- CITAS ----------
create table if not exists appointments (
  id uuid primary key default uuid_generate_v4(),
  client_name text not null check (char_length(client_name) between 2 and 120),
  client_phone text not null check (client_phone ~ '^[0-9+ ()-]{7,20}$'),
  appointment_date date not null,
  appointment_time time not null,
  comment text check (char_length(comment) <= 300),
  status appointment_status not null default 'confirmed',
  source appointment_source not null default 'online',
  dentist_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists appointment_services (
  appointment_id uuid references appointments(id) on delete cascade,
  service_id uuid references services(id) on delete restrict,
  price_at_booking numeric(10,2) not null,
  primary key (appointment_id, service_id)
);

-- ---------- TICKETS DE VENTA ----------
create table if not exists tickets (
  id uuid primary key default uuid_generate_v4(),
  appointment_id uuid references appointments(id) on delete set null,
  dentist_id uuid references profiles(id) not null,
  client_name text not null,
  items jsonb not null, -- [{ service_id, name, price }]
  total numeric(10,2) not null check (total >= 0),
  amount_paid numeric(10,2) not null check (amount_paid >= 0),
  change_given numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- ANTI-SPAM: bitácora de intentos de reserva ----------
create table if not exists booking_attempts (
  id uuid primary key default uuid_generate_v4(),
  phone text not null,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists idx_booking_attempts_phone_time on booking_attempts(phone, created_at);
create index if not exists idx_booking_attempts_ip_time on booking_attempts(ip, created_at);
create index if not exists idx_appointments_date on appointments(appointment_date, appointment_time);
create index if not exists idx_appointments_phone on appointments(client_phone);
create index if not exists idx_tickets_dentist on tickets(dentist_id, created_at desc);

-- ============================================================
-- FUNCIÓN RPC: crear cita pública con límites anti-spam
-- SECURITY DEFINER para poder validar/insertar aunque el rol
-- "anon" no tenga permisos directos de insert.
-- ============================================================
create or replace function create_public_appointment(
  p_client_name text,
  p_client_phone text,
  p_service_ids uuid[],
  p_date date,
  p_time time,
  p_comment text,
  p_ip text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment_id uuid;
  v_dentist_id uuid;
  v_active_dentists int;
  v_recent_attempts_phone int;
  v_recent_attempts_ip int;
  v_active_appointments_phone int;
  v_slot_taken int;
  v_slot_capacity int;
  v_service_id uuid;
  v_price numeric(10,2);
begin
  -- Validaciones básicas (además de los CHECK de las tablas)
  if p_client_name is null or char_length(trim(p_client_name)) < 2 then
    raise exception 'Nombre inválido';
  end if;

  if p_client_phone is null or p_client_phone !~ '^[0-9+ ()-]{7,20}$' then
    raise exception 'Teléfono inválido';
  end if;

  if p_comment is not null and char_length(p_comment) > 300 then
    raise exception 'El comentario excede el límite de 300 caracteres';
  end if;

  if p_service_ids is null or array_length(p_service_ids, 1) is null then
    raise exception 'Debes elegir al menos un servicio';
  end if;

  if p_date < current_date then
    raise exception 'La fecha no puede ser en el pasado';
  end if;

  -- --------- ANTI-SPAM ---------
  -- Máx. 5 intentos por teléfono en 24h
  select count(*) into v_recent_attempts_phone
  from booking_attempts
  where phone = p_client_phone and created_at > now() - interval '24 hours';

  if v_recent_attempts_phone >= 5 then
    raise exception 'Has alcanzado el límite de intentos de reserva. Intenta más tarde.';
  end if;

  -- Máx. 8 intentos por IP en 1 hora
  if p_ip is not null then
    select count(*) into v_recent_attempts_ip
    from booking_attempts
    where ip = p_ip and created_at > now() - interval '1 hour';

    if v_recent_attempts_ip >= 8 then
      raise exception 'Demasiados intentos desde tu conexión. Intenta más tarde.';
    end if;
  end if;

  -- Máx. 3 citas activas (confirmadas, futuras) por teléfono
  select count(*) into v_active_appointments_phone
  from appointments
  where client_phone = p_client_phone
    and status = 'confirmed'
    and appointment_date >= current_date;

  if v_active_appointments_phone >= 3 then
    raise exception 'Ya tienes el máximo de citas activas permitidas (3).';
  end if;

  -- Registrar el intento (cuenta incluso si después falla algo más abajo)
  insert into booking_attempts (phone, ip) values (p_client_phone, p_ip);

  -- --------- DISPONIBILIDAD DE HORARIO ---------
  -- Lock por (fecha, hora) para serializar reservas concurrentes del mismo slot.
  -- Se libera solo al terminar esta transacción (una llamada RPC = una transacción).
  perform pg_advisory_xact_lock(hashtextextended(p_date::text || p_time::text, 0));

  select count(*) into v_active_dentists from profiles where role = 'dentist' and active = true;
  v_slot_capacity := greatest(v_active_dentists, 1); -- al menos 1 aunque no haya dentistas cargados aún

  select count(*) into v_slot_taken
  from appointments
  where appointment_date = p_date
    and appointment_time = p_time
    and status = 'confirmed';

  if v_slot_taken >= v_slot_capacity then
    raise exception 'Ese horario ya no está disponible. Elige otro horario.';
  end if;

  -- Auto-asignar dentista si solo hay uno activo
  if v_active_dentists = 1 then
    select id into v_dentist_id from profiles where role = 'dentist' and active = true limit 1;
  end if;

  -- Crear la cita
  insert into appointments (client_name, client_phone, appointment_date, appointment_time, comment, dentist_id, status, source)
  values (trim(p_client_name), p_client_phone, p_date, p_time, nullif(trim(coalesce(p_comment,'')), ''), v_dentist_id, 'confirmed', 'online')
  returning id into v_appointment_id;

  -- Vincular servicios (solo activos)
  foreach v_service_id in array p_service_ids loop
    select price into v_price from services where id = v_service_id and active = true;
    if v_price is null then
      raise exception 'Uno de los servicios seleccionados ya no está disponible';
    end if;
    insert into appointment_services (appointment_id, service_id, price_at_booking)
    values (v_appointment_id, v_service_id, v_price);
  end loop;

  return v_appointment_id;
end;
$$;

-- Permitir que anónimos y usuarios autenticados ejecuten la función
grant execute on function create_public_appointment to anon, authenticated;

-- ============================================================
-- RLS
-- ============================================================
alter table profiles enable row level security;
alter table services enable row level security;
alter table appointments enable row level security;
alter table appointment_services enable row level security;
alter table tickets enable row level security;
alter table booking_attempts enable row level security;

-- Helper: función para saber si el usuario actual es admin
create or replace function is_admin() returns boolean
language sql security definer stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and active = true);
$$;

create or replace function is_dentist() returns boolean
language sql security definer stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'dentist' and active = true);
$$;

-- PROFILES
drop policy if exists "profiles_select_own_or_admin" on profiles;
create policy "profiles_select_own_or_admin" on profiles
  for select using (auth.uid() = id or is_admin());

drop policy if exists "profiles_admin_all" on profiles;
create policy "profiles_admin_all" on profiles
  for all using (is_admin()) with check (is_admin());

-- SERVICES: público ve solo activos; admin ve/edita todo
drop policy if exists "services_public_select_active" on services;
create policy "services_public_select_active" on services
  for select using (active = true or is_admin() or is_dentist());

drop policy if exists "services_admin_write" on services;
create policy "services_admin_write" on services
  for insert with check (is_admin());
drop policy if exists "services_admin_update" on services;
create policy "services_admin_update" on services
  for update using (is_admin());

-- APPOINTMENTS: inserción pública solo vía RPC (security definer),
-- así que aquí NO damos insert directo a anon.
drop policy if exists "appointments_staff_select" on appointments;
create policy "appointments_staff_select" on appointments
  for select using (is_admin() or is_dentist());

drop policy if exists "appointments_staff_update" on appointments;
create policy "appointments_staff_update" on appointments
  for update using (is_admin() or is_dentist());

drop policy if exists "appointments_staff_insert" on appointments;
create policy "appointments_staff_insert" on appointments
  for insert with check (is_admin() or is_dentist());

-- APPOINTMENT_SERVICES
drop policy if exists "appt_services_staff_select" on appointment_services;
create policy "appt_services_staff_select" on appointment_services
  for select using (is_admin() or is_dentist());

drop policy if exists "appt_services_staff_write" on appointment_services;
create policy "appt_services_staff_write" on appointment_services
  for insert with check (is_admin() or is_dentist());

-- TICKETS: el dentista ve/crea solo los suyos, admin ve todo.
-- La vista pública del ticket (link compartible) NO pasa por esta política:
-- usa la función get_ticket_by_id() de abajo, que es security definer y
-- solo devuelve una fila puntual por id (nunca permite listar la tabla).
drop policy if exists "tickets_public_select_by_id" on tickets;
drop policy if exists "tickets_select_own_or_admin" on tickets;
create policy "tickets_select_own_or_admin" on tickets
  for select using (is_admin() or (is_dentist() and dentist_id = auth.uid()));

drop policy if exists "tickets_staff_insert" on tickets;
create policy "tickets_staff_insert" on tickets
  for insert with check (is_admin() or is_dentist());

-- ============================================================
-- FUNCIÓN RPC: obtener UN ticket por id (para el link público /ticket/[id])
-- SECURITY DEFINER porque anon no tiene (ni debe tener) select directo
-- sobre la tabla completa. Recibe un uuid puntual y devuelve como máximo
-- una fila; no acepta filtros abiertos, así que no sirve para listar.
-- ============================================================
create or replace function get_ticket_by_id(p_id uuid)
returns table (
  id uuid,
  appointment_id uuid,
  dentist_id uuid,
  client_name text,
  items jsonb,
  total numeric,
  amount_paid numeric,
  change_given numeric,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select id, appointment_id, dentist_id, client_name, items, total, amount_paid, change_given, created_at
  from tickets
  where id = p_id;
$$;

grant execute on function get_ticket_by_id to anon, authenticated;

-- ============================================================
-- FUNCIÓN RPC: horarios ocupados de un día (para mostrar
-- disponibilidad ANTES de que el cliente intente agendar).
-- No expone nombres ni teléfonos, solo la hora y si ya está llena
-- según la misma regla de capacidad que usa create_public_appointment
-- (capacidad = número de dentistas activos, mínimo 1).
-- ============================================================
create or replace function get_booked_times(p_date date)
returns table (
  appointment_time time,
  is_full boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    a.appointment_time,
    count(*) >= greatest((select count(*) from profiles where role = 'dentist' and active = true), 1) as is_full
  from appointments a
  where a.appointment_date = p_date
    and a.status = 'confirmed'
  group by a.appointment_time;
$$;

grant execute on function get_booked_times to anon, authenticated;

-- BOOKING_ATTEMPTS: nadie lee/escribe directo (solo la función RPC, que es security definer)
drop policy if exists "booking_attempts_admin_only" on booking_attempts;
create policy "booking_attempts_admin_only" on booking_attempts
  for select using (is_admin());

-- ============================================================
-- SEED opcional: crea aquí tu primer servicio de ejemplo
-- ============================================================
insert into services (name, description, price, active) values
  ('Consulta de valoración', 'Revisión general y diagnóstico', 300, true),
  ('Limpieza dental', 'Profilaxis dental completa', 600, true),
  ('Resina (por diente)', 'Restauración con resina compuesta', 900, true),
  ('Extracción simple', 'Extracción de pieza dental', 700, true),
  ('Blanqueamiento dental', 'Tratamiento estético de blanqueamiento', 2500, true)
on conflict do nothing;

-- ============================================================
-- IMPORTANTE: después de crear un usuario dentista/admin en
-- Authentication > Users, inserta su perfil, por ejemplo:
--
-- insert into profiles (id, full_name, email, role)
-- values ('UUID-DEL-USUARIO', 'Dra. Ana Pérez', 'ana@consultorio.com', 'admin');
-- ============================================================
