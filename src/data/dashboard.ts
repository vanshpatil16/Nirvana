import {
  AlertTriangle,
  BarChart3,
  Beaker,
  BookOpen,
  Building2,
  Database,
  FlaskConical,
  Layers,
  Leaf,
  Map,
  MapPinned,
  Network,
  Scale,
  Sprout,
  Users,
} from "lucide-react";

export const navItems = [
  { label: "Dashboard", icon: BarChart3, href: "/dashboard" },
  { label: "GIS Explorer", icon: Map, href: "/gis-explorer" },
  { label: "Record vs Reality", icon: MapPinned, href: "/record-vs-reality" },
  { label: "Land Difference", icon: Layers, href: "/landdifference" },
  { label: "Disputes & Conflicts", icon: Scale },
  { label: "Policy Lab", icon: FlaskConical },
  { label: "Research Hub", icon: BookOpen, href: "/research-hub" },
  { label: "AI Research Copilot", icon: Beaker },
  { label: "Innovation Portal", icon: Sprout, href: "/innovation-portal" },
  { label: "Collaborative Workspaces", icon: Users },
  { label: "Data & APIs", icon: Database },
  { label: "Impact & Monitoring", icon: Network },
];

export const kpis = [
  { value: "684,832", label: "Villages Mapped", trend: "↑ 2.4%", tone: "sage", icon: Building2 },
  { value: "421,309", label: "Land-Use Changes", trend: "↑ 12.6%", tone: "violet", icon: MapPinned },
  { value: "14,203", label: "Active Land Disputes", trend: "↓ 8.1%", tone: "terra", icon: AlertTriangle },
  { value: "231", label: "High-Risk Districts", trend: "↑ 9.3%", tone: "leaf", icon: Leaf },
] as const;

export const mapLayers = [
  { id: "land", label: "Land Use / Land Cover", color: "map-land", default: true },
  { id: "agriculture", label: "Agriculture", color: "map-farm", default: true },
  { id: "forest", label: "Forest", color: "map-forest", default: true },
  { id: "water", label: "Water", color: "map-water", default: true },
  { id: "policy", label: "Policy Zones", color: "map-policy", default: false },
  { id: "disputes", label: "Disputes", color: "map-dispute", default: false },
  { id: "climate", label: "Climate Risk", color: "map-risk", default: false },
  { id: "socio", label: "Socio-Economic Data", color: "map-info", default: false },
  { id: "infrastructure", label: "Infrastructure", color: "map-infra", default: false },
  { id: "protected", label: "Protected Areas", color: "map-protected", default: false },
] as const;

export const landUseData = [
  { name: "Agriculture → Built-up", value: 42, fill: "var(--chart-terra)" },
  { name: "Forest → Non-Forest", value: 18, fill: "var(--chart-forest)" },
  { name: "Barren → Agriculture", value: 12, fill: "var(--chart-saffron)" },
  { name: "Other", value: 28, fill: "var(--chart-stone)" },
];

export const disputeData = [
  { name: "Partition", value: 2341 },
  { name: "Mutation", value: 1982 },
  { name: "Tenancy", value: 1210 },
  { name: "Boundary", value: 1084 },
  { name: "Acquisition", value: 7586 },
];

export const impactItems = [
  { title: "Research Hub", description: "Discover research, datasets and evidence.", icon: BookOpen },
  { title: "Innovation Portal", description: "Turn land challenges into solutions.", icon: Sprout },
  { title: "Policy Lab", description: "Simulate and evaluate policy decisions.", icon: Scale },
  { title: "Collaborate", description: "Work with government, academia and industry.", icon: Users },
  { title: "Data & APIs", description: "Access trusted geospatial and research datasets.", icon: Database },
];
