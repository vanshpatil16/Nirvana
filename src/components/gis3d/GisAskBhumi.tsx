import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { CopilotAnswer } from "@/components/home/CopilotAnswer";
import type { CopilotMeta } from "@/components/home/CopilotBlocks";
import type { ActionChip, MapAction } from "@/copilot/actions";

interface Reply {
  summary: string;
  framework: string[];
  riskAssessment: string;
  limitation: string;
  evidenceBreakdown?: { section: string; detail: string }[] | undefined;
  copilot?: CopilotMeta | undefined;
}

interface Turn {
  id: number;
  role: "user" | "assistant";
  text?: string;
  reply?: Reply;
  error?: string;
}

export interface AskContext {
  selection: string;
  activeLayers: string[];
  bbox: [number, number, number, number] | null;
  rangeMeters: number | null;
  year: number;
  terrain: string;
  region: string;
  /** Active native building rendering mode. */
  visualMode: string;
  /** `enhanced demo` only while the Patna floor stack is on screen. */
  gisMode: "standard" | "enhanced-demo";
}

interface Props {
  context: AskContext;
  onFlyTo: (place: string, lat: number | null, lon: number | null, zoom: number | null) => void;
}

function composePrompt(question: string, ctx: AskContext): string {
  const bits = [
    "You are answering inside NIRVANA's 3D GIS Explorer (Cesium globe over India).",
    `Current view: camera bbox [${ctx.bbox?.map((v) => v.toFixed(3)).join(", ") ?? "national"}]`,
    ctx.rangeMeters !== null ? `approx. range ${Math.round(ctx.rangeMeters / 1000)} km` : "",
    `imagery year ${ctx.year}`,
    `terrain provider: ${ctx.terrain}`,
    `active layers: ${ctx.activeLayers.length ? ctx.activeLayers.join(", ") : "none"}`,
    `selected feature: ${ctx.selection}`,
    `globe mode: ${ctx.gisMode}${ctx.gisMode === "enhanced-demo" ? " (Patna floor-stack demo fixture)" : ""}`,
    `building rendering mode: ${ctx.visualMode}`,
    `scenario region: ${ctx.region}`,
    "Only state facts you can source; when something is a demo aggregate or a modelled value, say so explicitly. Never invent coordinates or statistics.",
  ].filter(Boolean);
  return `${bits.join("\n")}\n\nQuestion: ${question}`;
}

export function GisAskBhumi({ context, onFlyTo }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns, busy]);

  const send = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    const myId = ++seq.current;
    const history = turns
      .slice(-8)
      .map((t) => ({ role: t.role, content: t.text ?? t.reply?.summary ?? "" }));
    setTurns((prev) => [...prev, { id: myId, role: "user", text }]);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: composePrompt(text, context), history, context: null }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        reply?: {
          summary?: string;
          framework?: string[];
          riskAssessment?: string;
          limitation?: string;
          evidenceBreakdown?: { section: string; detail: string }[];
        };
        copilot?: CopilotMeta;
        language?: string;
      };
      const reply = data.reply;
      if (!res.ok || data.ok === false || !reply) {
        setTurns((prev) => [
          ...prev,
          {
            id: ++seq.current,
            role: "assistant",
            error: data.error ?? `Ask Bhumi did not answer (HTTP ${res.status}).`,
          },
        ]);
        return;
      }
      setTurns((prev) => [
        ...prev,
        {
          id: ++seq.current,
          role: "assistant",
          reply: {
            summary: reply.summary ?? "",
            framework: reply.framework ?? [],
            riskAssessment: reply.riskAssessment ?? "",
            limitation: reply.limitation ?? "",
            evidenceBreakdown: reply.evidenceBreakdown,
            copilot: data.copilot,
          },
        },
      ]);
    } catch {
      setTurns((prev) => [
        ...prev,
        {
          id: ++seq.current,
          role: "assistant",
          error: "Network error — Ask Bhumi could not reach the agent endpoint.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const onChip = (chip: ActionChip) => {
    if (chip.kind === "prompt" && chip.prompt) void send(chip.prompt);
    else if (chip.kind === "action" && chip.action) applyAction(chip.action);
    else if (chip.kind === "link" && chip.href) window.location.assign(chip.href);
  };

  const applyAction = (action: MapAction) => {
    if (action.type === "fly_to") {
      onFlyTo(action.place, action.lat, action.lon, action.zoom);
      setTurns((prev) => [
        ...prev,
        { id: ++seq.current, role: "assistant", text: `Camera moved to ${action.place}.` },
      ]);
      return;
    }
    setTurns((prev) => [
      ...prev,
      {
        id: ++seq.current,
        role: "assistant",
        text: `The agent suggested “${action.type}”, but that tool targets the 2D map routes. Use the layer manager on the left to switch the matching layer on here.`,
      },
    ]);
  };

  return (
    <div className="g3d-chat">
      <div className="g3d-context">
        <span>Year {context.year}</span>
        <span>{context.activeLayers.length} layers on</span>
        <span>{context.terrain === "real" ? "Real terrain" : "Ellipsoid (no relief)"}</span>
        <span>{context.selection}</span>
      </div>

      {turns.length === 0 && (
        <div className="g3d-empty">
          <strong>Ask Bhumi about this view</strong>
          The question is sent with the live camera bounding box, active layers and selection, so
          the agent answers about what is actually on screen. Answers reuse the app's existing
          evidence pipeline — this is not a second chatbot.
        </div>
      )}

      {turns.map((t) =>
        t.role === "user" ? (
          <div className="g3d-msg user" key={t.id}>
            {t.text}
          </div>
        ) : t.error ? (
          <div className="g3d-msg bot" key={t.id}>
            {t.error}
            <span className="g3d-msg-sub">
              Set OPENROUTER_API_KEY on the server to enable the agent.
            </span>
          </div>
        ) : t.reply?.copilot ? (
          <div className="g3d-msg bot" key={t.id}>
            <CopilotAnswer
              summary={t.reply.summary}
              riskAssessment={t.reply.riskAssessment}
              framework={t.reply.framework}
              limitation={t.reply.limitation}
              evidenceBreakdown={t.reply.evidenceBreakdown}
              meta={t.reply.copilot}
              onChip={onChip}
            />
          </div>
        ) : (
          <div className="g3d-msg bot" key={t.id}>
            {t.reply?.summary}
            {t.reply?.riskAssessment?.trim() && (
              <span className="g3d-msg-sub">Risk: {t.reply.riskAssessment}</span>
            )}
            {t.reply?.limitation && (
              <span className="g3d-msg-sub">Limitation: {t.reply.limitation}</span>
            )}
          </div>
        ),
      )}

      {busy && <div className="g3d-msg bot">Analysing the current view…</div>}
      <div ref={endRef} />

      <form
        className="g3d-chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this view…"
          aria-label="Ask Bhumi"
        />
        <button type="submit" disabled={busy || !input.trim()}>
          <Send style={{ width: 13, height: 13 }} />
        </button>
      </form>
    </div>
  );
}
