import { NextRequest, NextResponse } from "next/server";
import { advanceChatbot } from "@/lib/chatbot/engine";
import { parseIncomingWhatsApp, sendWhatsAppTurn } from "@/lib/whatsapp";

// Meta llama a este GET una sola vez, cuando configuras la URL del webhook en su panel,
// para confirmar que el servidor es tuyo (handshake de verificación).
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Token de verificación inválido.", { status: 403 });
}

// Meta manda un POST aquí cada vez que alguien te escribe por WhatsApp.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const incoming = parseIncomingWhatsApp(body);

    // Meta también manda notificaciones de "status" (entregado/leído) que no son mensajes.
    if (!incoming) return NextResponse.json({ ok: true });

    const turn = await advanceChatbot({
      channel: "whatsapp",
      externalId: incoming.from,
      selectedOptionId: incoming.selectedOptionId,
    });

    if (turn) {
      await sendWhatsAppTurn(incoming.from, turn);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error en webhook de WhatsApp:", err);
    // Siempre 200, o Meta reintenta agresivamente el mismo mensaje fallido.
    return NextResponse.json({ ok: true });
  }
}
