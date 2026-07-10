import { NextRequest, NextResponse } from "next/server";
import { advanceChatbot, resetChatbot } from "@/lib/chatbot/engine";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { external_id, selected_option_id, reset } = body ?? {};

    if (typeof external_id !== "string" || external_id.length < 8 || external_id.length > 100) {
      return NextResponse.json({ error: "Sesión inválida." }, { status: 400 });
    }

    const turn = reset
      ? await resetChatbot("web", external_id)
      : await advanceChatbot({ channel: "web", externalId: external_id, selectedOptionId: selected_option_id ?? null });

    if (!turn) {
      return NextResponse.json({ error: "El chatbot todavía no tiene preguntas configuradas." }, { status: 503 });
    }

    return NextResponse.json(turn);
  } catch (err) {
    return NextResponse.json({ error: "No se pudo procesar el mensaje." }, { status: 500 });
  }
}
