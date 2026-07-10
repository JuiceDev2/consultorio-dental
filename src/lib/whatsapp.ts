import type { ChatbotTurn } from "@/lib/chatbot/engine";

const GRAPH_API_VERSION = "v20.0";

function apiUrl() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  return `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;
}

async function callWhatsAppApi(payload: Record<string, unknown>) {
  const token = process.env.WHATSAPP_TOKEN;
  const res = await fetch(apiUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Error enviando mensaje de WhatsApp:", res.status, text);
  }
  return res;
}

/**
 * Manda el turno actual del chatbot (mensaje + botones) a un número de WhatsApp.
 * WhatsApp permite máximo 3 "reply buttons" por mensaje; si hay más opciones,
 * usa una "lista" (hasta 10 filas), que es el formato recomendado por Meta para esos casos.
 */
export async function sendWhatsAppTurn(to: string, turn: ChatbotTurn) {
  const { node, options } = turn;

  if (options.length === 0) {
    // Nodo final: solo texto, y si tiene CTA, lo agregamos como texto con el link
    // (WhatsApp no permite botones de "abrir URL" en mensajes interactivos de chatbot gratuito
    // sin plantilla aprobada, así que mandamos el link directo en el texto).
    const body = node.cta_url
      ? `${node.body}\n\n${node.cta_label ?? "Más información"}: ${resolveUrl(node.cta_url)}`
      : node.body;
    return callWhatsAppApi({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    });
  }

  if (options.length <= 3) {
    return callWhatsAppApi({
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: node.body },
        action: {
          buttons: options.map((opt) => ({
            type: "reply",
            reply: { id: opt.id, title: opt.label.slice(0, 20) },
          })),
        },
      },
    });
  }

  return callWhatsAppApi({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: node.body },
      action: {
        button: "Elegir",
        sections: [
          {
            title: "Opciones",
            rows: options.slice(0, 10).map((opt) => ({
              id: opt.id,
              title: opt.label.slice(0, 24),
            })),
          },
        ],
      },
    },
  });
}

function resolveUrl(url: string) {
  if (url.startsWith("http") || url.startsWith("tel:")) return url;
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return `${base}${url}`;
}

/** Extrae el número y el id de opción elegida (si la hay) de un payload entrante del webhook de Meta. */
export function parseIncomingWhatsApp(body: any): { from: string; selectedOptionId: string | null } | null {
  try {
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];
    if (!message) return null;

    const from = message.from as string;

    if (message.type === "interactive") {
      const interactive = message.interactive;
      const selectedOptionId =
        interactive?.button_reply?.id ?? interactive?.list_reply?.id ?? null;
      return { from, selectedOptionId };
    }

    // Mensaje de texto libre (ej. "hola" para iniciar) -> sin opción seleccionada,
    // el motor regresa al nodo donde iba, o al de inicio si es la primera vez.
    return { from, selectedOptionId: null };
  } catch {
    return null;
  }
}
