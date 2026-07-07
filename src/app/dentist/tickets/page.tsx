"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Ticket } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export default function DentistTicketsPage() {
  const supabase = createClient();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      const { data } = await supabase
        .from("tickets")
        .select("*")
        .eq("dentist_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(100);
      setTickets((data as Ticket[]) ?? []);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recent = tickets.slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl italic text-teal-700">Tickets</h1>
        <p className="mt-1 text-ink/60">Toca un ticket para abrir su página pública y compartir el enlace.</p>
      </div>

      <section>
        <h2 className="mb-3 font-display text-xl italic text-teal-700">Recientes</h2>
        <TicketGrid tickets={recent} loading={loading} />
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl italic text-teal-700">Todos los tickets</h2>
        <TicketGrid tickets={tickets} loading={loading} />
      </section>

      {!loading && userId === null && <p className="text-sm text-red-600">No se pudo identificar tu sesión.</p>}
    </div>
  );
}

function TicketGrid({ tickets, loading }: { tickets: Ticket[]; loading: boolean }) {
  if (loading) return <p className="text-sm text-ink/50">Cargando...</p>;
  if (tickets.length === 0) return <div className="card text-center text-ink/40">Aún no hay tickets.</div>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tickets.map((t) => (
        <Link key={t.id} href={`/ticket/${t.id}`} target="_blank" className="card block transition-shadow hover:shadow-md">
          <p className="font-medium">{t.client_name}</p>
          <p className="text-xs text-ink/50">{new Date(t.created_at).toLocaleString("es-MX")}</p>
          <p className="mt-2 text-sm text-ink/60">{t.items.length} servicio(s)</p>
          <p className="mt-1 font-display text-xl italic text-teal-700">{formatCurrency(Number(t.total))}</p>
        </Link>
      ))}
    </div>
  );
}
