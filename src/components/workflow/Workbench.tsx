import { useCallback, useEffect, useState } from "react";
import { CapsuleScreen } from "./CapsuleScreen";
import { CopilotScreen } from "./CopilotScreen";
import { CHAPTERS, ROLES, type ChapterId, type Lang, type Role } from "./data";
import { LoopScreen } from "./LoopScreen";
import { ProtectScreen } from "./ProtectScreen";
import { ProveScreen } from "./ProveScreen";
import { SimulateScreen } from "./SimulateScreen";
import { ChapterHead, Footer, Rail, TopBar } from "./ui";
import { VerifyScreen } from "./VerifyScreen";

import "./workflow.css";

const isChapter = (v: string | null): v is ChapterId => !!v && CHAPTERS.some((c) => c.id === v);

export function Workbench() {
  const [chapter, setChapter] = useState<ChapterId>("verify");
  const [lang, setLang] = useState<Lang>("en");
  const [role, setRole] = useState<Role>("officer");
  const [visited, setVisited] = useState<Set<ChapterId>>(() => new Set());
  const [toast, setToast] = useState<string | null>(null);
  // Chapter 5 state lives here so the lock survives navigation
  const [locked, setLocked] = useState(false);

  const go = useCallback(
    (id: ChapterId) => {
      setVisited((v) => new Set(v).add(chapter));
      setChapter(id);
      const owner = CHAPTERS.find((c) => c.id === id)!.role;
      if (role !== owner) {
        setRole(owner);
        setToast(`Viewing as ${ROLES.find((x) => x.id === owner)!.label}`);
      }
      if (typeof window !== "undefined") window.history.replaceState(null, "", `#${id}`);
    },
    [chapter, role],
  );

  // Deep link: /workflow#simulate
  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (isChapter(h)) {
      setChapter(h);
      setRole(CHAPTERS.find((c) => c.id === h)!.role);
    }
  }, []);

  // ← → between chapters (ignored while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable ||
          t.getAttribute("role") === "slider")
      )
        return;
      const i = CHAPTERS.findIndex((c) => c.id === chapter);
      if (e.key === "ArrowRight" && i < CHAPTERS.length - 1) go(CHAPTERS[i + 1]!.id);
      if (e.key === "ArrowLeft" && i > 0) go(CHAPTERS[i - 1]!.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chapter, go]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Choosing a role jumps to that role's first chapter
  const pickRole = (r: Role) => {
    setRole(r);
    const first = CHAPTERS.find((c) => c.role === r);
    if (first && CHAPTERS.find((c) => c.id === chapter)!.role !== r) go(first.id);
  };

  return (
    <div className="wf" lang={lang}>
      <TopBar lang={lang} onLang={setLang} role={role} onRole={pickRole} />
      <Rail current={chapter} onGo={go} lang={lang} visited={visited} />

      <main className="wf-main">
        <div className="wf-chapter" key={chapter}>
          {chapter === "verify" && (
            <VerifyScreen head={<ChapterHead id="verify" lang={lang} />} onNext={() => go("ask")} />
          )}
          {chapter === "ask" && (
            <CopilotScreen
              head={<ChapterHead id="ask" lang={lang} />}
              lang={lang}
              onNext={() => go("protect")}
            />
          )}
          {chapter === "protect" && (
            <ProtectScreen head={<ChapterHead id="protect" lang={lang} />} />
          )}
          {chapter === "simulate" && (
            <SimulateScreen
              head={<ChapterHead id="simulate" lang={lang} />}
              onNext={() => go("prove")}
            />
          )}
          {chapter === "prove" && (
            <ProveScreen
              head={<ChapterHead id="prove" lang={lang} />}
              locked={locked}
              onLock={() => setLocked(true)}
              onUnlockDemo={() => setLocked(false)}
              onCapsule={() => go("capsule")}
            />
          )}
          {chapter === "capsule" && (
            <CapsuleScreen
              head={<ChapterHead id="capsule" lang={lang} />}
              onNext={() => go("loop")}
            />
          )}
          {chapter === "loop" && (
            <LoopScreen
              head={<ChapterHead id="loop" lang={lang} />}
              lang={lang}
              onRestart={() => go("verify")}
              onGo={go}
            />
          )}
        </div>
      </main>

      {toast && <div className="wf-toast">{toast}</div>}
      <Footer />
    </div>
  );
}
