import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { COMMENT_MAX_LENGTH, NAME_MAX_LENGTH, isValidPhone } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { client_name, client_phone, service_ids, date, time, comment } = body ?? {};

    if (typeof client_name !== "string" || client_name.trim().length < 2 || client_name.length > NAME_MAX_LENGTH) {
      return NextResponse.json({ error: "Nombre inválido." }, { status: 400 });
    }
    if (typeof client_phone !== "string" || !isValidPhone(client_phone)) {
      return NextResponse.json({ error: "Teléfono inválido." }, { status: 400 });
    }
    if (!Array.isArray(service_ids) || service_ids.length === 0 || service_ids.length > 10) {
      return NextResponse.json({ error: "Selecciona al menos un servicio." }, { status: 400 });
    }
    if (typeof date !== "string" || typeof time !== "string") {
      return NextResponse.json({ error: "Fecha u hora inválida." }, { status: 400 });
    }
    if (comment && (typeof comment !== "string" || comment.length > COMMENT_MAX_LENGTH)) {
      return NextResponse.json({ error: `El comentario no puede superar ${COMMENT_MAX_LENGTH} caracteres.` }, { status: 400 });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "desconocida";

    const supabase = createClient();

    const { data, error } = await supabase.rpc("create_public_appointment", {
      p_client_name: client_name.trim(),
      p_client_phone: client_phone.trim(),
      p_service_ids: service_ids,
      p_date: date,
      p_time: time,
      p_comment: comment ?? null,
      p_ip: ip,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ appointment_id: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "No se pudo procesar la solicitud." }, { status: 500 });
  }
}
