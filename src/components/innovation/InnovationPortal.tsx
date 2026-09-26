import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Award,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Command,
  FileText,
  FlaskConical,
  Image as ImageIcon,
  IndianRupee,
  Lightbulb,
  MapPin,
  Menu,
  Moon,
  Search,
  Trophy,
  Upload,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { navItems } from "@/data/dashboard";
import {
  DEADLINES,
  IMPACT_STATS,
  LIFECYCLE,
  OPPORTUNITIES,
  OPPORTUNITY_TABS,
  PARTNERS,
  PROPOSAL_THEMES,
  PROPOSAL_TYPES,
  SUCCESS_STORIES,
  TAB_TYPE_MAP,
  getOpportunity,
  submitProposal,
  type Opportunity,
  type OpportunityTab,
  type ProposalInput,
} from "@/data/innovation";
import logo from "@/assets/logo.png";
import sidenavBottom from "@/assets/sidenav-bottom.png";
import innovationLandscape from "@/assets/innovation-landscape.png";
import featuredChallenge from "@/assets/featured_challenge.png";
import { ProfileMenu } from "@/components/ProfileMenu";

const ACTIVE_ITEM = "Innovation Portal";
const GRID_INITIAL = 4;

const STAT_ICONS = {
  trophy: Trophy,
  users: Users,
  file: FileText,
  rupee: IndianRupee,
  flask: FlaskConical,
  check: CheckCircle2,
} as const;

function Shell({ drawer, close, children }: { drawer: boolean; close: () => void; children: React.ReactNode }) {
  return (
    <>
      <aside className={`sidebar ${drawer ? "open" : ""}`}>
        <div className="sidebar-top">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <img src={logo} alt="BHUMI-NITI Logo" width={38} height={38} />
            </span>
            <div>
              <strong>BHUMI-NITI</strong>
              <b>भूमि-नीति</b>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="sidebar-close" onClick={close} aria-label="Close navigation">
            <X />
          </Button>
          <p>National Platform for Research & Policy Innovation in Land Governance</p>
        </div>
        <nav aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon, href }) => {
            const isActive = label === ACTIVE_ITEM;
            if (href) {
              return (
                <a key={label} href={href} className={isActive ? "active" : ""} aria-current={isActive ? "page" : undefined}>
                  <Icon />
                  <span>{label}</span>
                </a>
              );
            }
            return (
              <button key={label} className={isActive ? "active" : ""} aria-current={isActive ? "page" : undefined} title={`${label} — coming soon`}>
                <Icon />
                <span>{label}</span>
                <i>Soon</i>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <img
            src={sidenavBottom}
            alt="Same Land, More Clarity, Better Decisions — Government of India, Ministry of Rural Development, Department of Land Resources"
          />
        </div>
      </aside>
      {drawer && <button className="drawer-backdrop" onClick={close} aria-label="Close navigation" />}
      {children}
    </>
  );
}

function PageHeader({ openMenu, query, onQuery }: { openMenu: () => void; query: string; onQuery: (v: string) => void }) {
  return (
    <header className="top-header">
      <Button variant="ghost" size="icon" className="menu-button" onClick={openMenu} aria-label="Open navigation">
        <Menu />
      </Button>
      <label className="global-search">
        <Search />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search challenges, grants, projects, institutions, keywords..."
          aria-label="Search the innovation portal"
        />
        <kbd>
          <Command /> K
        </kbd>
      </label>
      <div className="header-tools">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Theme settings">
              <Moon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Light appearance</TooltipContent>
        </Tooltip>
        <button className="lang">
          EN <ChevronDown />
        </button>
        <Button variant="ghost" size="icon" className="notification" aria-label="Notifications">
          <Bell />
          <i />
        </Button>
        <ProfileMenu />
      </div>
    </header>
  );
}

/** Elegant placeholder slot; renders a real <img> when `image` is provided. */
function ImageSlot({ label, ratio = "16 / 9", image, alt }: { label: string; ratio?: string; image: string; alt: string }) {
  if (image) {
    return <img src={image} alt={alt} className="portal-img" style={{ aspectRatio: ratio }} loading="lazy" />;
  }
  const ratioLabel = `(${ratio.replace(/\s*\/\s*/, ":")})`;
  return (
    <div className="img-slot" style={{ aspectRatio: ratio }} role="img" aria-label={`${label} — image placeholder`}>
      <ImageIcon aria-hidden="true" />
      <span>IMAGE PLACEHOLDER</span>
      <small>
        {label} · {ratioLabel}
      </small>
    </div>
  );
}

