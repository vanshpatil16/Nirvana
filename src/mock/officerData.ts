export interface DefectRule {
  id: string;
  name: string;
  fired: boolean;
  severity: "critical" | "warning" | "info";
  description: string;
  ruleCitation: string;
}

export interface OwnershipNode {
  year: number;
  owner: string;
  event: string;
  deedRef: string;
  share: string;
  verified: boolean;
}

export interface ParcelVerificationDetail {
  id: string;
  surveyNo: string;
  subDivision: string;
  village: string;
  taluka: string;
  district: string;
  state: string;
  areaHectares: number;
  recordClassification: string;
  satelliteFinding: string;
  satelliteBuiltUpPct: number;
  cropSeasonMismatch: boolean;
  titleRiskScore: number;
  riskBadge: "HIGH" | "MEDIUM" | "LOW";
  status: "Flagged" | "Assigned" | "Visited" | "Confirmed" | "False alarm";
  statusStep: number; // 1: Flagged, 2: Assigned, 3: Visited, 4: Confirmed/False alarm
  assignedOfficer?: string;
  dueDate?: string;
  lat: number;
  lng: number;
  defectRules: DefectRule[];
  ownershipChain: OwnershipNode[];
  fieldNotes?: string;
  lawfulException?: string;
}

export const QUEUE_PARCELS: ParcelVerificationDetail[] = [
  {
    id: "MH-NSK-VB-142",
    surveyNo: "142/3A",
    subDivision: "3A",
    village: "Vadner Bhairav",
    taluka: "Chandwad",
    district: "Nashik",
    state: "Maharashtra",
    areaHectares: 1.84,
    recordClassification: "Dry Crop Agriculture (Jirayat)",
    satelliteFinding: "Commercial Cold Storage & Packhouse (74% built-up impervious surface)",
    satelliteBuiltUpPct: 74,
    cropSeasonMismatch: true,
    titleRiskScore: 82,
    riskBadge: "HIGH",
    status: "Flagged",
    statusStep: 1,
    assignedOfficer: "R. K. Patil (Circle Officer)",
    dueDate: "2026-10-14",
    lat: 20.2458,
    lng: 74.1523,
    defectRules: [
      { id: "R1", name: "Orphaned Deed", fired: false, severity: "critical", description: "Parent partition deed linked to mutation entry ME-1984/22", ruleCitation: "MLRC Sec 148" },
      { id: "R2", name: "Partition Mismatch", fired: true, severity: "critical", description: "RoR registers 4 co-sharers but satellite shows single undivided commercial boundary enclosure", ruleCitation: "Bombay Prevention of Fragmentation Act Sec 8" },
      { id: "R3", name: "Share Over-allocation", fired: true, severity: "critical", description: "Total ancestral shares sum to 1.15x of original sanctioned survey area", ruleCitation: "MLRC Sec 85" },
      { id: "R4", name: "Ghost Transfer", fired: false, severity: "critical", description: "Biometric Aadhaar authentication verified at SRO Chandwad", ruleCitation: "Registration Act Sec 32A" },
      { id: "R5", name: "Temporal Inversion", fired: false, severity: "warning", description: "Sequence of mutation dates matches execution dates", ruleCitation: "e-Ferfar Rule 12" },
      { id: "R6", name: "Dormant Succession", fired: true, severity: "warning", description: "Primary title holder deceased 2018; succession mutation pending for > 7 years", ruleCitation: "Hindu Succession Act Sec 6" },
    ],
    ownershipChain: [
      { year: 1984, owner: "Namdeo Bhikaji Khairnar", event: "Original Ancestral Record", deedRef: "ROR-1984-33", share: "1/1", verified: true },
      { year: 2005, owner: "Suresh Namdeo & Brothers (4)", event: "Oral Family Partition", deedRef: "MUT-2005-112", share: "1/4 each", verified: true },
      { year: 2018, owner: "Estate of Suresh Namdeo (Deceased)", event: "Death of Co-sharer", deedRef: "NOT-RECORDED", share: "1/4", verified: false },
      { year: 2022, owner: "Kisan Cold Storage LLP", event: "Unregistered Commercial Lease", deedRef: "UNREG-PVT-09", share: "Entire Parcel", verified: false },
    ],
    fieldNotes: "Screening flag triggered by Sentinel-2 multispectral variance (NDVI dropped from 0.68 to 0.08, NDBI jumped to 0.52).",
  },
  {
    id: "MH-NSK-CH-089",
    surveyNo: "89/1",
    subDivision: "1",
    village: "Chandwad",
    taluka: "Chandwad",
    district: "Nashik",
    state: "Maharashtra",
    areaHectares: 2.45,
    recordClassification: "Single Owner Ancestral Agriculture",
    satelliteFinding: "Multi-structure light industrial sheds & truck staging yard (61% built-up)",
    satelliteBuiltUpPct: 61,
    cropSeasonMismatch: true,
    titleRiskScore: 78,
    riskBadge: "HIGH",
    status: "Assigned",
    statusStep: 2,
    assignedOfficer: "S. M. Deshmukh (Talathi)",
    dueDate: "2026-10-18",
    lat: 20.3241,
    lng: 74.2411,
    defectRules: [
      { id: "R1", name: "Orphaned Deed", fired: true, severity: "critical", description: "Mutation cites Sale Deed No. 1402/2019 which is not found in NGDRS SRO index", ruleCitation: "Registration Act Sec 17" },
      { id: "R2", name: "Partition Mismatch", fired: false, severity: "warning", description: "Boundary matches cadastral map sheet #4", ruleCitation: "MLRC Sec 135" },
      { id: "R3", name: "Share Over-allocation", fired: true, severity: "critical", description: "Transferred share exceeds registered RoR entitlement by 0.35 hectares", ruleCitation: "MLRC Sec 85" },
      { id: "R4", name: "Ghost Transfer", fired: false, severity: "critical", description: "Buyer PAN and KYC verified", ruleCitation: "Income Tax Rule 114B" },
      { id: "R5", name: "Temporal Inversion", fired: true, severity: "warning", description: "Mutation entry certified before sale deed registration timestamp", ruleCitation: "MLRC Manual Sec 4" },
      { id: "R6", name: "Dormant Succession", fired: false, severity: "info", description: "No pending succession claims", ruleCitation: "HSA Sec 8" },
    ],
    ownershipChain: [
      { year: 1992, owner: "Pandurang Tukaram Jadhav", event: "Govt Allotment", deedRef: "ALLOT-1992", share: "1/1", verified: true },
      { year: 2019, owner: "Shree Ganesh Agro Logistics", event: "Disputed Conveyance", deedRef: "DEED-1402-MISSING", share: "1/1", verified: false },
    ],
    fieldNotes: "Assigned to Talathi for spot verification of Non-Agricultural (NA) conversion order.",
  },
  {
    id: "MH-NSK-PM-204",
    surveyNo: "204/B",
    subDivision: "B",
    village: "Pimpalgaon",
    taluka: "Niphad",
    district: "Nashik",
    state: "Maharashtra",
    areaHectares: 3.10,
    recordClassification: "Seasonal Wetland / Water Retention Commons",
    satelliteFinding: "Earthmoving machinery, landfilling and plotting layout",
    satelliteBuiltUpPct: 38,
    cropSeasonMismatch: true,
    titleRiskScore: 88,
    riskBadge: "HIGH",
    status: "Flagged",
    statusStep: 1,
    assignedOfficer: "A. V. Shinde (Tehsildar)",
    dueDate: "2026-10-12",
    lat: 20.1742,
    lng: 73.9882,
    defectRules: [
      { id: "R1", name: "Orphaned Deed", fired: true, severity: "critical", description: "Deed cites obsolete revenue survey series prior to 1968 consolidation", ruleCitation: "Bombay Land Revenue Code" },
      { id: "R2", name: "Partition Mismatch", fired: true, severity: "critical", description: "Public commons wetland partitioned without Collector sanction", ruleCitation: "Environment Protection Act / MLRC Sec 22" },
      { id: "R3", name: "Share Over-allocation", fired: false, severity: "info", description: "Single entity claim", ruleCitation: "N/A" },
      { id: "R4", name: "Ghost Transfer", fired: true, severity: "critical", description: "Power of Attorney executed by non-existent trust", ruleCitation: "Powers of Attorney Act Sec 4" },
      { id: "R5", name: "Temporal Inversion", fired: false, severity: "info", description: "Timelines regular", ruleCitation: "N/A" },
      { id: "R6", name: "Dormant Succession", fired: false, severity: "info", description: "N/A", ruleCitation: "N/A" },
    ],
    ownershipChain: [
      { year: 1960, owner: "Gram Panchayat Pimpalgaon Commons", event: "Sanctioned Commons", deedRef: "GP-REC-1960", share: "Commons", verified: true },
      { year: 2024, owner: "Greenfield Developers Consortium", event: "Purported Private Sale", deedRef: "NOTARIZED-POA-24", share: "1/1", verified: false },
    ],
    fieldNotes: "High-priority environmental flag: Wetland buffer zone violation suspected.",
  },
];

