import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { handleAiApi } from "./server/ai-agent";
import { handleParcelsApi } from "./server/parcel-store";
import { handleTtsApi } from "./server/tts";
import { handlePolicyExtract } from "./server/policy-extract";
import { handleWeatherApi } from "./server/weather-india";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      // Cadastral bbox API (framework-agnostic, works on the edge runtime).
      const url = new URL(request.url);
      if (url.pathname === "/api/parcels" && request.method === "GET") {
        return handleParcelsApi(request);
      }
      // Live IMD weather proxy (station list / per-station / national summary).
      if (url.pathname.startsWith("/api/weather")) {
        return handleWeatherApi(request);
      }
      // Land-intelligence agent (OpenRouter tool loop; needs OPENROUTER_API_KEY).
      if (url.pathname === "/api/ai") {
        return handleAiApi(request, env);
      }
      // Spoken replies via ElevenLabs (needs ELEVENLABS_API_KEY; client falls back to browser TTS).
      if (url.pathname === "/api/tts") {
        return handleTtsApi(request, env);
      }
      // Policy document reader (Gemini; needs GEMINI_API_KEY). Reads an uploaded
      // PDF into structured, cited policy parameters.
      if (url.pathname === "/api/policy/extract") {
        return handlePolicyExtract(request, env);
      }
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
