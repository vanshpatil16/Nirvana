export interface VillageIntegrity {
  rank: number;
  village: string;
  district: string;
  state: string;
  integrityIndex: number; // 0-100
  topDefect: string;
  riskBadge: "HIGH" | "MEDIUM" | "LOW";
  parcelsFlagged: number;
  totalParcels: number;
}

export const OFFICER_MOCK_DATA = {
  headlineOutput: "A short, ranked list of parcels to check",
  summaryStats: {
    totalOpenTasks: 42,
    assignedToMe: 18,
    pendingInspection: 24,
    highRiskParcels: 31,
    avgResolutionDays: 4.8,
  },
  topVillages: [
    { rank: 1, village: "Vadner Bhairav", district: "Nashik", state: "Maharashtra", integrityIndex: 58.4, topDefect: "Partition Mismatch", riskBadge: "HIGH", parcelsFlagged: 34, totalParcels: 412 },
    { rank: 2, village: "Chandwad", district: "Nashik", state: "Maharashtra", integrityIndex: 61.2, topDefect: "Share Over-allocation", riskBadge: "HIGH", parcelsFlagged: 29, totalParcels: 380 },
    { rank: 3, village: "Pimpalgaon", district: "Nashik", state: "Maharashtra", integrityIndex: 63.8, topDefect: "Ghost Transfer", riskBadge: "HIGH", parcelsFlagged: 22, totalParcels: 490 },
    { rank: 4, village: "Sinnar Rural", district: "Nashik", state: "Maharashtra", integrityIndex: 67.5, topDefect: "Temporal Inversion", riskBadge: "MEDIUM", parcelsFlagged: 19, totalParcels: 510 },
    { rank: 5, village: "Deola", district: "Nashik", state: "Maharashtra", integrityIndex: 69.1, topDefect: "Orphaned Deed", riskBadge: "MEDIUM", parcelsFlagged: 17, totalParcels: 340 },
    { rank: 6, village: "Yeola East", district: "Nashik", state: "Maharashtra", integrityIndex: 71.0, topDefect: "Dormant Succession", riskBadge: "MEDIUM", parcelsFlagged: 15, totalParcels: 420 },
    { rank: 7, village: "Trimbak Khurd", district: "Nashik", state: "Maharashtra", integrityIndex: 73.4, topDefect: "Share Over-allocation", riskBadge: "MEDIUM", parcelsFlagged: 12, totalParcels: 310 },
    { rank: 8, village: "Dindori", district: "Nashik", state: "Maharashtra", integrityIndex: 76.2, topDefect: "Partition Mismatch", riskBadge: "LOW", parcelsFlagged: 9, totalParcels: 550 },
    { rank: 9, village: "Igatpuri North", district: "Nashik", state: "Maharashtra", integrityIndex: 78.9, topDefect: "Temporal Inversion", riskBadge: "LOW", parcelsFlagged: 8, totalParcels: 290 },
    { rank: 10, village: "Kalwan", district: "Nashik", state: "Maharashtra", integrityIndex: 82.5, topDefect: "Ghost Transfer", riskBadge: "LOW", parcelsFlagged: 6, totalParcels: 405 },
  ] as VillageIntegrity[],
  highRiskParcels: [
    { id: "MH-NSK-VB-142", surveyNo: "142/3A", village: "Vadner Bhairav", riskScore: 88, riskLevel: "HIGH", recordUse: "Dry Crop Agriculture", satelliteReality: "Commercial Cold Storage & Packhouse (74% built-up)", topDefect: "Partition Mismatch", status: "Flagged" },
    { id: "MH-NSK-CH-089", surveyNo: "89/1", village: "Chandwad", riskScore: 82, riskLevel: "HIGH", recordUse: "Single Owner Ancestral", satelliteReality: "Multi-structure industrial sheds", topDefect: "Share Over-allocation", status: "Assigned" },
    { id: "MH-NSK-PM-204", surveyNo: "204/B", village: "Pimpalgaon", riskScore: 79, riskLevel: "HIGH", recordUse: "Seasonal Wetland", satelliteReality: "Excavation and landfilling", topDefect: "Ghost Transfer", status: "Pending Visit" },
    { id: "MH-NSK-SN-311", surveyNo: "311/2", village: "Sinnar Rural", riskScore: 74, riskLevel: "HIGH", recordUse: "Horticulture Orchard", satelliteReality: "Plotted residential layout roads", topDefect: "Temporal Inversion", status: "Flagged" },
    { id: "MH-NSK-DL-055", surveyNo: "55/A", village: "Deola", riskScore: 71, riskLevel: "HIGH", recordUse: "Forest Fringe Fallow", satelliteReality: "Active quarrying activity", topDefect: "Orphaned Deed", status: "Assigned" },
  ],
  miniSplitPreview: {
    village: "Vadner Bhairav",
    district: "Nashik",
    comparison: "2019 Sentinel-2 vs 2024 Ground Truth",
    mismatchFound: "+34.2% Built-up expansion unrecorded in 7/12 extract",
  },
};

