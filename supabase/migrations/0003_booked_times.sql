-- ============================================================
-- MIGRACIÓN 0003: expone horarios ocupados por día (solo hora +
-- bandera de lleno, sin datos de clientes) para que el formulario
-- de reserva pública muestre disponibilidad ANTES de agendar.
--
-- Seguro correr en una base ya en producción (no borra datos).
-- Requiere que 0002_security_and_slots.sql ya esté aplicada.
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
