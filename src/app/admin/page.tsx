import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const supabase = createClient();

  const todayStr = new Date().toISOString().split("T")[0];
  const monthStart = `${todayStr.slice(0, 7)}-01`;

  const [{ data: ticketsMonth }, { data: ticketsToday }, { data: appointments }, { data: dentists }] =
    await Promise.all([
      supabase.from("tickets").select("total, dentist_id, created_at").gte("created_at", monthStart),
      supabase.from("tickets").select("total").gte("created_at", `${todayStr}T00:00:00`),
      supabase
        .from("appointments")
        .select("status")
        .gte("appointment_date", todayStr),
      supabase.from("profiles").select("id, full_name, active").eq("role", "dentist"),
    ]);

  const salesMonth = (ticketsMonth ?? []).reduce((sum, t) => sum + Number(t.total), 0);
  const salesToday = (ticketsToday ?? []).reduce((sum, t) => sum + Number(t.total), 0);
  const confirmedUpcoming = (appointments ?? []).filter((a) => a.status === "confirmed").length;

  const perDentist = (dentists ?? []).map((d) => {
    const tickets = (ticketsMonth ?? []).filter((t) => t.dentist_id === d.id);
    return {
      id: d.id,
      name: d.full_name,
      active: d.active,
      total: tickets.reduce((s, t) => s + Number(t.total), 0),
      count: tickets.length,
    };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl italic text-teal-700">Métricas del consultorio</h1>
        <p className="mt-1 text-ink/60">Resumen del desempeño general.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Ventas de hoy" value={formatCurrency(salesToday)} />
        <StatCard label="Ventas del mes" value={formatCurrency(salesMonth)} />
        <StatCard label="Citas confirmadas próximas" value={String(confirmedUpcoming)} />
      </div>

      <div className="card">
        <h2 className="mb-4 font-display text-xl italic text-teal-700">Desempeño por dentista (mes actual)</h2>
        {perDentist.length === 0 ? (
          <p className="text-sm text-ink/50">Aún no hay dentistas registrados.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink/50">
                <th className="py-2">Dentista</th>
                <th className="py-2">Estado</th>
                <th className="py-2">Tickets</th>
                <th className="py-2">Ventas</th>
              </tr>
            </thead>
            <tbody>
              {perDentist.map((d) => (
                <tr key={d.id} className="border-b border-line last:border-0">
                  <td className="py-3 font-medium">{d.name}</td>
                  <td className="py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${d.active ? "bg-teal-50 text-teal-700" : "bg-red-50 text-red-600"}`}>
                      {d.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="py-3">{d.count}</td>
                  <td className="py-3 font-semibold">{formatCurrency(d.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="text-sm text-ink/50">{label}</p>
      <p className="mt-2 font-display text-3xl italic text-teal-700">{value}</p>
    </div>
  );
}
