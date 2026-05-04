import { NextResponse } from "next/server";

type VapiToolCall = {
  id?: string;
  toolCallId?: string;
  function?: {
    arguments?: unknown;
  };
};

function parseArguments(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function isAuthorizedVoiceRequest(req: Request) {
  const secret = process.env.VOICE_AGENT_SECRET;
  return Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`;
}

export function voiceUnauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function readVoiceToolBody(req: Request) {
  try {
    return await req.json() as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function getVoiceToolArguments(body: Record<string, unknown>) {
  const directToolCalls = body.toolCalls;
  const message = body.message as { toolCalls?: unknown } | undefined;
  const toolCalls = Array.isArray(directToolCalls)
    ? directToolCalls
    : Array.isArray(message?.toolCalls)
      ? message.toolCalls
      : null;

  if (!toolCalls?.length) return body;

  const toolCall = toolCalls[0] as VapiToolCall;
  return parseArguments(toolCall.function?.arguments);
}

export function voiceToolJson(body: Record<string, unknown>, result: unknown, init?: ResponseInit) {
  const directToolCalls = body.toolCalls;
  const message = body.message as { toolCalls?: unknown } | undefined;
  const toolCalls = Array.isArray(directToolCalls)
    ? directToolCalls
    : Array.isArray(message?.toolCalls)
      ? message.toolCalls
      : null;

  if (!toolCalls?.length) {
    return NextResponse.json(result, init);
  }

  return NextResponse.json({
    results: toolCalls.map((toolCall) => {
      const call = toolCall as VapiToolCall;
      return {
        toolCallId: call.id ?? call.toolCallId,
        result,
      };
    }),
  });
}