export const POLICYMAKER_MOCK_DATA = {
  headlineOutput: "A tested decision and proof of what worked",
  activeScenarios: [
    { id: "SCN-101", title: "DILRMP Drone Cadastral Resurvey Pilot", state: "Maharashtra", districts: 6, status: "Active Simulation", modelledImpact: "-38% Boundary Litigations", confidence: "95% CI [-42%, -34%]" },
    { id: "SCN-102", title: "Automated eCourts Stay Injunction Sync", state: "Bihar", districts: 4, status: "Pre-registered Cohort", modelledImpact: "-62 days Mutation Latency", confidence: "95% CI [-70, -54]" },
    { id: "SCN-103", title: "Forest Rights Act Joint RoR Titling", state: "Madhya Pradesh", districts: 3, status: "Evaluating Proof", modelledImpact: "+28% Formal Credit Uptake", confidence: "90% CI [+21%, +35%]" },
  ],
  kpiLedgerSummary: {
    totalTracked: 14,
    lockedKpis: 11,
    chainStatus: "Chain Intact",
    chainHash: "sha256:8f7b0c9e...421a9",
    lastBlockTime: "Today, 08:30 IST",
    immutableRecordCount: 384,
  },
  latestCausalResult: {
    title: "Effect of Cadastral Resurvey on Mean Mutation Clearance Time",
    intervention: "DILRMP High-Resolution Drone Resurvey (2021-2023)",
    treatedUnits: "6 Pilot Tehsils (Nashik, Pune, Satara)",
    controlUnits: "12 Matched Synthetic Control Tehsils",
    treatedBeforeAfter: "30.4 days → 20.1 days",
    controlBeforeAfter: "29.8 days → 27.9 days",
    trueEffect: "-8.4 days",
    ci95: "[-10.6, -6.2] days",
    parallelTrends: "Passed (p = 0.62 pre-treatment parallel trends)",
    placeboCheck: "Passed (Placebo timing test p = 0.48; no pseudo-effect detected)",
    evidenceGrade: "Strong" as const,
  },
};

