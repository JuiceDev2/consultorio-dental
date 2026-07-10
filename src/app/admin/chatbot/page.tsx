"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Node {
  id: string;
  body: string;
  is_start: boolean;
  cta_label: string | null;
  cta_url: string | null;
}
interface Option {
  id: string;
  node_id: string;
  label: string;
  next_node_id: string | null;
  sort_order: number;
}

const EMPTY_NODE = { body: "", is_start: false, cta_label: "", cta_url: "" };

export default function ChatbotAdminPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNode, setNewNode] = useState(EMPTY_NODE);
  const [savingNodeId, setSavingNodeId] = useState<string | null>(null);
  const [newOptionByNode, setNewOptionByNode] = useState<Record<string, { label: string; target: string }>>({});
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const [{ data: n }, { data: o }] = await Promise.all([
      supabase.from("chatbot_nodes").select("*").order("created_at", { ascending: true }),
      supabase.from("chatbot_options").select("*").order("sort_order", { ascending: true }),
    ]);
    setNodes(n ?? []);
    setOptions(o ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function nodePreview(id: string | null) {
    if (!id) return "— (opción sin destino, bórrala o asígnale uno) —";
    const n = nodes.find((x) => x.id === id);
    return n ? n.body.slice(0, 40) + (n.body.length > 40 ? "..." : "") : "(nodo eliminado)";
  }

  async function createNode() {
    if (newNode.body.trim().length < 1) return setError("Escribe el mensaje del nodo.");
    setError(null);
    const supabase = createClient();

    if (newNode.is_start) {
      await supabase.from("chatbot_nodes").update({ is_start: false }).eq("is_start", true);
    }

    const { error: err } = await supabase.from("chatbot_nodes").insert({
      body: newNode.body.trim(),
      is_start: newNode.is_start,
      cta_label: newNode.cta_label.trim() || null,
      cta_url: newNode.cta_url.trim() || null,
    });
    if (err) return setError(err.message);
    setNewNode(EMPTY_NODE);
    load();
  }

  async function updateNode(node: Node) {
    setSavingNodeId(node.id);
    const supabase = createClient();

    if (node.is_start) {
      await supabase.from("chatbot_nodes").update({ is_start: false }).eq("is_start", true).neq("id", node.id);
    }

    const { error: err } = await supabase
      .from("chatbot_nodes")
      .update({
        body: node.body,
        is_start: node.is_start,
        cta_label: node.cta_label || null,
        cta_url: node.cta_url || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", node.id);
    setSavingNodeId(null);
    if (err) return setError(err.message);
    load();
  }

  async function deleteNode(id: string) {
    if (!confirm("¿Borrar este nodo? Las opciones que lleven aquí quedarán sin destino.")) return;
    const supabase = createClient();
    await supabase.from("chatbot_nodes").delete().eq("id", id);
    load();
  }

  async function addOption(nodeId: string) {
    const draft = newOptionByNode[nodeId];
    if (!draft?.label?.trim() || !draft?.target) return setError("Completa el texto del botón y el destino.");
    setError(null);
    const supabase = createClient();
    const siblingCount = options.filter((o) => o.node_id === nodeId).length;
    const { error: err } = await supabase.from("chatbot_options").insert({
      node_id: nodeId,
      label: draft.label.trim(),
      next_node_id: draft.target,
      sort_order: siblingCount,
    });
    if (err) return setError(err.message);
    setNewOptionByNode((prev) => ({ ...prev, [nodeId]: { label: "", target: "" } }));
    load();
  }

  async function updateOption(opt: Option) {
    const supabase = createClient();
    const { error: err } = await supabase
      .from("chatbot_options")
      .update({ label: opt.label, next_node_id: opt.next_node_id })
      .eq("id", opt.id);
    if (err) return setError(err.message);
    load();
  }

  async function deleteOption(id: string) {
    const supabase = createClient();
    await supabase.from("chatbot_options").delete().eq("id", id);
    load();
  }

  if (loading) return <p className="text-sm text-ink/50">Cargando...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl italic text-teal-700">Chatbot</h1>
        <p className="mt-1 text-ink/60">
          Edita las preguntas y respuestas del asistente (chat web y WhatsApp comparten el mismo árbol).
        </p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

      <div className="card space-y-3">
        <h2 className="font-display text-xl italic text-teal-700">Nuevo nodo</h2>
        <textarea
          className="input min-h-20"
          placeholder="Mensaje que va a mostrar el bot..."
          value={newNode.body}
          onChange={(e) => setNewNode((p) => ({ ...p, body: e.target.value }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            className="input"
            placeholder="Texto del botón CTA (opcional, ej. Agendar cita)"
            value={newNode.cta_label}
            onChange={(e) => setNewNode((p) => ({ ...p, cta_label: e.target.value }))}
          />
          <input
            className="input"
            placeholder="URL del CTA (ej. /agendar)"
            value={newNode.cta_url}
            onChange={(e) => setNewNode((p) => ({ ...p, cta_url: e.target.value }))}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={newNode.is_start}
            onChange={(e) => setNewNode((p) => ({ ...p, is_start: e.target.checked }))}
          />
          Es el nodo de inicio (reemplaza al que esté marcado ahora)
        </label>
        <button onClick={createNode} className="btn-primary">
          Crear nodo
        </button>
      </div>

      <div className="space-y-4">
        {nodes.map((node) => {
          const nodeOptions = options.filter((o) => o.node_id === node.id);
          const draft = newOptionByNode[node.id] ?? { label: "", target: "" };
          return (
            <div key={node.id} className="card space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">
                  {node.is_start ? "★ Nodo de inicio" : nodeOptions.length === 0 ? "Nodo final" : "Nodo"}
                </span>
                <button onClick={() => deleteNode(node.id)} className="text-xs text-red-600 hover:underline">
                  Borrar nodo
                </button>
              </div>

              <textarea
                className="input min-h-16"
                value={node.body}
                onChange={(e) =>
                  setNodes((prev) => prev.map((n) => (n.id === node.id ? { ...n, body: e.target.value } : n)))
                }
              />

              <div className="grid grid-cols-2 gap-3">
                <input
                  className="input"
                  placeholder="Texto del botón CTA (opcional)"
                  value={node.cta_label ?? ""}
                  onChange={(e) =>
                    setNodes((prev) => prev.map((n) => (n.id === node.id ? { ...n, cta_label: e.target.value } : n)))
                  }
                />
                <input
                  className="input"
                  placeholder="URL del CTA (ej. /agendar)"
                  value={node.cta_url ?? ""}
                  onChange={(e) =>
                    setNodes((prev) => prev.map((n) => (n.id === node.id ? { ...n, cta_url: e.target.value } : n)))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={node.is_start}
                    onChange={(e) =>
                      setNodes((prev) => prev.map((n) => (n.id === node.id ? { ...n, is_start: e.target.checked } : n)))
                    }
                  />
                  Nodo de inicio
                </label>
                <button
                  onClick={() => updateNode(node)}
                  disabled={savingNodeId === node.id}
                  className="rounded-full bg-teal-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-500"
                >
                  {savingNodeId === node.id ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>

              <div className="border-t border-line pt-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink/40">
                  Opciones (botones) de este nodo
                </span>
                <div className="mt-2 space-y-2">
                  {nodeOptions.map((opt) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <input
                        className="input flex-1"
                        value={opt.label}
                        onChange={(e) =>
                          setOptions((prev) =>
                            prev.map((o) => (o.id === opt.id ? { ...o, label: e.target.value } : o))
                          )
                        }
                      />
                      <select
                        className="input flex-1"
                        value={opt.next_node_id ?? ""}
                        onChange={(e) =>
                          setOptions((prev) =>
                            prev.map((o) => (o.id === opt.id ? { ...o, next_node_id: e.target.value } : o))
                          )
                        }
                      >
                        <option value="">Elige el nodo destino...</option>
                        {nodes.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.body.slice(0, 50)}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => updateOption(opt)}
                        className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100"
                      >
                        Guardar
                      </button>
                      <button onClick={() => deleteOption(opt.id)} className="text-xs text-red-600 hover:underline">
                        Borrar
                      </button>
                    </div>
                  ))}
                  {nodeOptions.length === 0 && (
                    <p className="text-xs text-ink/40">Sin opciones — este nodo es un final de conversación.</p>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <input
                    className="input flex-1"
                    placeholder="Texto del nuevo botón"
                    value={draft.label}
                    onChange={(e) =>
                      setNewOptionByNode((prev) => ({ ...prev, [node.id]: { ...draft, label: e.target.value } }))
                    }
                  />
                  <select
                    className="input flex-1"
                    value={draft.target}
                    onChange={(e) =>
                      setNewOptionByNode((prev) => ({ ...prev, [node.id]: { ...draft, target: e.target.value } }))
                    }
                  >
                    <option value="">Elige el nodo destino...</option>
                    {nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.body.slice(0, 50)}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => addOption(node.id)}
                    className="rounded-full bg-teal-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-500"
                  >
                    + Agregar
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
