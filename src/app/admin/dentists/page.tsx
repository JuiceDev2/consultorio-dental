"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export default function AdminDentistsPage() {
  const supabase = createClient();
  const [dentists, setDentists] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<{ label: string; value: string } | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("profiles").select("*").eq("role", "dentist").order("created_at", { ascending: false });
    setDentists((data as Profile[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (fullName.trim().length < 2) return setError("Escribe un nombre válido.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Escribe un correo válido.");

    setSaving(true);
    const res = await fetch("/api/dentists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: fullName, email }),
    });
    const json = await res.json();
    setSaving(false);

    if (!res.ok) return setError(json.error);

    setTempPassword({ label: `${fullName} (${email})`, value: json.temp_password });
    setFullName("");
    setEmail("");
    load();
  }

  async function toggleActive(d: Profile) {
    await fetch(`/api/dentists/${d.id}/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !d.active }),
    });
    load();
  }

  async function resetPassword(d: Profile) {
    const res = await fetch(`/api/dentists/${d.id}/reset-password`, { method: "POST" });
    const json = await res.json();
    if (res.ok) setTempPassword({ label: `${d.full_name} (${d.email})`, value: json.temp_password });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl italic text-teal-700">Dentistas</h1>
        <p className="mt-1 text-ink/60">Da de alta colaboradores, gestiona su acceso y recupera su cuenta al instante.</p>
      </div>

      {tempPassword && (
        <div className="card border-gold-500 bg-gold-400/10">
          <p className="text-sm font-medium">Contraseña temporal para {tempPassword.label}:</p>
          <p className="mt-1 font-mono text-lg font-bold tracking-wider text-teal-700">{tempPassword.value}</p>
          <p className="mt-1 text-xs text-ink/50">Compártela solo por un canal seguro. No se volverá a mostrar.</p>
          <button onClick={() => setTempPassword(null)} className="btn-secondary mt-3 px-3 py-1.5 text-xs">Cerrar</button>
        </div>
      )}

      <form onSubmit={handleCreate} className="card grid gap-4 sm:grid-cols-3 sm:items-end">
        <div>
          <label className="label">Nombre completo</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Correo</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Creando..." : "Agregar dentista"}
        </button>
        {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}
      </form>

      <div className="card">
        {loading ? (
          <p className="text-sm text-ink/50">Cargando...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink/50">
                <th className="py-2">Dentista</th>
                <th className="py-2">Correo</th>
                <th className="py-2">Estado</th>
                <th className="py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {dentists.map((d) => (
                <tr key={d.id} className="border-b border-line last:border-0">
                  <td className="py-3 font-medium">{d.full_name}</td>
                  <td className="py-3 text-ink/60">{d.email}</td>
                  <td className="py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${d.active ? "bg-teal-50 text-teal-700" : "bg-red-50 text-red-600"}`}>
                      {d.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => resetPassword(d)} className="btn-secondary px-3 py-1.5 text-xs">
                        Resetear contraseña
                      </button>
                      <button onClick={() => toggleActive(d)} className="btn-secondary px-3 py-1.5 text-xs">
                        {d.active ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {dentists.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-ink/40">Aún no hay dentistas registrados.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
