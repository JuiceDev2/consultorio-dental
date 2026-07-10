import { createAdminClient } from "@/lib/supabase/admin";

export type ChatChannel = "web" | "whatsapp";

export interface ChatbotNode {
  id: string;
  body: string;
  is_start: boolean;
  cta_label: string | null;
  cta_url: string | null;
}

export interface ChatbotOption {
  id: string;
  node_id: string;
  label: string;
  next_node_id: string | null;
  sort_order: number;
}

export interface ChatbotTurn {
  node: ChatbotNode;
  options: ChatbotOption[];
}

/**
 * Avanza (o inicia) una conversación de chatbot.
 *
 * - Si no existe sesión para (channel, external_id), la crea y devuelve el nodo de inicio.
 * - Si se manda selected_option_id, mueve la sesión al nodo al que apunta esa opción.
 * - Si no hay selected_option_id y ya existía sesión, devuelve el nodo actual tal cual
 *   (útil para "reabrir" el chat sin perder el lugar donde iba la conversación).
 */
export async function advanceChatbot(params: {
  channel: ChatChannel;
  externalId: string;
  selectedOptionId?: string | null;
}): Promise<ChatbotTurn | null> {
  const { channel, externalId, selectedOptionId } = params;
  const supabase = createAdminClient();

  let { data: session } = await supabase
    .from("chatbot_sessions")
    .select("id, current_node_id")
    .eq("channel", channel)
    .eq("external_id", externalId)
    .maybeSingle();

  let targetNodeId: string | null = null;

  if (selectedOptionId) {
    const { data: option } = await supabase
      .from("chatbot_options")
      .select("next_node_id")
      .eq("id", selectedOptionId)
      .maybeSingle();
    targetNodeId = option?.next_node_id ?? null;
  }

  if (!targetNodeId) {
    targetNodeId = session?.current_node_id ?? null;
  }

  if (!targetNodeId) {
    const { data: startNode } = await supabase
      .from("chatbot_nodes")
      .select("id")
      .eq("is_start", true)
      .maybeSingle();
    targetNodeId = startNode?.id ?? null;
  }

  if (!targetNodeId) return null; // no hay ningún nodo configurado todavía

  if (!session) {
    const { data: created } = await supabase
      .from("chatbot_sessions")
      .insert({ channel, external_id: externalId, current_node_id: targetNodeId })
      .select("id, current_node_id")
      .single();
    session = created;
  } else if (targetNodeId !== session.current_node_id) {
    await supabase.from("chatbot_sessions").update({ current_node_id: targetNodeId, updated_at: new Date().toISOString() }).eq("id", session.id);
  }

  const { data: node } = await supabase.from("chatbot_nodes").select("*").eq("id", targetNodeId).single();
  if (!node) return null;

  const { data: options } = await supabase
    .from("chatbot_options")
    .select("*")
    .eq("node_id", targetNodeId)
    .order("sort_order", { ascending: true });

  if (session) {
    await supabase.from("chatbot_messages").insert({
      session_id: session.id,
      direction: "out",
      body: node.body,
    });
  }

  return { node, options: options ?? [] };
}

/** Resetea una conversación (regresa al nodo de inicio) sin borrar el historial. */
export async function resetChatbot(channel: ChatChannel, externalId: string): Promise<ChatbotTurn | null> {
  const supabase = createAdminClient();
  await supabase.from("chatbot_sessions").delete().eq("channel", channel).eq("external_id", externalId);
  return advanceChatbot({ channel, externalId });
}