const EMPTY_FORM: ProposalInput = {
  name: "",
  organisation: "",
  email: "",
  proposalType: "New Challenge",
  title: "",
  description: "",
  stateDistrict: "",
  theme: "Land Governance",
};

function ProposalModal({ initialTitle, onClose }: { initialTitle: string | undefined; onClose: () => void }) {
  const [form, setForm] = useState<ProposalInput>({ ...EMPTY_FORM, title: initialTitle ?? "" });
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof ProposalInput) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    try {
      const result = await submitProposal(form);
      setReferenceId(result.referenceId);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed. Please try again.");
      setStatus("error");
    }
  };

  return (
    <div className="portal-overlay" role="dialog" aria-modal="true" aria-label="Submit your proposal" onClick={onClose}>
      <div className="portal-modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <span>INNOVATION PORTAL</span>
            <h3>Submit Your Proposal</h3>
          </div>
          <button onClick={onClose} aria-label="Close proposal form">
            <X />
          </button>
        </header>
        {status === "done" ? (
          <div className="portal-success">
            <CheckCircle2 />
            <h4>Proposal received</h4>
            <p>
              Reference ID <strong>{referenceId}</strong>. The innovation team will review your submission and respond by
              email. Demo submission — no backend connected yet.
            </p>
            <button className="portal-btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="portal-form-grid">
              <label>
                Name<input value={form.name} onChange={set("name")} placeholder="Full name" required />
              </label>
              <label>
                Organisation<input value={form.organisation} onChange={set("organisation")} placeholder="Institution / startup" />
              </label>
              <label>
                Email<input type="email" value={form.email} onChange={set("email")} placeholder="you@example.org" required />
              </label>
              <label>
                Proposal Type
                <select value={form.proposalType} onChange={set("proposalType")}>
                  {PROPOSAL_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="span-2">
                Title<input value={form.title} onChange={set("title")} placeholder="Proposal title" required />
              </label>
              <label className="span-2">
                Description<textarea value={form.description} onChange={set("description")} rows={4} placeholder="What problem does it solve, and how?" />
              </label>
              <label>
                State / District<input value={form.stateDistrict} onChange={set("stateDistrict")} placeholder="e.g. Maharashtra / Pune" />
              </label>
              <label>
                Theme
                <select value={form.theme} onChange={set("theme")}>
                  {PROPOSAL_THEMES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="span-2">
                Supporting Document
                <span className="portal-file">
                  <Upload />
                  {fileName ?? "Choose file (PDF, up to 10 MB)"}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                    aria-label="Supporting document upload"
                  />
                </span>
              </label>
            </div>
            {status === "error" && error && (
              <p className="portal-error" role="alert">
                {error}
              </p>
            )}
            <div className="portal-modal-actions">
              <button type="button" className="portal-btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="portal-btn-primary" disabled={status === "sending"}>
                {status === "sending" ? "Submitting…" : "Submit Proposal"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function ChallengeModal({ challenge, onClose, onApply }: { challenge: Opportunity; onClose: () => void; onApply: (title: string) => void }) {
  return (
    <div className="portal-overlay" role="dialog" aria-modal="true" aria-label={challenge.title} onClick={onClose}>
      <div className="portal-modal wide" onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <span>{challenge.type.toUpperCase()}</span>
            <h3>{challenge.title}</h3>
          </div>
          <button onClick={onClose} aria-label="Close challenge details">
            <X />
          </button>
        </header>
        <ImageSlot label={challenge.imageSlot} image={challenge.image || (challenge.featured ? featuredChallenge : "")} alt={challenge.title} />
        <div className="portal-tags">
          {challenge.tags.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <p className="portal-lead">{challenge.description}</p>
        {challenge.longDescription && <p className="portal-body">{challenge.longDescription}</p>}
        <div className="portal-gov">
          <strong>{challenge.organization}</strong>
          <small>{challenge.department}</small>
        </div>
        <dl className="portal-facts">
          {[
            [challenge.prize, challenge.prizeLabel],
            [challenge.deadlineDate, challenge.status === "Open" ? "Submission Deadline" : challenge.status],
            [challenge.eligibility, "Open to"],
            [challenge.state, "Geography"],
            [challenge.theme, "Theme"],
            [challenge.participants, "Participation"],
          ].map(([v, k]) => (
            <div key={k as string}>
              <dt>{v as string}</dt>
              <dd>{k as string}</dd>
            </div>
          ))}
        </dl>
        <div className="portal-modal-actions">
          <button type="button" className="portal-btn-ghost" onClick={onClose}>
            Close
          </button>
          <button type="button" className="portal-btn-primary" onClick={() => onApply(challenge.title)}>
            Apply for this Challenge <ArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
}

function OpportunityCard({ opportunity, onOpen }: { opportunity: Opportunity; onOpen: (id: string) => void }) {
  return (
    <article className="portal-card">
      <div className="portal-card-media">
        <ImageSlot label={opportunity.imageSlot} image={opportunity.image} alt={opportunity.title} />
        <span className="portal-badge">{opportunity.type}</span>
      </div>
      <div className="portal-card-body">
        <h3>{opportunity.title}</h3>
        <p>{opportunity.description}</p>
        <div className="portal-tags small">
          {opportunity.tags.slice(0, 3).map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <footer>
          <span>
            <Clock /> {opportunity.deadlineLabel}
          </span>
          <span>
            <Users /> {opportunity.participants}
          </span>
        </footer>
        <button className="portal-card-link" onClick={() => onOpen(opportunity.id)}>
          View Challenge <ArrowRight />
        </button>
      </div>
    </article>
  );
}

export function InnovationPortal({
  deepLinkId,
  onDeepLinkChange,
}: {
  deepLinkId: string | undefined;
  onDeepLinkChange?: (id: string | null) => void;
}) {
  const [drawer, setDrawer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [headerQuery, setHeaderQuery] = useState("");
  const [tab, setTab] = useState<OpportunityTab>("All Challenges");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [stateFilter, setStateFilter] = useState("All States");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [showAll, setShowAll] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(deepLinkId ?? null);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [proposalTitle, setProposalTitle] = useState<string | undefined>(undefined);
  const [howItWorks, setHowItWorks] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [storiesOpen, setStoriesOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 450);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (deepLinkId) setSelectedId(deepLinkId);
  }, [deepLinkId]);

  const openChallenge = (id: string) => {
    setSelectedId(id);
    onDeepLinkChange?.(id);
  };
  const closeChallenge = () => {
    setSelectedId(null);
    onDeepLinkChange?.(null);
  };
  const openProposal = (title?: string) => {
    setProposalTitle(title);
    setProposalOpen(true);
  };

  const featured = OPPORTUNITIES.find((o) => o.featured);
  const themes = useMemo(() => ["All Categories", ...Array.from(new Set(OPPORTUNITIES.map((o) => o.theme)))], []);
  const states = useMemo(() => ["All States", ...Array.from(new Set(OPPORTUNITIES.map((o) => o.state)))], []);
  const statuses = useMemo(() => ["All Statuses", ...Array.from(new Set(OPPORTUNITIES.map((o) => o.status)))], []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return OPPORTUNITIES.filter((o) => {
      if (o.featured) return false;
      if (TAB_TYPE_MAP[tab] && o.type !== TAB_TYPE_MAP[tab]) return false;
      if (category !== "All Categories" && o.theme !== category) return false;
      if (stateFilter !== "All States" && o.state !== stateFilter) return false;
      if (statusFilter !== "All Statuses" && o.status !== statusFilter) return false;
      if (headerQuery.trim()) {
        const hq = headerQuery.trim().toLowerCase();
        const hay = `${o.title} ${o.description} ${o.organization} ${o.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(hq)) return false;
      }
      if (!q) return true;
      const hay = `${o.title} ${o.description} ${o.organization} ${o.tags.join(" ")} ${o.state}`.toLowerCase();
      return hay.includes(q);
    });
  }, [tab, search, category, stateFilter, statusFilter, headerQuery]);

  const visible = showAll ? filtered : filtered.slice(0, GRID_INITIAL);
  const selected = selectedId ? getOpportunity(selectedId) : undefined;

  return (
    <TooltipProvider>
      <div className="dashboard-shell">
        <Shell drawer={drawer} close={() => setDrawer(false)}>
          <main>
            <PageHeader openMenu={() => setDrawer(true)} query={headerQuery} onQuery={setHeaderQuery} />
            <div className="dashboard-content portal-page">
              {/* HERO */}
              <section
                className="portal-hero"
                style={{ backgroundImage: `url(${innovationLandscape})` }}
                aria-label="Innovation Portal introduction"
              >
                <div className="portal-hero-copy">
                  <span className="portal-eyebrow">
                    <Award /> Innovation Portal
                  </span>
                  <h1>People, Ideas, Real Impact.</h1>
                  <p>Hackathons, research grants, pilot projects and knowledge competitions for evidence-based land governance.</p>
                  <div className="portal-hero-ctas">
                    <a className="portal-btn-primary" href="#opportunities">
                      Explore Challenges <ArrowRight />
                    </a>
                    <button className="portal-btn-ghost" onClick={() => setHowItWorks(true)}>
                      How It Works
                    </button>
                  </div>
                </div>
              </section>

              {/* IMPACT STRIP */}
              <section className="portal-stats" aria-label="Innovation impact statistics">
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="portal-stat skeleton" aria-hidden="true" />)
                  : IMPACT_STATS.map((s) => {
                      const Icon = STAT_ICONS[s.icon];
                      return (
                        <div key={s.label} className="portal-stat">
                          <span>
                            <Icon />
                          </span>
                          <div>
                            <strong>{s.value}</strong>
                            <small>{s.label}</small>
                          </div>
                        </div>
                      );
                    })}
              </section>

              {/* FEATURED — single wide horizontal banner */}
              {featured && tab === "All Challenges" && !search.trim() && (
                <article className="portal-featured">
                  <div className="portal-featured-body">
                    <span className="portal-featured-eyebrow">Featured Challenge</span>
                    <h2>{featured.title}</h2>
                    <p>{featured.description}</p>
                    <div className="portal-tags">
                      {featured.tags.map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                    </div>
                    <div className="portal-featured-foot">
                      <div className="portal-facts-inline">
                        <div>
                          <strong>{featured.prize}</strong>
                          <small>{featured.prizeLabel}</small>
                        </div>
                        <div>
                          <strong>{featured.deadlineDate}</strong>
                          <small>Submission Deadline</small>
                        </div>
                        <div>
                          <strong>Open to</strong>
                          <small>{featured.eligibility}</small>
                        </div>
                      </div>
                      <button className="portal-btn-primary" onClick={() => openChallenge(featured.id)}>
                        View Challenge <ArrowRight />
                      </button>
                    </div>
                  </div>
                  <div className="portal-featured-media">
                    <ImageSlot label={featured.imageSlot} ratio="16 / 9" image={featured.image || featuredChallenge} alt={featured.title} />
                  </div>
                </article>
              )}

              <div className="portal-columns">
              <div className="portal-main">
                  {/* TABS + FILTERS */}
                  <div id="opportunities" className="portal-tabs" role="tablist" aria-label="Opportunity types">
                    {OPPORTUNITY_TABS.map((t) => (
                      <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="portal-filters">
                    <label className="portal-search">
                      <Search />
                      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search challenges..." aria-label="Search challenges" />
                    </label>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
                      {themes.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                    <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} aria-label="Filter by state">
                      {states.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
                      {statuses.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  {/* ONGOING GRID */}
                  <div className="portal-section-head">
                    <h2>Ongoing Challenges</h2>
                    {filtered.length > GRID_INITIAL && (
                      <button onClick={() => setShowAll((v) => !v)}>
                        {showAll ? "Show less" : `View All (${filtered.length}) →`}
                      </button>
                    )}
                  </div>
                  {loading ? (
                    <div className="portal-grid">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="portal-card skeleton" aria-hidden="true" />
                      ))}
                    </div>
                  ) : visible.length > 0 ? (
                    <>
                      <div className="portal-grid">
                        {visible.map((o) => (
                          <OpportunityCard key={o.id} opportunity={o} onOpen={openChallenge} />
                        ))}
                      </div>
                      <p className="portal-count">
                        Showing {visible.length} of {filtered.length} opportunities
                      </p>
                    </>
                  ) : (
                    <div className="portal-empty" role="status">
                      <Search />
                      <h3>No challenges match your filters</h3>
                      <p>Try a different keyword, category or state.</p>
                      <button
                        className="portal-btn-ghost"
                        onClick={() => {
                          setSearch("");
                          setHeaderQuery("");
                          setCategory("All Categories");
                          setStateFilter("All States");
                          setStatusFilter("All Statuses");
                          setTab("All Challenges");
                        }}
                      >
                        Reset filters
                      </button>
                    </div>
                  )}

                  {/* PARTNERS */}
                  <div className="portal-section-head">
                    <h2>Our Partners</h2>
                  </div>
                  <p className="portal-demo-note">Placeholder entries for development — not confirmed partnerships.</p>
                  <div className="portal-partners">
                    {PARTNERS.map((p) => (
                      <a key={p.name} href={p.url} className="portal-partner" title={p.name}>
                        <span aria-hidden="true">{p.name.charAt(0)}</span>
                        <small>{p.name}</small>
                      </a>
                    ))}
                  </div>
                </div>

                {/* RIGHT RAIL — deadlines, stories, idea, geography */}
                <aside className="portal-side">
                  <section className="portal-panel" aria-label="Upcoming deadlines">
                    <header>
                      <h3>Upcoming Deadlines</h3>
                      <button onClick={() => setCalendarOpen(true)}>View Calendar →</button>
                    </header>
                    <ul className="portal-deadlines">
                      {DEADLINES.map((d) => (
                        <li key={d.date}>
                          <button onClick={() => openChallenge(d.opportunityId)}>
                            <span className="portal-date">
                              <CalendarDays />
                              {d.date}
                            </span>
                            <strong>{d.title}</strong>
                            <small>{d.opportunity}</small>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="portal-panel" aria-label="Success stories">
                    <header>
                      <h3>Success Stories</h3>
                      <button onClick={() => setStoriesOpen(true)}>View All →</button>
                    </header>
                    {SUCCESS_STORIES.map((s) => (
                      <article key={s.id} className="portal-story">
                        <ImageSlot label={s.imageSlot} image={s.image} alt={s.title} />
                        <span className="portal-badge">{s.badge}</span>
                        <h4>{s.title}</h4>
                        <p>{s.description}</p>
                      </article>
                    ))}
                  </section>

                  <section className="portal-panel idea" aria-label="Have an idea">
                    <Lightbulb />
                    <h3>Have an Idea?</h3>
                    <p>Propose a new challenge or get in touch with the innovation team.</p>
                    <button className="portal-btn-primary" onClick={() => openProposal()}>
                      Submit Your Proposal <ArrowRight />
                    </button>
                  </section>

                  <section className="portal-panel" aria-label="Find on map">
                    <header>
                      <h3>Geography</h3>
                    </header>
                    <p className="portal-side-note">
                      <MapPin /> Filter opportunities by state to see what is open in your region.
                    </p>
                    <select
                      className="portal-geo-select"
                      value={stateFilter}
                      onChange={(e) => setStateFilter(e.target.value)}
                      aria-label="Filter opportunities by state"
                    >
                      {states.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </section>
                </aside>
              </div>
            </div>
          </main>
        </Shell>
      </div>

      {selected && (
        <ChallengeModal
          challenge={selected}
          onClose={closeChallenge}
          onApply={(title) => {
            closeChallenge();
            openProposal(title);
          }}
        />
      )}
      {proposalOpen && (
        <ProposalModal
          initialTitle={proposalTitle}
          onClose={() => {
            setProposalOpen(false);
            setProposalTitle(undefined);
          }}
        />
      )}
      {calendarOpen && (
        <div className="portal-overlay" role="dialog" aria-modal="true" aria-label="Deadline calendar" onClick={() => setCalendarOpen(false)}>
          <div className="portal-modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <div>
                <span>UPCOMING DEADLINES</span>
                <h3>Calendar</h3>
              </div>
              <button onClick={() => setCalendarOpen(false)} aria-label="Close">
                <X />
              </button>
            </header>
            <ul className="portal-deadlines">
              {DEADLINES.map((d) => (
                <li key={d.date}>
                  <button
                    onClick={() => {
                      setCalendarOpen(false);
                      openChallenge(d.opportunityId);
                    }}
                  >
                    <span className="portal-date">
                      <CalendarDays />
                      {d.date}
                    </span>
                    <strong>{d.title}</strong>
                    <small>{d.opportunity}</small>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {storiesOpen && (
        <div className="portal-overlay" role="dialog" aria-modal="true" aria-label="Success stories" onClick={() => setStoriesOpen(false)}>
          <div className="portal-modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <div>
                <span>FROM PILOTS TO IMPACT</span>
                <h3>Success Stories</h3>
              </div>
              <button onClick={() => setStoriesOpen(false)} aria-label="Close">
                <X />
              </button>
            </header>
            {SUCCESS_STORIES.map((s) => (
              <article key={s.id} className="portal-story">
                <ImageSlot label={s.imageSlot} image={s.image} alt={s.title} />
                <span className="portal-badge">{s.badge}</span>
                <h4>{s.title}</h4>
                <p>{s.description}</p>
              </article>
            ))}
          </div>
        </div>
      )}
      {howItWorks && (
        <div className="portal-overlay" role="dialog" aria-modal="true" aria-label="How it works" onClick={() => setHowItWorks(false)}>
          <div className="portal-modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <div>
                <span>INNOVATION PORTAL</span>
                <h3>How It Works</h3>
              </div>
              <button onClick={() => setHowItWorks(false)} aria-label="Close">
                <X />
              </button>
            </header>
            <ol className="portal-steps">
              {LIFECYCLE.map((step, i) => (
                <li key={step}>
                  <strong>{i + 1}</strong>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="portal-body">
              Problems become challenges. Teams respond with research and prototypes. The strongest ideas earn pilot support, generate
              evidence, and move into implementation with government partners.
            </p>
          </div>
        </div>
      )}
    </TooltipProvider>
  );
}
