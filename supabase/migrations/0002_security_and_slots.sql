-- ============================================================
-- MIGRACIÓN 0002: cierra la fuga de datos en `tickets` y agrega
-- control de horarios ocupados en la reserva pública de citas.
--
-- Es seguro correr este archivo en una base de datos que YA está
-- en producción con el schema.sql original (no borra datos).
-- Pégalo completo en el SQL Editor de Supabase y ejecuta.
-- ============================================================

-- ---------- 1. Reemplaza create_public_appointment con control de slot ----------
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
  select count(*) into v_recent_attempts_phone
  from booking_attempts
  where phone = p_client_phone and created_at > now() - interval '24 hours';

  if v_recent_attempts_phone >= 5 then
    raise exception 'Has alcanzado el límite de intentos de reserva. Intenta más tarde.';
  end if;

  if p_ip is not null then
    select count(*) into v_recent_attempts_ip
    from booking_attempts
    where ip = p_ip and created_at > now() - interval '1 hour';

    if v_recent_attempts_ip >= 8 then
      raise exception 'Demasiados intentos desde tu conexión. Intenta más tarde.';
    end if;
  end if;

  select count(*) into v_active_appointments_phone
  from appointments
  where client_phone = p_client_phone
    and status = 'confirmed'
    and appointment_date >= current_date;

  if v_active_appointments_phone >= 3 then
    raise exception 'Ya tienes el máximo de citas activas permitidas (3).';
  end if;

  insert into booking_attempts (phone, ip) values (p_client_phone, p_ip);

  -- --------- DISPONIBILIDAD DE HORARIO (NUEVO) ---------
  -- Lock por (fecha, hora) para serializar reservas concurrentes del mismo slot.
  perform pg_advisory_xact_lock(hashtextextended(p_date::text || p_time::text, 0));

  select count(*) into v_active_dentists from profiles where role = 'dentist' and active = true;
  v_slot_capacity := greatest(v_active_dentists, 1);

  select count(*) into v_slot_taken
  from appointments
  where appointment_date = p_date
    and appointment_time = p_time
    and status = 'confirmed';

  if v_slot_taken >= v_slot_capacity then
    raise exception 'Ese horario ya no está disponible. Elige otro horario.';
  end if;

  if v_active_dentists = 1 then
    select id into v_dentist_id from profiles where role = 'dentist' and active = true limit 1;
  end if;

  insert into appointments (client_name, client_phone, appointment_date, appointment_time, comment, dentist_id, status, source)
  values (trim(p_client_name), p_client_phone, p_date, p_time, nullif(trim(coalesce(p_comment,'')), ''), v_dentist_id, 'confirmed', 'online')
  returning id into v_appointment_id;

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

grant execute on function create_public_appointment to anon, authenticated;

-- ---------- 2. Cierra la fuga de datos: política de tickets ----------
-- ANTES: "for select using (true)" exponía TODA la tabla a cualquiera (incluido anon).
drop policy if exists "tickets_public_select_by_id" on tickets;
drop policy if exists "tickets_select_own_or_admin" on tickets;
create policy "tickets_select_own_or_admin" on tickets
  for select using (is_admin() or (is_dentist() and dentist_id = auth.uid()));

-- ---------- 3. Función segura para el link público /ticket/[id] ----------
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
-- Después de correr esto: despliega el código actualizado
-- (src/app/ticket/[id]/page.tsx ahora usa get_ticket_by_id en vez
-- de un select directo) para que la página pública siga funcionando.
-- ============================================================
