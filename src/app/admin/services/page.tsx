"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Service } from "@/lib/types";

export default function AdminServicesPage() {
  const supabase = createClient();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("services").select("*").order("created_at", { ascending: false });
    setServices((data as Service[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const priceNum = Number(price);
    if (name.trim().length < 2) return setError("Escribe un nombre válido.");
    if (isNaN(priceNum) || priceNum < 0) return setError("Escribe un precio válido.");

    setSaving(true);
    const { error: insertError } = await supabase.from("services").insert({
      name: name.trim(),
      description: description.trim() || null,
      price: priceNum,
      active: true,
    });
    setSaving(false);
    if (insertError) return setError(insertError.message);

    setName("");
    setDescription("");
    setPrice("");
    load();
  }

  async function toggleActive(service: Service) {
    await supabase.from("services").update({ active: !service.active }).eq("id", service.id);
    load();
  }

  async function updatePrice(service: Service, newPrice: number) {
    if (isNaN(newPrice) || newPrice < 0) return;
    await supabase.from("services").update({ price: newPrice }).eq("id", service.id);
    load();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl italic text-teal-700">Servicios</h1>
        <p className="mt-1 text-ink/60">
          Desactivar un servicio no lo borra: solo deja de mostrarse a los clientes hasta reactivarlo.
        </p>
      </div>

      <form onSubmit={handleAdd} className="card grid gap-4 sm:grid-cols-4 sm:items-end">
        <div className="sm:col-span-2">
          <label className="label">Nombre del servicio</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
        </div>
        <div>
          <label className="label">Precio (MXN)</label>
          <input className="input" type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </div>
        <div>
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? "Guardando..." : "Agregar"}
          </button>
        </div>
        <div className="sm:col-span-4">
          <label className="label">Descripción (opcional)</label>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
        </div>
        {error && <p className="text-sm text-red-600 sm:col-span-4">{error}</p>}
      </form>

      <div className="card">
        {loading ? (
          <p className="text-sm text-ink/50">Cargando...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink/50">
                <th className="py-2">Servicio</th>
                <th className="py-2">Precio</th>
                <th className="py-2">Estado</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0">
                  <td className="py-3">
                    <p className="font-medium">{s.name}</p>
                    {s.description && <p className="text-xs text-ink/50">{s.description}</p>}
                  </td>
                  <td className="py-3">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      defaultValue={s.price}
                      className="input w-28"
                      onBlur={(e) => updatePrice(s, Number(e.target.value))}
                    />
                  </td>
                  <td className="py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${s.active ? "bg-teal-50 text-teal-700" : "bg-red-50 text-red-600"}`}>
                      {s.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <button onClick={() => toggleActive(s)} className="btn-secondary px-3 py-1.5 text-xs">
                      {s.active ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
              {services.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-ink/40">Aún no hay servicios.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