export interface OfficerTask {
  id: string;
  title: string;
  parcelId: string;
  surveyNo: string;
  village: string;
  taluka: string;
  priority: "High" | "Medium" | "Low";
  status: "Pending" | "In Progress" | "Visited" | "Completed";
  dueDate: string;
  taskType: "Field Inspection" | "Owner Hearing" | "Boundary Demarcation" | "RoR Reconciliation" | "Data Access Approval";
  assignedTo: string;
}

export const OFFICER_TASKS: OfficerTask[] = [
  {
    id: "TSK-881",
    title: "Verify Cold Storage & Commercial Exemption on Survey 142/3A",
    parcelId: "MH-NSK-VB-142",
    surveyNo: "142/3A",
    village: "Vadner Bhairav",
    taluka: "Chandwad",
    priority: "High",
    status: "In Progress",
    dueDate: "2026-10-14",
    taskType: "Field Inspection",
    assignedTo: "Omkar Kudalkar (Collector / Tehsildar)",
  },
  {
    id: "TSK-882",
    title: "Verify Sale Deed 1402 & Check Unregistered SRO Entry",
    parcelId: "MH-NSK-CH-089",
    surveyNo: "89/1",
    village: "Chandwad",
    taluka: "Chandwad",
    priority: "High",
    status: "Pending",
    dueDate: "2026-10-18",
    taskType: "RoR Reconciliation",
    assignedTo: "Omkar Kudalkar (Collector / Tehsildar)",
  },
  {
    id: "TSK-883",
    title: "Encroachment Spot Check on Pimpalgaon Seasonal Wetland",
    parcelId: "MH-NSK-PM-204",
    surveyNo: "204/B",
    village: "Pimpalgaon",
    taluka: "Niphad",
    priority: "High",
    status: "Pending",
    dueDate: "2026-10-12",
    taskType: "Boundary Demarcation",
    assignedTo: "Omkar Kudalkar (Collector / Tehsildar)",
  },
  {
    id: "TSK-884",
    title: "Conduct Co-sharer Hearing on Partition Mismatch",
    parcelId: "MH-NSK-VB-142",
    surveyNo: "142/3A",
    village: "Vadner Bhairav",
    taluka: "Chandwad",
    priority: "Medium",
    status: "Pending",
    dueDate: "2026-10-22",
    taskType: "Owner Hearing",
    assignedTo: "R. K. Patil (Circle Officer)",
  },
  {
    id: "TSK-885",
    title: "Review Purpose-Bound Aggregate Request from IIT Bombay",
    parcelId: "DATA-REQ-402",
    surveyNo: "District-wide",
    village: "Nashik Region",
    taluka: "Nashik",
    priority: "Medium",
    status: "Pending",
    dueDate: "2026-10-16",
    taskType: "Data Access Approval",
    assignedTo: "Omkar Kudalkar (Collector / Tehsildar)",
  },
  {
    id: "TSK-886",
    title: "Validate Drone Orthophoto GCP Points for Deola Pilot",
    parcelId: "MH-NSK-DL-055",
    surveyNo: "55/A",
    village: "Deola",
    taluka: "Deola",
    priority: "Low",
    status: "Completed",
    dueDate: "2026-10-02",
    taskType: "Boundary Demarcation",
    assignedTo: "Omkar Kudalkar (Collector / Tehsildar)",
  },
];
