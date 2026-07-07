import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-teal-100/60 blur-3xl"
      />

      <header className="relative mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="font-display text-xl italic text-teal-700">Consultorio Dental</span>
        <Link href="/login" className="btn-secondary text-sm">
          Iniciar sesión
        </Link>
      </header>

      <section className="relative mx-auto flex max-w-3xl flex-col items-center px-6 pb-24 pt-16 text-center">
        <span className="mb-4 rounded-full border border-teal-100 bg-teal-50 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-teal-700">
          Sonríe sin esperar
        </span>
        <h1 className="font-display text-5xl leading-tight text-ink sm:text-6xl">
          Tu cita dental,
          <br />
          <span className="italic text-teal-600">en menos de un minuto.</span>
        </h1>
        <p className="mt-6 max-w-md text-ink/60">
          Elige el servicio, la fecha y la hora que prefieras. Nosotros confirmamos tu cita al instante.
        </p>

        <Link
          href="/agendar"
          className="mt-12 flex h-56 w-56 flex-col items-center justify-center rounded-full bg-teal-500 text-white shadow-xl shadow-teal-500/30 transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-4 focus-visible:outline-teal-200 sm:h-64 sm:w-64"
        >
          <span className="text-3xl">🦷</span>
          <span className="mt-2 font-display text-2xl italic">Agendar cita</span>
        </Link>

        <p className="mt-10 text-sm text-ink/40">No necesitas crear una cuenta.</p>
      </section>
    </main>
  );
}
