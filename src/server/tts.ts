/**
 * Text-to-speech proxy — POST /api/tts  { text, language? }  →  audio/mpeg
 *
 * language is an ISO code from the Copilot (en/hi/mr). ElevenLabs Flash v2.5
 * voices English and Hindi; other languages (e.g. Marathi) return 415 so the
 * client speaks them with a browser voice instead.
 *
 * Mirrors voice-agejt's ElevenLabs stage (eleven_flash_v2_5, same voice
 * settings) using the HTTP streaming endpoint, which works on any runtime
 * (fetch only, no WebSocket/Node APIs). The upstream audio stream is piped
 * straight through so playback can start before synthesis finishes.
 *
 * ELEVENLABS_API_KEY is read from server env only and never reaches the
 * client. Any failure returns a JSON error, and the client falls back to the
 * browser's speechSynthesis voice.
 */

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1/text-to-speech";
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // "Rachel" — same default as voice-agejt
const DEFAULT_MODEL = "eleven_flash_v2_5";
const MAX_CHARS = 1500;
const TIMEOUT_MS = 12_000;
const ELEVEN_LANGUAGES = new Set(["en", "hi", "ta"]);

function readEnv(env: unknown, name: string): string | null {
  if (typeof env === "object" && env !== null) {
    const bound = (env as Record<string, unknown>)[name];
    if (typeof bound === "string" && bound.trim()) return bound.trim();
  }
  if (typeof process !== "undefined") {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return null;
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export async function handleTtsApi(request: Request, env?: unknown): Promise<Response> {
  if (request.method !== "POST")
    return json({ ok: false, error: "Method not allowed — POST {text}." }, 405);

  const apiKey = readEnv(env, "ELEVENLABS_API_KEY");
  if (!apiKey)
    return json({ ok: false, error: "TTS not configured (ELEVENLABS_API_KEY missing)." }, 503);

  let text = "";
  let language = "en";
  try {
    const body = (await request.json()) as { text?: unknown; language?: unknown };
    text = typeof body.text === "string" ? body.text.trim() : "";
    if (typeof body.language === "string" && /^[a-z]{2}$/.test(body.language))
      language = body.language;
  } catch {
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }
  if (!text) return json({ ok: false, error: "Nothing to speak." }, 400);
  if (!ELEVEN_LANGUAGES.has(language))
    return json(
      {
        ok: false,
        error: `Language "${language}" not supported by ElevenLabs — use the browser voice.`,
      },
      415,
    );
  if (text.length > MAX_CHARS) text = `${text.slice(0, MAX_CHARS).replace(/\s+\S*$/, "")}.`;

  const voiceId = readEnv(env, "ELEVENLABS_VOICE_ID") ?? DEFAULT_VOICE_ID;
  const model = readEnv(env, "ELEVENLABS_MODEL") ?? DEFAULT_MODEL;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  // Stop the upstream request if the browser gives up (barge-in, new question)
  request.signal?.addEventListener("abort", () => controller.abort());

  try {
    const upstream = await fetch(
      `${ELEVENLABS_BASE}/${encodeURIComponent(voiceId)}/stream?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "xi-api-key": apiKey, accept: "audio/mpeg" },
        body: JSON.stringify({
          text,
          model_id: model,
          ...(model.includes("flash_v2_5") || model.includes("turbo_v2_5")
            ? { language_code: language }
            : {}),
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
        signal: controller.signal,
      },
    );
    if (!upstream.ok || !upstream.body) {
      const detail = (await upstream.text().catch(() => "")).slice(0, 300);
      console.error(`[/api/tts] ElevenLabs ${upstream.status}: ${detail}`);
      return json({ ok: false, error: `ElevenLabs ${upstream.status}` }, 502);
    }
    clearTimeout(timer);
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "no-store",
        "x-tts-provider": "elevenlabs",
      },
    });
  } catch (error) {
    clearTimeout(timer);
    const aborted = error instanceof Error && error.name === "AbortError";
    console.error("[/api/tts]", aborted ? "timed out / aborted" : error);
    return json(
      { ok: false, error: aborted ? "ElevenLabs timed out." : "ElevenLabs request failed." },
      aborted ? 504 : 502,
    );
  }
}