export const RESEARCHER_MOCK_DATA = {
  headlineOutput: "Graded evidence and reproducible results",
  evidencePapers: [
    { title: "Empirical Evaluation of Drone Resurvey on Land Disputes in Maharashtra", authors: "Dr. K. Sharma et al., IIT Bombay", grade: "Strong" as const, citations: 28, roCrateAvailable: true, date: "2026-08" },
    { title: "Evaluating Title Risk and RoR Discrepancy Clustering across 2,400 Tehsils", authors: "Center for Land Governance", grade: "Strong" as const, citations: 19, roCrateAvailable: true, date: "2026-05" },
    { title: "Spectral Signatures of Illegal Agricultural Conversion in Peri-Urban Nashik", authors: "Geospatial Intelligence Lab", grade: "Moderate" as const, citations: 14, roCrateAvailable: true, date: "2026-04" },
    { title: "Socio-Economic Spillovers of SVAMITVA Titling on Rural Credit Access", authors: "National Institute of Public Finance", grade: "Limited" as const, citations: 8, roCrateAvailable: false, date: "2026-01" },
  ],
  gapMapStats: {
    totalInterventions: 6,
    totalOutcomes: 5,
    strongEvidenceCount: 7,
    moderateEvidenceCount: 11,
    criticalGapsCount: 8,
  },
  myCapsules: [
    { id: "CAP-01", title: "DiD Evaluation Pipeline: Maharashtra DILRMP", runs: 42, roCrate: "ark:/9281/c771", status: "Reproduced" },
    { id: "CAP-02", title: "Cadastral Polygon Intersection Benchmark", runs: 18, roCrate: "ark:/9281/c814", status: "Certified" },
    { id: "CAP-03", title: "Synthetic Land Record Generator (v2.1)", runs: 95, roCrate: "ark:/9281/c902", status: "Public" },
  ],
  demandBoardQuestions: [
    { id: "DEM-01", question: "What is the causal impact of eCourts integration on land partition dispute duration?", sponsor: "DoLR / MoRD", reward: "Pilot Grant & State Compute", status: "Open" },
    { id: "DEM-02", question: "Can multi-temporal SAR imagery reliably detect unrecorded monsoon orchard plantation?", sponsor: "State Remote Sensing Center", reward: "Data Access + Fellowship", status: "Claimed" },
  ],
};

export const STATE_OWNER_MOCK_DATA = {
  headlineOutput: "Participation without handing over raw data",
  nodes: [
    { name: "Maharashtra Land Stack Node (NIC-Pune)", status: "ONLINE", type: "Active Authority", latency: "38 ms", uptime: "99.96%", recordsCount: "42.8M parcels" },
    { name: "Karnataka Bhoomi Federation Adapter", status: "STANDBY", type: "Simulated Federated Node", latency: "62 ms", uptime: "99.80%", recordsCount: "38.2M parcels" },
    { name: "Bihar Bhumi Jankari Adapter", status: "SYNCING", type: "Simulated Federated Node", latency: "94 ms", uptime: "98.90%", recordsCount: "29.4M parcels" },
    { name: "UP Bhulekh Adapter", status: "STANDBY", type: "Simulated Federated Node", latency: "71 ms", uptime: "99.10%", recordsCount: "51.0M parcels" },
  ],
  privacyStats: {
    queriesServedToday: 8421,
    suppressedResultsK: 142,
    kAnonymityThreshold: 5,
    privacyBudgetEpsilonUsed: 3.42,
    privacyBudgetLimit: 10.0,
    differentialPrivacyNoise: "Laplace (scale=0.2)",
  },
  pendingAccessRequests: [
    { id: "REQ-401", requester: "Center for Policy Research", institution: "CPR Delhi", purpose: "Evaluating SVAMITVA tenure security in 10 pilot tehsils", requestedRows: "Aggregated Tehsil Metrics only", status: "Pending Approval" },
    { id: "REQ-402", requester: "IIT Bombay Geomatics Dept", institution: "IIT Bombay", purpose: "Validation of satellite canopy model against ground survey", requestedRows: "120 anonymized ground points", status: "Pending Approval" },
  ],
  auditLogPreview: [
    { time: "11:42:10 IST", user: "Dr. K. Sharma (Researcher)", query: "SELECT avg(mutation_days) GROUP BY district WHERE state='MH'", rowsReturned: 36, privacyCheck: "Passed (k=18 > 5)" },
    { time: "10:15:33 IST", user: "Officer S. Deshmukh (Collectorate)", query: "SELECT integrity_index FROM villages WHERE district='Nashik'", rowsReturned: 10, privacyCheck: "Passed (Purpose: Revenue)" },
    { time: "09:04:12 IST", user: "Anonymous Public (Citizen Portal)", query: "SELECT count(*) WHERE survey_no='142/3' AND area < 0.1", rowsReturned: 0, privacyCheck: "Suppressed (k=1 < 5)" },
  ],
};

