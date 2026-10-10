import { SYSTEM_PROMPT } from "./prompt";
import { TOOL_DEFINITIONS, executeTool, newRunState } from "./tools";
import type { AssistantReply, ChatMessage, ToolContext } from "./types";

export const MAX_TOOL_ROUNDS = 4;
export const FALLBACK_REPLY = "I couldn't find reliable information to answer that. You can browse the categories or search the store directly.";

interface OutputItem { type: string; name?: string; arguments?: string; call_id?: string; content?: Array<{ type: string; text?: string }> }
interface ModelResponse { output: OutputItem[]; output_text?: string }

/** The subset of the OpenAI SDK used here, so tests can inject a fake. */
export interface ResponsesClient {
  responses: { create(params: Record<string, unknown>): Promise<ModelResponse> };
}

const MARKER = /\[\[product:([^\]\s]{1,100})\]\]/g;

function textOf(response: ModelResponse): string {
  if (typeof response.output_text === "string") return response.output_text;
  return response.output.filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? []).map((part) => part.text ?? "").join("");
}

export async function runAssistant(client: ResponsesClient, model: string, messages: ChatMessage[], ctx: ToolContext): Promise<AssistantReply> {
  const state = newRunState();
  let input: unknown[] = messages.map((message) => ({ role: message.role, content: message.content }));
  let text = "";

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const response = await client.responses.create({
      // Groq manages no conversation state; send history and omit unsupported store.
      model, instructions: SYSTEM_PROMPT, input, tools: TOOL_DEFINITIONS,
      max_output_tokens: 700, parallel_tool_calls: false, reasoning: { effort: "low" },
      // Final round: force a text answer instead of another tool call.
      tool_choice: round === MAX_TOOL_ROUNDS ? "none" : "auto",
    });
    const calls = response.output.filter((item) => item.type === "function_call");
    if (!calls.length) { text = textOf(response); break; }
    input = [...input, ...response.output];
    for (const call of calls) {
      const output = await executeTool(call.name ?? "", call.arguments ?? "", ctx, state);
      input.push({ type: "function_call_output", call_id: call.call_id, output });
    }
  }

  const referenced: string[] = [];
  const reply = text.replace(MARKER, (_match, id: string) => { referenced.push(id); return ""; })
    .replace(/[ \t]+\n/g, "\n").replace(/ {2,}/g, " ").trim();
  // Cards come from catalog data only; ids the model invents are dropped.
  let ids = [...new Set(referenced)].filter((id) => state.seenProducts.has(id));
  if (!ids.length && !referenced.length) ids = state.lastProductIds.filter((id) => state.seenProducts.has(id)).slice(0, 3);
  return {
    reply: reply || FALLBACK_REPLY,
    products: ids.slice(0, 3).map((id) => state.seenProducts.get(id)!),
    actions: state.actions,
  };
}
