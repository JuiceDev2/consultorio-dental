"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/dentist", label: "Citas de hoy" },
  { href: "/dentist/pos", label: "Punto de venta" },
  { href: "/dentist/tickets", label: "Tickets" },
];

export default function DentistNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <span className="font-display text-lg italic text-teal-700">Panel Dentista</span>
        <nav className="flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                pathname === l.href ? "bg-teal-500 text-white" : "text-ink/60 hover:bg-teal-50"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <button onClick={handleSignOut} className="ml-2 rounded-full px-4 py-2 text-sm font-medium text-ink/50 hover:bg-red-50 hover:text-red-600">
            Salir
          </button>
        </nav>
      </div>
    </header>
  );
}
