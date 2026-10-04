import { ArrowRight, Check } from "lucide-react";
import { useRole } from "@/context/RoleContext";

/** Role picker — one card per persona, each routing into that role's portal. */
export function ChooseRole() {
  const { roleId, roles, switchRole } = useRole();

  return (
    <div className="choose-role">
      <header className="choose-role-head">
        <span className="portal-eyebrow">Role portals</span>
        <h1>Choose how you use NIRVANA</h1>
        <p>
          Six personas, one evidence infrastructure. Pick a role to open its workspace —
          your sidebar, pages and data scope adapt instantly. Switch anytime from your
          profile menu.
        </p>
      </header>

      <ul className="choose-role-grid" aria-label="Available roles">
        {roles.map((r) => {
          const Icon = r.icon;
          const active = r.id === roleId;
          return (
            <li key={r.id}>
              <button type="button" className={`choose-role-card${active ? " active" : ""}`} onClick={() => switchRole(r.id)}>
                <i
                  className="choose-role-icon"
                  style={{
                    background: `color-mix(in oklab, ${r.color} 12%, var(--surface))`,
                    color: r.color,
                  }}
                >
                  <Icon />
                </i>
                <span className="choose-role-body">
                  <b>{r.label}</b>
                  <small>{r.persona}</small>
                  <p>{r.description}</p>
                  <em>{r.mainOutput}</em>
                </span>
                <span className="choose-role-cta">
                  {active ? (
                    <>
                      <Check size={14} /> Current
                    </>
                  ) : (
                    <>
                      Open workspace <ArrowRight size={14} />
                    </>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
