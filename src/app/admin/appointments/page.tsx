import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  confirmed: "Confirmada",
  completed: "Atendida",
  cancelled: "Cancelada",
};

const statusStyle: Record<string, string> = {
  confirmed: "bg-teal-50 text-teal-700",
  completed: "bg-gold-400/20 text-gold-500",
  cancelled: "bg-red-50 text-red-600",
};

export default async function AdminAppointmentsPage() {
  const supabase = createClient();
  const { data: appointments } = await supabase
    .from("appointments")
    .select("*, appointment_services(price_at_booking, services(name)), dentist:profiles!appointments_dentist_id_fkey(full_name)")
    .order("appointment_date", { ascending: false })
    .order("appointment_time", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl italic text-teal-700">Todas las citas</h1>
        <p className="mt-1 text-ink/60">Últimas 200 citas registradas (en línea y de piso).</p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink/50">
              <th className="py-2 pr-3">Fecha</th>
              <th className="py-2 pr-3">Cliente</th>
              <th className="py-2 pr-3">Teléfono</th>
              <th className="py-2 pr-3">Servicios</th>
              <th className="py-2 pr-3">Dentista</th>
              <th className="py-2 pr-3">Origen</th>
              <th className="py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {(appointments ?? []).map((a: any) => (
              <tr key={a.id} className="border-b border-line last:border-0 align-top">
                <td className="py-3 pr-3 whitespace-nowrap">
                  {formatDate(a.appointment_date)}
                  <br />
                  <span className="text-xs text-ink/50">{formatTime(a.appointment_time)}</span>
                </td>
                <td className="py-3 pr-3 font-medium">{a.client_name}</td>
                <td className="py-3 pr-3">{a.client_phone}</td>
                <td className="py-3 pr-3">
                  {(a.appointment_services ?? []).map((s: any) => s.services?.name).join(", ") || "—"}
                  <div className="text-xs text-ink/50">
                    {formatCurrency((a.appointment_services ?? []).reduce((sum: number, s: any) => sum + Number(s.price_at_booking), 0))}
                  </div>
                </td>
                <td className="py-3 pr-3">{a.dentist?.full_name ?? "Sin asignar"}</td>
                <td className="py-3 pr-3 text-xs uppercase text-ink/40">{a.source === "online" ? "En línea" : "En sucursal"}</td>
                <td className="py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusStyle[a.status]}`}>{statusLabel[a.status]}</span>
                </td>
              </tr>
            ))}
            {(appointments ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-ink/40">Aún no hay citas registradas.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
