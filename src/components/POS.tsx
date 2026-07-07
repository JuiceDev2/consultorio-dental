"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Service, TicketItem } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

interface Props {
  dentistId: string;
  appointmentId?: string;
}

export default function POS({ dentistId, appointmentId }: Props) {
  const supabase = createClient();
  const [services, setServices] = useState<Service[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [clientName, setClientName] = useState("Cliente en sucursal");
  const [amountPaid, setAmountPaid] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: activeServices } = await supabase.from("services").select("*").eq("active", true).order("name");
      setServices((activeServices as Service[]) ?? []);

      if (appointmentId) {
        const { data: appt } = await supabase
          .from("appointments")
          .select("client_name, appointment_services(service_id)")
          .eq("id", appointmentId)
          .single();
        if (appt) {
          setClientName(appt.client_name);
          setSelected((appt as any).appointment_services.map((s: any) => s.service_id));
        }
      }
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  const total = useMemo(
    () => services.filter((s) => selected.includes(s.id)).reduce((sum, s) => sum + Number(s.price), 0),
    [selected, services]
  );

  const paid = Number(amountPaid) || 0;
  const change = paid - total;

  function toggleService(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleCheckout() {
    setError(null);
    if (selected.length === 0) return setError("Selecciona al menos un servicio.");
    if (paid < total) return setError("El monto pagado es menor al total.");
    if (clientName.trim().length < 1) return setError("Escribe una referencia de cliente.");

    setSaving(true);
    const items: TicketItem[] = services
      .filter((s) => selected.includes(s.id))
      .map((s) => ({ service_id: s.id, name: s.name, price: Number(s.price) }));

    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .insert({
        appointment_id: appointmentId ?? null,
        dentist_id: dentistId,
        client_name: clientName.trim(),
        items,
        total,
        amount_paid: paid,
        change_given: Math.max(change, 0),
      })
      .select("id")
      .single();

    if (ticketError || !ticket) {
      setSaving(false);
      return setError(ticketError?.message ?? "No se pudo generar el ticket.");
    }

    if (appointmentId) {
      await supabase.from("appointments").update({ status: "completed" }).eq("id", appointmentId);
    }

    setSaving(false);
    setCreatedTicketId(ticket.id);
  }

  if (createdTicketId) {
    const link = typeof window !== "undefined" ? `${window.location.origin}/ticket/${createdTicketId}` : "";
    return (
      <div className="card mx-auto max-w-md text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-3xl">🧾</div>
        <h2 className="font-display text-2xl italic text-teal-700">Ticket generado</h2>
        <p className="mt-2 text-ink/60">Comparte este enlace con el cliente:</p>
        <div className="mt-3 break-all rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-700">{link}</div>
        <div className="mt-4 flex justify-center gap-3">
          <button className="btn-secondary" onClick={() => navigator.clipboard.writeText(link)}>Copiar enlace</button>
          <Link href={`/ticket/${createdTicketId}`} target="_blank" className="btn-primary">Ver ticket</Link>
        </div>
        <button
          className="mt-6 text-sm text-ink/50 hover:text-ink"
          onClick={() => {
            setCreatedTicketId(null);
            setSelected([]);
            setAmountPaid("");
            setClientName("Cliente en sucursal");
          }}
        >
          Registrar otra venta
        </button>
      </div>
    );
  }

  if (loading) return <p className="text-sm text-ink/50">Cargando...</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="card lg:col-span-2">
        <label className="label">Cliente (referencia)</label>
        <input className="input mb-4" value={clientName} onChange={(e) => setClientName(e.target.value)} maxLength={120} />

        <span className="label">Servicios realizados</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {services.map((s) => (
            <label
              key={s.id}
              className={`flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 transition-colors ${
                selected.includes(s.id) ? "border-teal-500 bg-teal-50" : "border-line bg-white"
              }`}
            >
              <span className="flex items-center gap-3">
                <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={selected.includes(s.id)} onChange={() => toggleService(s.id)} />
                {s.name}
              </span>
              <span className="font-semibold text-teal-700">{formatCurrency(Number(s.price))}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="card h-fit space-y-4">
        <h3 className="font-display text-xl italic text-teal-700">Cobro</h3>
        <div className="flex justify-between text-sm text-ink/60">
          <span>Total a pagar</span>
          <span className="text-lg font-bold text-ink">{formatCurrency(total)}</span>
        </div>
        <div>
          <label className="label">¿Con cuánto paga?</label>
          <input
            type="number"
            min={0}
            step="0.01"
            className="input"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
          />
        </div>
        <div className="flex justify-between rounded-lg bg-teal-50 px-4 py-3">
          <span className="text-sm text-ink/60">Cambio</span>
          <span className={`text-lg font-bold ${change < 0 ? "text-red-600" : "text-teal-700"}`}>
            {change < 0 ? `Falta ${formatCurrency(Math.abs(change))}` : formatCurrency(change)}
          </span>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button onClick={handleCheckout} disabled={saving} className="btn-primary w-full">
          {saving ? "Generando ticket..." : "Cobrar y generar ticket"}
        </button>
      </div>
    </div>
  );
}
