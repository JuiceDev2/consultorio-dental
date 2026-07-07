"use client";

import { useEffect, useMemo, useState } from "react";
import type { Service } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { COMMENT_MAX_LENGTH, NAME_MAX_LENGTH, formatCurrency, formatTime, isValidPhone } from "@/lib/utils";

export default function BookingForm({ services }: { services: Service[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [fullTimes, setFullTimes] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Cada vez que cambia la fecha, trae los horarios ya llenos para ese día
  // (solo hora + bandera de lleno, sin datos de clientes) para mostrar
  // disponibilidad antes de que el cliente intente agendar.
  useEffect(() => {
    let active = true;
    if (!date) {
      setFullTimes([]);
      return;
    }
    setLoadingSlots(true);
    supabase
      .rpc("get_booked_times", { p_date: date })
      .then(({ data }) => {
        if (!active) return;
        const full = (data ?? [])
          .filter((row: { appointment_time: string; is_full: boolean }) => row.is_full)
          .map((row: { appointment_time: string }) => row.appointment_time.slice(0, 5));
        setFullTimes(full);
      })
      .finally(() => {
        if (active) setLoadingSlots(false);
      });
    return () => {
      active = false;
    };
  }, [date, supabase]);

  const isChosenTimeFull = time.length > 0 && fullTimes.includes(time);

  const total = useMemo(
    () => services.filter((s) => selected.includes(s.id)).reduce((sum, s) => sum + Number(s.price), 0),
    [selected, services]
  );

  function toggleService(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 2) return setError("Escribe tu nombre completo.");
    if (!isValidPhone(phone)) return setError("Escribe un número telefónico válido.");
    if (selected.length === 0) return setError("Elige al menos un servicio.");
    if (!date || !time) return setError("Elige fecha y hora.");
    if (isChosenTimeFull) return setError("Ese horario ya está lleno. Elige otra hora disponible.");

    setLoading(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: name,
          client_phone: phone,
          service_ids: selected,
          date,
          time,
          comment,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "No se pudo agendar la cita.");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="card text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-3xl">
          ✅
        </div>
        <h2 className="font-display text-2xl italic text-teal-700">¡Tu cita está confirmada!</h2>
        <p className="mt-2 text-ink/60">
          Te esperamos el <strong>{date}</strong> a las <strong>{time}</strong> hrs. Si necesitas cambiar algo,
          llámanos con tu nombre y teléfono a la mano.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-5">
      <div>
        <label className="label" htmlFor="name">Nombre completo</label>
        <input
          id="name"
          className="input"
          value={name}
          maxLength={NAME_MAX_LENGTH}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="phone">Número telefónico</label>
        <input
          id="phone"
          className="input"
          value={phone}
          maxLength={20}
          placeholder="55 1234 5678"
          onChange={(e) => setPhone(e.target.value)}
          required
        />
      </div>

      <div>
        <span className="label">Servicios</span>
        <div className="space-y-2">
          {services.map((s) => (
            <label
              key={s.id}
              className={`flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 transition-colors ${
                selected.includes(s.id) ? "border-teal-500 bg-teal-50" : "border-line bg-white"
              }`}
            >
              <span className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-teal-600"
                  checked={selected.includes(s.id)}
                  onChange={() => toggleService(s.id)}
                />
                <span>
                  <span className="block font-medium">{s.name}</span>
                  {s.description && <span className="block text-xs text-ink/50">{s.description}</span>}
                </span>
              </span>
              <span className="whitespace-nowrap font-semibold text-teal-700">{formatCurrency(Number(s.price))}</span>
            </label>
          ))}
          {services.length === 0 && (
            <p className="text-sm text-ink/50">No hay servicios disponibles en este momento.</p>
          )}
        </div>
        {selected.length > 0 && (
          <p className="mt-2 text-right text-sm text-ink/60">
            Total estimado: <span className="font-semibold text-ink">{formatCurrency(total)}</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="date">Fecha</label>
          <input
            id="date"
            type="date"
            className="input"
            min={todayStr}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="time">Hora</label>
          <input
            id="time"
            type="time"
            className={`input ${isChosenTimeFull ? "border-red-400" : ""}`}
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
        </div>
      </div>

      {date && (
        <div className="text-xs text-ink/50">
          {loadingSlots ? (
            "Consultando disponibilidad..."
          ) : fullTimes.length > 0 ? (
            <>
              Horarios ya llenos ese día: {fullTimes.map((t) => formatTime(t)).join(", ")}
            </>
          ) : (
            "Todos los horarios están disponibles ese día."
          )}
        </div>
      )}

      {isChosenTimeFull && (
        <p className="text-sm text-red-600">Ese horario ya está lleno. Elige otra hora.</p>
      )}

      <div>
        <div className="flex items-center justify-between">
          <label className="label" htmlFor="comment">Comentario (opcional)</label>
          <span className="text-xs text-ink/40">
            {comment.length}/{COMMENT_MAX_LENGTH}
          </span>
        </div>
        <textarea
          id="comment"
          className="input min-h-24 resize-none"
          value={comment}
          maxLength={COMMENT_MAX_LENGTH}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Ej. Me duele la muela superior derecha desde hace 3 días."
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={loading || isChosenTimeFull} className="btn-primary w-full">
        {loading ? "Agendando..." : "Agendar cita"}
      </button>
    </form>
  );
}
