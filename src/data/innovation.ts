/**
 * Innovation Portal datasets.
 *
 * DEMO records for UI development. Every collection lives in ONE place so a
 * backend can replace these exports without touching components. Do not treat
 * values, partners or deadlines as official government data.
 */

export type OpportunityType = "Hackathon" | "Research Grant" | "Pilot Project" | "Knowledge Competition";

export interface Opportunity {
  id: string;
  title: string;
  type: OpportunityType;
  description: string;
  longDescription?: string;
  organization: string;
  department: string;
  tags: string[];
  state: string;
  theme: string;
  eligibility: string;
  prize: string;
  prizeLabel: string;
  deadlineLabel: string;
  deadlineDate: string;
  status: "Open" | "Closing soon" | "Applications open";
  participants: string;
  /** Image URL/path. Empty string renders the elegant placeholder slot. */
  image: string;
  imageSlot: string;
  featured?: boolean;
}

export interface ImpactStat {
  value: string;
  label: string;
  icon: "trophy" | "users" | "file" | "rupee" | "flask" | "check";
}

export interface Deadline {
  date: string;
  title: string;
  opportunity: string;
  opportunityId: string;
}

export interface SuccessStory {
  id: string;
  title: string;
  description: string;
  badge: string;
  image: string;
  imageSlot: string;
}

export interface Partner {
  name: string;
  url: string;
}

/** Single config object for the impact strip — wire to an API later. */
export const IMPACT_STATS: ImpactStat[] = [
  { value: "18", label: "Active Challenges", icon: "trophy" },
  { value: "1,246", label: "Teams Registered", icon: "users" },
  { value: "432", label: "Proposals Submitted", icon: "file" },
  { value: "₹ 8.6 Cr", label: "Total Grants Announced", icon: "rupee" },
  { value: "27", label: "Pilot Projects", icon: "flask" },
  { value: "11", label: "Solutions in Implementation", icon: "check" },
];

export const OPPORTUNITY_TABS = ["All Challenges", "Hackathons", "Research Grants", "Pilot Projects", "Knowledge Competitions"] as const;
export type OpportunityTab = (typeof OPPORTUNITY_TABS)[number];

export const TAB_TYPE_MAP: Record<OpportunityTab, OpportunityType | null> = {
  "All Challenges": null,
  Hackathons: "Hackathon",
  "Research Grants": "Research Grant",
  "Pilot Projects": "Pilot Project",
  "Knowledge Competitions": "Knowledge Competition",
};

export const OPPORTUNITIES: Opportunity[] = [
  {
    id: "ai-illegal-land-use",
    title: "AI for Detecting Illegal Land Use Change",
    type: "Hackathon",
    description: "Build AI models to detect and alert on unauthorized land use conversion using satellite imagery and land records.",
    longDescription:
      "Revenue departments need early warning when agricultural or protected land is converted without permission. Winning approaches combine Sentinel-2 time series, cadastral overlays and explainable change detection, benchmarked against verified field cases from three pilot districts.",
    organization: "Government of India",
    department: "Ministry of Rural Development · Department of Land Resources",
    tags: ["Hackathon", "Remote Sensing", "AI/ML", "Land Governance"],
    state: "Pan-India",
    theme: "Land Governance",
    eligibility: "Students, Startups, Researchers",
    prize: "₹ 50 Lakhs",
    prizeLabel: "Total Prizes",
    deadlineLabel: "3 Months",
    deadlineDate: "15 Oct 2026",
    status: "Open",
    participants: "1,024 teams",
    image: "",
    imageSlot: "Featured Challenge landscape",
    featured: true,
  },
  {
    id: "flood-resilient-planning",
    title: "Flood-Resilient Land Use Planning",
    type: "Hackathon",
    description: "Develop tools for flood risk assessment and resilient land-use planning.",
    organization: "Government of India",
    department: "Department of Land Resources",
    tags: ["Climate Risk", "GIS", "Planning"],
    state: "Assam",
    theme: "Climate Risk",
    eligibility: "Open to all",
    prize: "₹ 20 Lakhs",
    prizeLabel: "Total Prizes",
    deadlineLabel: "45 days left",
    deadlineDate: "08 Nov 2026",
    status: "Open",
    participants: "312 teams",
    image: "",
    imageSlot: "Flood-resilient planning",
  },
  {
    id: "tribal-land-rights",
    title: "Land Rights and Livelihoods in Tribal Areas",
    type: "Research Grant",
    description: "Support interdisciplinary research on land rights, displacement and sustainable livelihoods.",
    organization: "Government of India",
    department: "Ministry of Tribal Affairs",
    tags: ["Tribal Affairs", "Social Impact", "Policy"],
    state: "Chhattisgarh",
    theme: "Social Impact",
    eligibility: "Universities, Researchers",
    prize: "₹ 1.5 Cr",
    prizeLabel: "Total Grants",
    deadlineLabel: "Applications open",
    deadlineDate: "30 Oct 2026",
    status: "Applications open",
    participants: "86 proposals",
    image: "",
    imageSlot: "Tribal land rights",
  },
  {
    id: "community-verification",
    title: "Community-led Land Record Verification",
    type: "Pilot Project",
    description: "Implement and test participatory models for land record verification in selected districts.",
    organization: "Government of India",
    department: "Department of Land Resources",
    tags: ["Civic Tech", "Verification", "Governance"],
    state: "Maharashtra",
    theme: "Governance",
    eligibility: "NGOs, Startups, Collectives",
    prize: "₹ 75 Lakhs",
    prizeLabel: "Pilot Support",
    deadlineLabel: "60 days left",
    deadlineDate: "23 Nov 2026",
    status: "Open",
    participants: "10 selected projects",
    image: "",
    imageSlot: "Community land verification",
  },
  {
    id: "land-restoration-finance",
    title: "Innovative Financing Models for Land Restoration",
    type: "Knowledge Competition",
    description: "Share innovative policy, financial or community models for land restoration and rehabilitation.",
    organization: "Government of India",
    department: "NITI Aayog",
    tags: ["Sustainability", "Finance", "Restoration"],
    state: "Rajasthan",
    theme: "Restoration",
    eligibility: "Open to all",
    prize: "₹ 10 Lakhs",
    prizeLabel: "Awards",
    deadlineLabel: "90 days left",
    deadlineDate: "22 Dec 2026",
    status: "Open",
    participants: "Open to all",
    image: "",
    imageSlot: "Land restoration",
  },
  {
    id: "survey-drone-mapping",
    title: "Low-cost Cadastral Drone Mapping",
    type: "Pilot Project",
    description: "Pilot affordable drone workflows for village cadastral mapping with community validation.",
    organization: "Government of India",
    department: "Survey of India",
    tags: ["Drones", "Survey", "Civic Tech"],
    state: "Karnataka",
    theme: "Survey",
    eligibility: "Startups, Academic labs",
    prize: "₹ 40 Lakhs",
    prizeLabel: "Pilot Support",
    deadlineLabel: "30 days left",
    deadlineDate: "24 Oct 2026",
    status: "Closing soon",
    participants: "48 teams",
    image: "",
    imageSlot: "Cadastral drone mapping",
  },
  {
    id: "revenue-litigation-analytics",
    title: "Revenue Litigation Analytics Challenge",
    type: "Knowledge Competition",
    description: "Analyse anonymised dispute patterns to recommend pendency-reduction reforms.",
    organization: "Government of India",
    department: "Department of Justice",
    tags: ["Disputes", "Analytics", "Policy"],
    state: "Uttar Pradesh",
    theme: "Disputes",
    eligibility: "Researchers, Students",
    prize: "₹ 8 Lakhs",
    prizeLabel: "Awards",
    deadlineLabel: "75 days left",
    deadlineDate: "07 Dec 2026",
    status: "Open",
    participants: "129 teams",
    image: "",
    imageSlot: "Litigation analytics",
  },
];

