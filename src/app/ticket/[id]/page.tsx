import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import type { Ticket } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TicketPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: ticket } = await supabase.rpc("get_ticket_by_id", { p_id: params.id }).single();

  if (!ticket) return notFound();

  const t = ticket as Ticket;

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-12">
      <div className="card">
        <div className="text-center">
          <span className="text-3xl">🦷</span>
          <h1 className="mt-2 font-display text-2xl italic text-teal-700">Consultorio Dental</h1>
          <p className="text-xs text-ink/40">Comprobante de servicio</p>
        </div>

        <div className="my-6 border-t border-dashed border-line" />

        <div className="space-y-1 text-sm">
          <p><span className="text-ink/50">Cliente:</span> {t.client_name}</p>
          <p><span className="text-ink/50">Fecha:</span> {new Date(t.created_at).toLocaleString("es-MX")}</p>
          <p><span className="text-ink/50">Folio:</span> {t.id.slice(0, 8).toUpperCase()}</p>
        </div>

        <div className="my-6 border-t border-dashed border-line" />

        <table className="w-full text-sm">
          <tbody>
            {t.items.map((item, i) => (
              <tr key={i}>
                <td className="py-1">{item.name}</td>
                <td className="py-1 text-right">{formatCurrency(item.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="my-6 border-t border-dashed border-line" />

        <div className="space-y-1 text-sm">
          <div className="flex justify-between font-bold text-base">
            <span>Total</span>
            <span>{formatCurrency(Number(t.total))}</span>
          </div>
          <div className="flex justify-between text-ink/60">
            <span>Pagó con</span>
            <span>{formatCurrency(Number(t.amount_paid))}</span>
          </div>
          <div className="flex justify-between text-ink/60">
            <span>Cambio</span>
            <span>{formatCurrency(Number(t.change_given))}</span>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-ink/40">Gracias por tu visita.</p>
      </div>
    </main>
  );
}
