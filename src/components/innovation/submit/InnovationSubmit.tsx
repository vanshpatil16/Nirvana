import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { InnovationShell } from "@/components/innovation/InnovationShell";
import { Chip, DemoNote } from "@/components/innovation/parts";
import {
  DRAFT_STORAGE_KEY,
  TEAM_ROLE_OPTIONS,
  WIZARD_STEPS,
  clearDraft,
  draftCompletion,
  emptyDraft,
  loadDraft,
  saveDraft,
  stepCompletion,
  submitDraft,
  type DraftMember,
  type SubmissionDraft,
  type WizardField,
} from "@/data/innovation";

/** Autosave status text shown in the wizard header. */
type SaveState = "idle" | "saving" | "saved";

/** Render one field of the current step. */
function WizardFieldInput({
  field,
  value,
  onChange,
}: {
  field: WizardField;
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.type === "select") {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
        id={field.name}
      >
        <option value="">Select a deliverable type</option>
        {field.options?.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "textarea") {
    return (
      <textarea
        id={field.name}
        rows={field.rows ?? 4}
        value={value}
        required={field.required}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <input
      id={field.name}
      type="text"
      value={value}
      required={field.required}
      placeholder={field.placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function InnovationSubmit({ challengeId }: { challengeId?: string | undefined }) {
  // Seed the draft from localStorage on the client only; SSR renders the
  // empty wizard so the markup matches on hydration.
  const [draft, setDraft] = useState<SubmissionDraft>(emptyDraft);
  const [members, setMembers] = useState<DraftMember[]>([]);
  const [step, setStep] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ referenceId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Load the saved draft once mounted, then start autosaving.
  useEffect(() => {
    const saved = loadDraft();
    setDraft(saved);
    setMembers(saved.members);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      saveDraft({ ...draft, members });
      setSaveState("saved");
    }, 600);
    return () => window.clearTimeout(timer);
  }, [draft, members, hydrated]);

  const setField = (name: string, value: string) => setDraft((d) => ({ ...d, [name]: value }));

  const addMember = () =>
    setMembers((m) => [
      ...m,
      { name: "", affiliation: "", role: TEAM_ROLE_OPTIONS[0], expertise: "" },
    ]);

  const updateMember = (index: number, patch: Partial<DraftMember>) =>
    setMembers((m) => m.map((member, i) => (i === index ? { ...member, ...patch } : member)));

  const removeMember = (index: number) => setMembers((m) => m.filter((_, i) => i !== index));

  // Team members live in component state but must be part of the draft object
  // for completion maths and submission validation to see them.
  const effectiveDraft = useMemo<SubmissionDraft>(() => ({ ...draft, members }), [draft, members]);
  const overall = draftCompletion(effectiveDraft);
  const active = WIZARD_STEPS[step] ?? WIZARD_STEPS[0]!;

  const goTo = (index: number) => {
    setStep(Math.max(0, Math.min(WIZARD_STEPS.length - 1, index)));
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await submitDraft(effectiveDraft);
      setResult(res);
      clearDraft();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const restart = () => {
    const fresh = emptyDraft();
    setDraft(fresh);
    setMembers([]);
    setResult(null);
    setStep(0);
    setError(null);
  };

  if (result) {
    return (
      <InnovationShell
        query=""
        onQuery={() => {}}
        subNav={[
          { label: "Home", href: "/innovation" },
          { label: "Challenges", href: "/innovation/challenges" },
          { label: "Submit a Solution", href: "/innovation/submit", active: true },
        ]}
      >
        <div className="dashboard-content inno-page">
          <div className="inno-success">
            <CheckCircle2 />
            <h1>Submission received</h1>
            <p>
              Reference <strong>{result.referenceId}</strong>. The innovation team will review your
              submission against the published rubric and respond by email.
            </p>
            <p className="inno-side-note">
              Demo submission — no backend is connected yet, so the reference id was generated
              locally and nothing was stored server-side.
            </p>
            <div className="inno-success-actions">
              <a className="portal-btn-primary" href="/innovation/challenges">
                Browse more challenges
              </a>
              <button className="portal-btn-ghost" onClick={restart}>
                Start another submission
              </button>
            </div>
          </div>
        </div>
      </InnovationShell>
    );
  }

  return (
    <InnovationShell
      query=""
      onQuery={() => {}}
      subNav={[
        { label: "Home", href: "/innovation" },
        { label: "Challenges", href: "/innovation/challenges" },
        { label: "Submit a Solution", href: "/innovation/submit", active: true },
      ]}
    >
      <div className="dashboard-content inno-page" ref={topRef}>
        <header className="inno-page-head">
          <div>
            <span className="portal-eyebrow">Submit a solution</span>
            <h1>Structured solution submission</h1>
            <p>
              Six steps, saved automatically as you type. You can leave and return — the draft is
              kept in this browser. A reviewer reads these answers before they read your code.
            </p>
          </div>
        </header>

        {challengeId && (
          <p className="inno-context-note">
            You are applying to a specific challenge. Go back to{" "}
            <Link
              className="inno-inline-link"
              to="/innovation/challenges/$challengeId"
              params={{ challengeId }}
            >
              read its brief
            </Link>{" "}
            to confirm the eligibility and geography.
          </p>
        )}

        <div className="inno-wizard">
          {/* STEP RAIL + COMPLETION INDICATOR */}
          <aside className="inno-wizard-rail">
            <div className="inno-progress">
              <div className="inno-progress-head">
                <span>Completion</span>
                <strong>{Math.round(overall * 100)}%</strong>
              </div>
              <div
                className="inno-progress-bar"
                role="progressbar"
                aria-valuenow={Math.round(overall * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Submission completion"
              >
                <i style={{ width: `${overall * 100}%` }} />
              </div>
            </div>

            <ol className="inno-steps">
              {WIZARD_STEPS.map((s, i) => {
                const completion = stepCompletion(s, effectiveDraft);
                const state = i === step ? "active" : completion === 1 ? "complete" : "todo";
                const Icon = s.icon;
                return (
                  <li key={s.id} className={state}>
                    <button onClick={() => goTo(i)} aria-current={i === step ? "step" : undefined}>
                      <span className="inno-step-icon">
                        {completion === 1 ? <Check /> : <Icon />}
                      </span>
                      <span className="inno-step-label">
                        <strong>{s.label}</strong>
                        <small>{Math.round(completion * 100)}% filled</small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <p className="inno-save-state" aria-live="polite">
              {saveState === "saving"
                ? "Saving draft…"
                : saveState === "saved"
                  ? "Draft saved in this browser"
                  : " "}
            </p>
          </aside>

          {/* STEP FORM */}
          <section className="inno-wizard-panel">
            <div className="inno-step-head">
              <span className="inno-step-count">
                Step {step + 1} of {WIZARD_STEPS.length}
              </span>
              <h2>{active.title}</h2>
              <p>{active.description}</p>
            </div>

            {active.evidenceReminder && (
              <p className="inno-reminder">
                <AlertTriangle />
                {active.evidenceReminder}
              </p>
            )}

            <div className="inno-fields">
              {active.fields.map((field) => {
                if (field.name === "members") {
                  return (
                    <fieldset key={field.name} className="inno-fieldset">
                      <legend>
                        {field.label}
                        {field.hint && <small>{field.hint}</small>}
                      </legend>
                      {members.length === 0 && (
                        <p className="inno-side-note">No members added yet.</p>
                      )}
                      {members.map((member, i) => (
                        <div key={i} className="inno-member">
                          <input
                            value={member.name}
                            placeholder="Full name"
                            aria-label={`Member ${i + 1} name`}
                            onChange={(e) => updateMember(i, { name: e.target.value })}
                          />
                          <input
                            value={member.affiliation}
                            placeholder="Affiliation"
                            aria-label={`Member ${i + 1} affiliation`}
                            onChange={(e) => updateMember(i, { affiliation: e.target.value })}
                          />
                          <select
                            value={member.role}
                            aria-label={`Member ${i + 1} role`}
                            onChange={(e) => updateMember(i, { role: e.target.value })}
                          >
                            {TEAM_ROLE_OPTIONS.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                          <input
                            value={member.expertise}
                            placeholder="Expertise contributed"
                            aria-label={`Member ${i + 1} expertise`}
                            onChange={(e) => updateMember(i, { expertise: e.target.value })}
                          />
                          <button
                            type="button"
                            onClick={() => removeMember(i)}
                            aria-label={`Remove member ${i + 1}`}
                          >
                            <Trash2 />
                          </button>
                        </div>
                      ))}
                      <button type="button" className="inno-add" onClick={addMember}>
                        <Plus /> Add team member
                      </button>
                    </fieldset>
                  );
                }

                return (
                  <div key={field.name} className="inno-field">
                    <label htmlFor={field.name}>
                      {field.label}
                      {field.required ? <em>required</em> : <em className="optional">optional</em>}
                    </label>
                    {field.hint && <p className="inno-field-hint">{field.hint}</p>}
                    <WizardFieldInput
                      field={field}
                      value={(draft as unknown as Record<string, string>)[field.name] ?? ""}
                      onChange={(v) => setField(field.name, v)}
                    />
                  </div>
                );
              })}
            </div>

            {error && (
              <p className="inno-error" role="alert">
                <AlertTriangle /> {error}
              </p>
            )}

            {/* NAVIGATION */}
            <div className="inno-wizard-actions">
              <button
                className="portal-btn-ghost"
                onClick={() => goTo(step - 1)}
                disabled={step === 0}
              >
                <ArrowLeft /> Back
              </button>
              {step < WIZARD_STEPS.length - 1 ? (
                <button className="portal-btn-primary" onClick={() => goTo(step + 1)}>
                  Next step <ArrowRight />
                </button>
              ) : (
                <button className="portal-btn-primary" onClick={submit} disabled={submitting}>
                  <Send /> {submitting ? "Submitting…" : "Submit solution"}
                </button>
              )}
            </div>

            <DemoNote>
              Drafts are stored in this browser under <code>{DRAFT_STORAGE_KEY}</code>. Nothing is
              sent anywhere until you submit.
            </DemoNote>

            <div className="inno-tags">
              <Chip tone="green">Autosaved</Chip>
              <Chip tone="blue">6 steps</Chip>
              <Chip>Pre-registered KPIs required</Chip>
            </div>
          </section>
        </div>
      </div>
    </InnovationShell>
  );
}