export const CITIZEN_MOCK_DATA = {
  headlineOutput: "A simple way to be heard and to track it",
  myReports: [
    { id: "REP-2026-098", title: "Commercial Warehouse on Agricultural Title", surveyNo: "142/3A", village: "Vadner Bhairav", date: "2026-09-18", status: "Under Field Verification", statusStep: 2, officerAssigned: "Tehsildar Office Niphad" },
    { id: "REP-2026-041", title: "Boundary Wall Overlap with Village Commons (Gairan)", surveyNo: "88/1", village: "Vadner Bhairav", date: "2026-08-04", status: "Resolved — Rectification Notice Issued", statusStep: 4, officerAssigned: "Talathi Vadner Bhairav" },
  ],
  openConsultations: [
    { id: "CNS-01", title: "Draft Guidelines for Digitally Verified Farmer Boundary Certificates", department: "Department of Land Resources", deadline: "Oct 31, 2026", description: "Feedback invited from landowners on self-verification of boundaries using mobile GPS and drone orthophotos.", responses: 1420 },
    { id: "CNS-02", title: "Simplified Succession Mutation Rules for Inherited Agricultural Plots", department: "State Revenue Department", deadline: "Nov 15, 2026", description: "Proposal to eliminate mandatory court heirship certificates for undisputed direct agricultural succession.", responses: 3105 },
  ],
  plainSummaries: [
    { title: "Understanding your 7/12 Extract vs Satellite Reality", readingTime: "3 min read", summary: "How Nirvana helps farmers check if their government land record accurately reflects the crops and structures standing on the ground today." },
    { title: "What to do if your plot is flagged in the integrity screening", readingTime: "4 min read", summary: "A screening flag is NOT a court order. Here are the 4 easy steps to request a field verification and submit ground geotagged photos." },
  ],
};

export const INNOVATOR_MOCK_DATA = {
  headlineOutput: "A clear pilot pathway",
  openChallenges: [
    { id: "CHL-01", title: "Automated Cadastral Encroachment AI Model", prize: "₹25,00,000", deadline: "45 days left", applicants: 18, category: "Computer Vision" },
    { id: "CHL-02", title: "Multi-Temporal SAR Crop Boundary Disambiguation", prize: "₹15,00,000", deadline: "30 days left", applicants: 12, category: "Synthetic Aperture Radar" },
    { id: "CHL-03", title: "Lightweight Offline Mobile GIS for Field Patwaris", prize: "₹20,00,000", deadline: "60 days left", applicants: 24, category: "Mobile / Edge Computing" },
  ],
  apiUsage: {
    plan: "Developer Sandbox (Tier 2)",
    monthlyQuota: 50000,
    usedThisMonth: 14820,
    activeKeys: 2,
    endpointsAvailable: "OGC Features, STAC Metadata, Discrepancy Screening API",
    status: "Healthy",
  },
  hackathons: [
    { title: "NIRVANA GovTech Buildathon 2026", date: "Nov 10-12, 2026", prizePool: "₹50 Lakhs + Deployment Contract", focus: "Land Intelligence Tools for Field Staff & Citizens" },
  ],
  demandBoardProblems: [
    { title: "High-throughput OCR for 100-year-old Modi Script Revenue Deeds", state: "Maharashtra", priority: "CRITICAL", pilotBudget: "₹40 Lakhs" },
    { title: "Automated Parcel Splitting from High-Resolution UAV Orthophotos", state: "Karnataka", priority: "HIGH", pilotBudget: "₹30 Lakhs" },
  ],
};
