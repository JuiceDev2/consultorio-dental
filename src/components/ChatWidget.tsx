"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

interface ChatbotNode {
  id: string;
  body: string;
  cta_label: string | null;
  cta_url: string | null;
}
interface ChatbotOption {
  id: string;
  label: string;
}
interface ChatEntry {
  from: "bot" | "user";
  text: string;
}

function getSessionId(): string {
  const key = "chat_session_id";
  let id = typeof window !== "undefined" ? localStorage.getItem(key) : null;
  if (!id) {
    id = crypto.randomUUID();
    if (typeof window !== "undefined") localStorage.setItem(key, id);
  }
  return id;
}

export default function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [node, setNode] = useState<ChatbotNode | null>(null);
  const [options, setOptions] = useState<ChatbotOption[]>([]);
  const [history, setHistory] = useState<ChatEntry[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const hidden = pathname?.startsWith("/admin") || pathname?.startsWith("/dentist");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, open]);

  async function callBot(selectedOptionId?: string, reset?: boolean) {
    setLoading(true);
    try {
      const res = await fetch("/api/chatbot/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ external_id: getSessionId(), selected_option_id: selectedOptionId, reset }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setNode(data.node);
      setOptions(data.options ?? []);
      setHistory((prev) => [...prev, { from: "bot", text: data.node.body }]);
    } finally {
      setLoading(false);
    }
  }

  function handleOpen() {
    setOpen(true);
    if (!node) callBot();
  }

  function handleOption(opt: ChatbotOption) {
    setHistory((prev) => [...prev, { from: "user", text: opt.label }]);
    callBot(opt.id);
  }

  function handleRestart() {
    setHistory([]);
    setNode(null);
    setOptions([]);
    callBot(undefined, true);
  }

  if (hidden) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open ? (
        <div className="flex h-[28rem] w-80 flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-xl">
          <div className="flex items-center justify-between bg-teal-700 px-4 py-3 text-white">
            <span className="font-display italic">Asistente del consultorio</span>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white" aria-label="Cerrar chat">
              ✕
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {history.map((entry, i) => (
              <div key={i} className={`flex ${entry.from === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                    entry.from === "user" ? "bg-teal-600 text-white" : "bg-teal-50 text-ink"
                  }`}
                >
                  {entry.text}
                </div>
              </div>
            ))}

            {node?.cta_url && (
              <a
                href={node.cta_url}
                className="block rounded-xl bg-gold-500 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-gold-400"
              >
                {node.cta_label ?? "Ver más"}
              </a>
            )}

            {loading && <p className="text-xs text-ink/40">Escribiendo...</p>}
            <div ref={bottomRef} />
          </div>

          {options.length > 0 && !loading && (
            <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
              {options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleOption(opt)}
                  className="rounded-full border border-teal-500 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {options.length === 0 && node && !loading && (
            <div className="border-t border-line px-4 py-3">
              <button onClick={handleRestart} className="text-xs font-medium text-ink/50 hover:text-teal-700">
                ↺ Empezar de nuevo
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={handleOpen}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-700 text-2xl text-white shadow-lg transition-transform hover:scale-105"
          aria-label="Abrir chat"
        >
          💬
        </button>
      )}
    </div>
  );
}
