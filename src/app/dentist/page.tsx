"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatTime } from "@/lib/utils";

interface Row {
  id: string;
  client_name: string;
  client_phone: string;
  appointment_date: string;
  appointment_time: string;
  comment: string | null;
  status: string;
  appointment_services: { services: { name: string } | null }[];
}

export default function DentistDashboardPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("appointments")
        .select("id, client_name, client_phone, appointment_date, appointment_time, comment, status, appointment_services(services(name))")
        .eq("status", "confirmed")
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true })
        .limit(100);
      setRows((data as unknown as Row[]) ?? []);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl italic text-teal-700">Citas confirmadas</h1>
          <p className="mt-1 text-ink/60">
            Puedes cobrar cualquier cita cuando el cliente llegue, sin importar el horario en el que se agendó.
          </p>
        </div>
        <Link href="/dentist/pos" className="btn-primary">+ Cliente en sucursal</Link>
      </div>

      {loading ? (
        <p className="text-sm text-ink/50">Cargando...</p>
      ) : rows.length === 0 ? (
        <div className="card text-center text-ink/40">No hay citas confirmadas por el momento.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <div key={r.id} className="card">
              <p className="font-display text-lg italic text-teal-700">{r.client_name}</p>
              <p className="text-sm text-ink/50">{r.client_phone}</p>
              <p className="mt-2 text-sm">
                {formatDate(r.appointment_date)} · {formatTime(r.appointment_time)}
              </p>
              <p className="mt-1 text-sm text-ink/60">
                {r.appointment_services.map((s) => s.services?.name).filter(Boolean).join(", ") || "Sin servicio elegido"}
              </p>
              {r.comment && <p className="mt-2 rounded-lg bg-teal-50 px-3 py-2 text-xs text-ink/70">&ldquo;{r.comment}&rdquo;</p>}
              <Link href={`/dentist/pos?appointment_id=${r.id}`} className="btn-primary mt-4 w-full">
                Cobrar / atender
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
