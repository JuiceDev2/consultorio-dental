import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BookingForm from "@/components/BookingForm";
import type { Service } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AgendarPage() {
  const supabase = createClient();
  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("active", true)
    .order("price", { ascending: true });

  return (
    <main className="mx-auto min-h-screen max-w-xl px-6 py-12">
      <Link href="/" className="mb-6 inline-block text-sm text-ink/50 hover:text-ink">
        ← Volver al inicio
      </Link>
      <h1 className="font-display text-3xl italic text-teal-700">Agendar cita</h1>
      <p className="mt-1 mb-6 text-ink/60">
        Si no sabes qué necesitas, elige &ldquo;Consulta de valoración&rdquo; y nosotros te orientamos.
      </p>
      <BookingForm services={(services as Service[]) ?? []} />
    </main>
  );
}