export const DEADLINES: Deadline[] = [
  { date: "15 Oct 2026", title: "Submission Deadline", opportunity: "AI for Detecting Illegal Land Use Change", opportunityId: "ai-illegal-land-use" },
  { date: "30 Oct 2026", title: "Proposal Submission", opportunity: "Land Rights Research Grant", opportunityId: "tribal-land-rights" },
  { date: "12 Nov 2026", title: "Final Presentation", opportunity: "Sustainable Land Solutions Hackathon", opportunityId: "flood-resilient-planning" },
];

export const SUCCESS_STORIES: SuccessStory[] = [
  {
    id: "drone-encroachment",
    title: "Drone-based Land Mapping for Encroachment Detection",
    description: "A student team solution is now being piloted in 3 districts, helping reduce encroachment cases by 28%.",
    badge: "Implemented",
    image: "",
    imageSlot: "Success Story",
  },
];

export const PARTNERS: Partner[] = [
  { name: "Ministry of Rural Development", url: "#" },
  { name: "Department of Land Resources", url: "#" },
  { name: "IndiaAI", url: "#" },
  { name: "NITI Aayog", url: "#" },
  { name: "World Bank", url: "#" },
  { name: "CSIR", url: "#" },
  { name: "Academic Institutions", url: "#" },
  { name: "Startups & Industry", url: "#" },
];

/** Innovation lifecycle strip (§19): problem → impact. */
export const LIFECYCLE = ["Problem", "Challenge", "Research", "Proposal", "Pilot", "Evidence", "Implementation", "Impact"] as const;

export interface ProposalInput {
  name: string;
  organisation: string;
  email: string;
  proposalType: string;
  title: string;
  description: string;
  stateDistrict: string;
  theme: string;
}

export const PROPOSAL_TYPES = ["New Challenge", "Research Idea", "Pilot Proposal", "Partnership", "Other"] as const;
export const PROPOSAL_THEMES = ["Land Governance", "Climate Risk", "Survey & Mapping", "Disputes", "Social Impact", "Restoration", "Finance", "Civic Tech"] as const;

/**
 * Isolated submission entry point. No backend exists yet: resolves locally
 * after a short delay. Swap the body for a real POST when the API lands.
 */
export async function submitProposal(input: ProposalInput): Promise<{ referenceId: string }> {
  await new Promise((resolve) => setTimeout(resolve, 900));
  if (!input.name.trim() || !input.email.trim() || !input.title.trim()) {
    throw new Error("Name, email and title are required.");
  }
  const referenceId = `BNIP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  return { referenceId };
}

export function getOpportunity(id: string): Opportunity | undefined {
  return OPPORTUNITIES.find((o) => o.id === id);
}
