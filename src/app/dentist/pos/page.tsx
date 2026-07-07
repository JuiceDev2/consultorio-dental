import { createClient } from "@/lib/supabase/server";
import POS from "@/components/POS";

export const dynamic = "force-dynamic";

export default async function PosPage({ searchParams }: { searchParams: { appointment_id?: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl italic text-teal-700">Punto de venta</h1>
        <p className="mt-1 text-ink/60">
          Elige uno o varios servicios y registra el cobro. Puedes agregar más servicios a una cita existente.
        </p>
      </div>
      <POS dentistId={user!.id} appointmentId={searchParams.appointment_id} />
    </div>
  );
}
