import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Command,
  Download,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  HelpCircle,
  Info,
  Layers,
  Map as MapIcon,
  MapPin,
  Menu,
  Moon,
  Plus,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sun,
  UserCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { navItems } from "@/data/dashboard";
import {
  DEFAULT_SURVEY_NO,
  LOCATION_HIERARCHY,
  PARCEL_DATABASE,
  type ParcelRecord,
  type VerificationTask,
} from "@/data/record-reality";
import logo from "@/assets/logo.png";
import sidenavBottom from "@/assets/sidenav-bottom.png";
import satelliteMap from "@/assets/satellite_map.jpg";
import { FieldCapture, type CapturedEvidence } from "./FieldCapture";
import sat2020 from "@/assets/sat_2020.jpg";
import sat2024 from "@/assets/sat_2024.jpg";
import { ProfileMenu } from "@/components/ProfileMenu";

export function RecordVsReality() {
  const [legendOpen, setLegendOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [selectedState, setSelectedState] = useState<string>("Maharashtra");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("Pune");
  const [selectedVillage, setSelectedVillage] = useState<string>("Shirur");
  const [selectedSurveyNo, setSelectedSurveyNo] = useState<string>(DEFAULT_SURVEY_NO);

  // Map view states
  const [mapMode, setMapMode] = useState<"split" | "swipe" | "overlay" | "map" | "satellite">(
    "split",
  );
  const [swipePosition, setSwipePosition] = useState<number>(50); // percentage
  const [overlayOpacity, setOverlayOpacity] = useState<number>(60); // percentage
  const [selectedYear, setSelectedYear] = useState<number>(2024);

  // Modal dialog states
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showAddEvidenceModal, setShowAddEvidenceModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Verification task state
  const [tasks, setTasks] = useState<VerificationTask[]>([]);
  const [taskForm, setTaskForm] = useState({
    issue: "Observed land cover differs from official recorded use.",
    priority: "High Priority",
    department: "Department of Revenue & Land Records",
    officer: "Circle Officer - Shirur Division",
    dueDate: "2026-10-15",
    notes: "Requires physical verification of site boundary and building permission verification.",
  });

  // Evidence state
  const [evidenceList, setEvidenceList] = useState(
    PARCEL_DATABASE[selectedSurveyNo]?.fieldEvidence || [],
  );
  const [evidenceForm, setEvidenceForm] = useState({
    submitterType: "Citizen Report" as "Citizen Report" | "Field Officer" | "Drone Survey",
    author: "Omkar Kudalkar",
    description: "",
    imageUrl: satelliteMap,
  });

  // Current active parcel record
  const currentParcel: ParcelRecord = PARCEL_DATABASE[selectedSurveyNo] || {
    surveyNo: selectedSurveyNo,
    state: selectedState,
    district: selectedDistrict,
    tehsil: selectedVillage,
    village: selectedVillage,
    officialLandUse: "Agriculture",
    observedLandUse: "Unverified",
    areaHectares: 1.5,
    confidenceScore: 75,
    mismatchDetected: false,
    statusPriority: "Normal",
    summary: `Official land record for Survey ${selectedSurveyNo}, ${selectedVillage}.`,
    sources: {
      official: "State Land Records",
      satellite: `Sentinel-2 (${selectedYear})`,
      evidenceCount: 0,
    },
    implications: [{ type: "info", text: "Select a valid plot to view spatial analysis." }],
    historicalTimeline: [
      { year: 2020, landUse: "Agriculture", description: "Standard cropland" },
      { year: 2021, landUse: "Agriculture", description: "Standard cropland" },
      { year: 2022, landUse: "Agriculture", description: "Standard cropland" },
      { year: 2023, landUse: "Agriculture", description: "Standard cropland" },
      { year: 2024, landUse: "Agriculture", description: "Standard cropland" },
    ],
    fieldEvidence: [],
    nearbyPlots: [],
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Location selector change handlers
  const handleStateChange = (state: string) => {
    setSelectedState(state);
    const districts = Object.keys(LOCATION_HIERARCHY[state] || {});
    const firstDist = districts[0] || "";
    setSelectedDistrict(firstDist);
    const villages = Object.keys(LOCATION_HIERARCHY[state]?.[firstDist] || {});
    const firstVil = villages[0] || "";
    setSelectedVillage(firstVil);
    const surveys = LOCATION_HIERARCHY[state]?.[firstDist]?.[firstVil] || [];
    setSelectedSurveyNo(surveys[0] || "123/2");
  };

  const handleDistrictChange = (district: string) => {
    setSelectedDistrict(district);
    const villages = Object.keys(LOCATION_HIERARCHY[selectedState]?.[district] || {});
    const firstVil = villages[0] || "";
    setSelectedVillage(firstVil);
    const surveys = LOCATION_HIERARCHY[selectedState]?.[district]?.[firstVil] || [];
    setSelectedSurveyNo(surveys[0] || "123/2");
  };

  const handleVillageChange = (village: string) => {
    setSelectedVillage(village);
    const surveys = LOCATION_HIERARCHY[selectedState]?.[selectedDistrict]?.[village] || [];
    setSelectedSurveyNo(surveys[0] || "123/2");
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    const newTask: VerificationTask = {
      id: `task-${Date.now()}`,
      surveyNo: selectedSurveyNo,
      village: selectedVillage,
      district: selectedDistrict,
      issue: taskForm.issue,
      priority: taskForm.priority,
      department: taskForm.department,
      officer: taskForm.officer,
      dueDate: taskForm.dueDate,
      notes: taskForm.notes,
      createdAt: new Date().toLocaleDateString("en-IN"),
      status: "Verification pending",
    };
    setTasks([newTask, ...tasks]);
    setShowTaskModal(false);
    triggerToast(`Verification task created successfully for Survey ${selectedSurveyNo}!`);
  };

  const handleCapturedEvidence = (ev: CapturedEvidence) => {
    const newEv = {
      id: `ev-${Date.now()}`,
      date: new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      submitterType: ev.submitterType,
      author: ev.author,
      description: ev.description,
      verified: true,
      imageUrl: ev.imageUrl || satelliteMap,
      geoTag: ev.geoTag,
      ocrVerified: ev.ocrVerified,
    };
    setEvidenceList([newEv, ...evidenceList]);
    setShowAddEvidenceModal(false);
    triggerToast(
      `Field evidence recorded for Survey ${selectedSurveyNo}${ev.ocrVerified ? " · 7/12 cross-checked" : ""}.`,
    );
  };

  const handleAddEvidence = (e: React.FormEvent) => {
    e.preventDefault();
    const newEv = {
      id: `ev-${Date.now()}`,
      date: "Today",
      submitterType: evidenceForm.submitterType,
      author: evidenceForm.author,
      description: evidenceForm.description || "Ground observation report submitted.",
      verified: true,
      imageUrl: evidenceForm.imageUrl,
    };
    setEvidenceList([newEv, ...evidenceList]);
    setShowAddEvidenceModal(false);
    triggerToast(`New field evidence recorded for Survey ${selectedSurveyNo}.`);
  };

  return (
    <TooltipProvider>
      <div className="dashboard-shell">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg bg-emerald-950 px-4 py-3 text-sm font-medium text-emerald-100 shadow-xl border border-emerald-700 animate-in fade-in slide-in-from-bottom-5">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Sidebar */}
        <aside className={`sidebar ${drawer ? "open" : ""}`}>
          <div className="sidebar-top">
            <div className="brand">
              <span className="brand-mark" aria-hidden="true">
                <img src={logo} alt="NIRVANA Logo" width={38} height={38} />
              </span>
              <div>
                <strong>NIRVANA</strong>
                <b>निर्वाण</b>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="sidebar-close"
              onClick={() => setDrawer(false)}
              aria-label="Close navigation"
            >
              <X />
            </Button>
            <p>National Platform for Research & Policy Innovation in Land Governance</p>
          </div>
          <nav aria-label="Main navigation">
            {navItems.map(({ label, icon: Icon, href }) => {
              const isActive = label === "Record vs Reality";
              if (href) {
                return (
                  <a
                    key={label}
                    href={href}
                    className={isActive ? "active" : ""}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon />
                    <span>{label}</span>
                  </a>
                );
              }
              return (
                <button
                  key={label}
                  className={isActive ? "active" : ""}
                  aria-current={isActive ? "page" : undefined}
                  title={`${label} — coming soon`}
                >
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

        {drawer && (
          <button
            className="drawer-backdrop"
            onClick={() => setDrawer(false)}
            aria-label="Close navigation"
          />
        )}

        <main className="flex-1 overflow-x-clip">
          {/* Top Header */}
          <header className="top-header">
            <Button
              variant="ghost"
              size="icon"
              className="menu-button"
              onClick={() => setDrawer(true)}
              aria-label="Open navigation"
            >
              <Menu />
            </Button>
            <label className="global-search">
              <Search />
              <input placeholder="Search a location, survey number, village, district..." />
              <kbd>
                <Command /> K
              </kbd>
            </label>
            <div className="header-tools">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Theme settings">
                    <Sun className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Light appearance</TooltipContent>
              </Tooltip>
              <button className="lang">
                EN <ChevronDown />
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="notification"
                aria-label="Notifications"
              >
                <Bell />
                <i />
              </Button>
              <ProfileMenu />
            </div>
          </header>

          <div className="rvr p-4 md:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
            {/* Page Title Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
              <div>
                <div className="flex items-center gap-3">
                  <span className="p-2 rounded-lg bg-emerald-900/10 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-700/20">
                    <Layers className="h-6 w-6" />
                  </span>
                  <h1 className="font-serif text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                    Record vs Reality
                  </h1>
                </div>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                  Compare official land records with real-world satellite imagery, field data and
                  ground reports.
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHowItWorks(true)}
                  className="gap-2 bg-background hover:bg-muted text-xs font-semibold text-foreground border-border"
                >
                  <HelpCircle className="h-4 w-4 text-emerald-700" />
                  How it works
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReportModal(true)}
                  className="gap-2 bg-background hover:bg-muted text-xs font-semibold text-foreground border-border"
                >
                  <Download className="h-4 w-4 text-emerald-700" />
                  Download Report
                </Button>
              </div>
            </div>

            {/* Location / Parcel Selector Bar */}
            <div className="bg-card border border-border/80 rounded-xl p-4 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    State
                  </label>
                  <select
                    value={selectedState}
                    onChange={(e) => handleStateChange(e.target.value)}
                    className="w-full bg-muted/40 border border-input rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-600 font-medium"
                  >
                    {Object.keys(LOCATION_HIERARCHY).map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    District
                  </label>
                  <select
                    value={selectedDistrict}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                    className="w-full bg-muted/40 border border-input rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-600 font-medium"
                  >
                    {Object.keys(LOCATION_HIERARCHY[selectedState] || {}).map((dist) => (
                      <option key={dist} value={dist}>
                        {dist}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Village
                  </label>
                  <select
                    value={selectedVillage}
                    onChange={(e) => handleVillageChange(e.target.value)}
                    className="w-full bg-muted/40 border border-input rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-600 font-medium"
                  >
                    {Object.keys(LOCATION_HIERARCHY[selectedState]?.[selectedDistrict] || {}).map(
                      (vil) => (
                        <option key={vil} value={vil}>
                          {vil}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Survey Number / Plot ID
                  </label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={selectedSurveyNo}
                      onChange={(e) => setSelectedSurveyNo(e.target.value)}
                      placeholder="e.g. 123/2"
                      className="w-full bg-muted/40 border border-input rounded-md pl-9 pr-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-600 font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 lg:pt-0">
                <Button
                  onClick={() =>
                    triggerToast(`Analyzed parcel ${selectedSurveyNo}, ${selectedVillage}`)
                  }
                  className="bg-emerald-800 hover:bg-emerald-900 text-white px-6 py-2 text-sm font-semibold rounded-md flex-1 lg:flex-none justify-center gap-2 shadow-sm"
                >
                  Analyse
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="border-border text-foreground hover:bg-muted"
                  title="Center on GIS Map"
                  onClick={() => triggerToast(`Locating Survey ${selectedSurveyNo} on Map...`)}
                >
                  <MapPin className="h-4 w-4 text-emerald-700" />
                </Button>
              </div>
            </div>

            {/* Main Comparison Area + Right Panel Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left & Center: Geospatial Workspace (8 columns on lg) */}
              <div className="lg:col-span-8 space-y-4">
                {/* Map Panel Container */}
                <div className="bg-card border border-border/80 rounded-xl overflow-hidden shadow-sm flex flex-col">
                  {/* Top Map View Controls */}
                  <div className="bg-muted/30 border-b border-border px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-1 bg-background border border-border rounded-lg p-1">
                      <button
                        onClick={() => setMapMode("split")}
                        className={`px-3 py-1 rounded-md font-medium transition-colors ${
                          mapMode === "split"
                            ? "bg-emerald-800 text-white shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Split View
                      </button>
                      <button
                        onClick={() => setMapMode("swipe")}
                        className={`px-3 py-1 rounded-md font-medium transition-colors ${
                          mapMode === "swipe"
                            ? "bg-emerald-800 text-white shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Swipe
                      </button>
                      <button
                        onClick={() => setMapMode("overlay")}
                        className={`px-3 py-1 rounded-md font-medium transition-colors ${
                          mapMode === "overlay"
                            ? "bg-emerald-800 text-white shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Overlay
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-background border border-border rounded-lg p-1">
                        <button
                          onClick={() => setMapMode("map")}
                          className={`px-3 py-1 rounded-md font-medium transition-colors ${
                            mapMode === "map"
                              ? "bg-emerald-800 text-white"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Map
                        </button>
                        <button
                          onClick={() => setMapMode("satellite")}
                          className={`px-3 py-1 rounded-md font-medium transition-colors ${
                            mapMode === "satellite"
                              ? "bg-emerald-800 text-white"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Satellite
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Main Display Box */}
                  <div className="relative min-h-[460px] md:min-h-[500px] bg-slate-100 dark:bg-slate-950 overflow-hidden select-none">
                    {/* Mode 1: Split View */}
                    {mapMode === "split" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 h-full min-h-[460px] md:min-h-[500px]">
                        {/* Official Cadastral Map Side */}
                        <div className="relative bg-[#e8eae3] border-b md:border-b-0 md:border-r border-border p-4 flex flex-col justify-between overflow-hidden">
                          <div className="absolute top-3 left-3 z-10 bg-background/90 backdrop-blur-xs border border-border px-3 py-1.5 rounded-lg shadow-xs">
                            <h3 className="font-semibold text-xs text-foreground">
                              Official Land Record (Bhulekh)
                            </h3>
                            <p className="text-[10px] text-muted-foreground">
                              Source: {currentParcel.sources.official}
                            </p>
                          </div>

                          {/* Legend — collapsed to a chip so it never covers the parcels */}
                          <div className="rvr-legend absolute bottom-3 left-3 z-10">
                            <button
                              type="button"
                              className="rvr-legend-btn"
                              onClick={() => setLegendOpen((v) => !v)}
                              aria-expanded={legendOpen}
                            >
                              <Layers className="h-3.5 w-3.5" /> Legend
                            </button>
                            {legendOpen && (
                              <div className="rvr-legend-list">
                                {[
                                  ["Agriculture", "#10b981"],
                                  ["Residential", "#fbbf24"],
                                  ["Commercial", "#fb7185"],
                                  ["Forest", "#15803d"],
                                  ["Water Body", "#38bdf8"],
                                  ["Government", "#c084fc"],
                                  ["Others", "#b45309"],
                                ].map(([label, color]) => (
                                  <span key={label}>
                                    <i style={{ background: color }} />
                                    {label}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Vector Cadastral SVG Mock Map */}
                          <svg className="w-full h-full min-h-[380px]" viewBox="0 0 500 400">
                            <defs>
                              <pattern
                                id="grid"
                                width="40"
                                height="40"
                                patternUnits="userSpaceOnUse"
                              >
                                <path
                                  d="M 40 0 L 0 0 0 40"
                                  fill="none"
                                  stroke="#d1d5db"
                                  strokeWidth="0.5"
                                />
                              </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#grid)" />

                            {/* Parcel 123/1 */}
                            <path
                              d="M 50 80 L 220 50 L 240 180 L 70 200 Z"
                              fill="#c5e1a5"
                              stroke="#558b2f"
                              strokeWidth="1.5"
                            />
                            <text x="130" y="130" fontSize="13" fontWeight="bold" fill="#33691e">
                              123/1
                            </text>

                            {/* Parcel 123/2 (Selected - Highlighted) */}
                            <path
                              d="M 220 50 L 420 80 L 450 260 L 240 180 Z"
                              fill="#d4e157"
                              stroke="#fbc02d"
                              strokeWidth="4"
                              className="animate-pulse"
                            />
                            <text x="310" y="160" fontSize="16" fontWeight="800" fill="#1b5e20">
                              {currentParcel.surveyNo}
                            </text>

                            {/* Parcel 122/3 */}
                            <path
                              d="M 420 80 L 490 60 L 490 200 L 450 260 Z"
                              fill="#f8bbd0"
                              stroke="#c2185b"
                              strokeWidth="1.5"
                            />
                            <text x="445" y="140" fontSize="11" fontWeight="bold" fill="#880e4f">
                              122/3
                            </text>

                            {/* Parcel 124/1 */}
                            <path
                              d="M 240 180 L 450 260 L 420 380 L 200 350 Z"
                              fill="#ffe082"
                              stroke="#ffa000"
                              strokeWidth="1.5"
                            />
                            <text x="320" y="290" fontSize="13" fontWeight="bold" fill="#ff6f00">
                              124/1
                            </text>

                            {/* Parcel 122/4 */}
                            <path
                              d="M 70 200 L 240 180 L 200 350 L 50 320 Z"
                              fill="#c5e1a5"
                              stroke="#558b2f"
                              strokeWidth="1.5"
                            />
                            <text x="120" y="270" fontSize="13" fontWeight="bold" fill="#33691e">
                              122/4
                            </text>
                          </svg>

                          <div className="absolute bottom-3 right-3 bg-background/90 px-2 py-1 rounded text-[10px] text-muted-foreground border border-border">
                            Scale: 1:2,500
                          </div>
                        </div>

                        {/* Satellite Imagery Side */}
                        <div className="relative bg-slate-900 text-white flex flex-col justify-between overflow-hidden">
                          <div className="absolute top-3 left-3 z-10 bg-black/70 backdrop-blur-xs border border-white/20 px-3 py-1.5 rounded-lg">
                            <h3 className="font-semibold text-xs text-white">
                              Satellite Imagery (Reality)
                            </h3>
                            <p className="text-[10px] text-slate-300">
                              Source: {currentParcel.sources.satellite} ({selectedYear})
                            </p>
                          </div>

                          {/* Year Selector Timeline */}
                          <div className="absolute top-3 right-3 z-10 bg-black/70 backdrop-blur-xs border border-white/20 p-1.5 rounded-lg flex flex-col gap-1 text-[11px]">
                            {[2020, 2021, 2022, 2023, 2024].map((yr) => (
                              <button
                                key={yr}
                                onClick={() => setSelectedYear(yr)}
                                className={`px-2 py-0.5 rounded transition-all text-left font-mono ${
                                  selectedYear === yr
                                    ? "bg-emerald-600 text-white font-bold"
                                    : "text-slate-300 hover:bg-white/10"
                                }`}
                              >
                                ● {yr}
                              </button>
                            ))}
                          </div>

                          {/* Background Satellite Canvas Mock */}
                          <div
                            className="absolute inset-0 bg-cover bg-center brightness-90 contrast-110 transition-all duration-500"
                            style={{
                              backgroundImage: `url(${selectedYear < 2022 ? sat2020 : selectedYear === 2024 ? sat2024 : satelliteMap})`,
                            }}
                          >
                            {/* Overlay SVG Boundary on top of Satellite */}
                            <svg className="w-full h-full" viewBox="0 0 500 400">
                              <path
                                d="M 220 50 L 420 80 L 450 260 L 240 180 Z"
                                fill={
                                  currentParcel.mismatchDetected
                                    ? "rgba(225, 29, 72, 0.25)"
                                    : "rgba(34, 197, 94, 0.2)"
                                }
                                stroke={currentParcel.mismatchDetected ? "#ef4444" : "#22c55e"}
                                strokeWidth="3.5"
                                strokeDasharray="6 3"
                              />
                              <text
                                x="310"
                                y="160"
                                fontSize="16"
                                fontWeight="800"
                                fill="#ffffff"
                                stroke="#000"
                                strokeWidth="0.5"
                              >
                                {currentParcel.surveyNo}
                              </text>
                            </svg>
                          </div>

                          <div className="absolute bottom-3 left-3 z-10 bg-black/70 backdrop-blur-xs px-3 py-1 rounded text-[10px] text-slate-300 border border-white/10">
                            Lat: 18.8624° N, Lon: 74.3721° E
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Mode 2: Swipe Mode */}
                    {mapMode === "swipe" && (
                      <div className="relative h-full min-h-[460px] md:min-h-[500px]">
                        {/* Layer 1: Satellite Background */}
                        <div
                          className="absolute inset-0 bg-cover bg-center"
                          style={{
                            backgroundImage: `url(${selectedYear < 2022 ? sat2020 : selectedYear === 2024 ? sat2024 : satelliteMap})`,
                          }}
                        >
                          <div className="absolute top-3 right-3 bg-black/80 px-3 py-1 rounded text-xs text-white">
                            Satellite ({selectedYear})
                          </div>
                        </div>

                        {/* Layer 2: Official Map Clipped */}
                        <div
                          className="absolute inset-0 bg-[#e8eae3] overflow-hidden"
                          style={{ clipPath: `inset(0 ${100 - swipePosition}% 0 0)` }}
                        >
                          <svg className="w-full h-full" viewBox="0 0 500 400">
                            <path
                              d="M 220 50 L 420 80 L 450 260 L 240 180 Z"
                              fill="#d4e157"
                              stroke="#fbc02d"
                              strokeWidth="4"
                            />
                            <text x="310" y="160" fontSize="16" fontWeight="bold" fill="#1b5e20">
                              {currentParcel.surveyNo} (Official)
                            </text>
                          </svg>
                          <div className="absolute top-3 left-3 bg-background/90 px-3 py-1 rounded text-xs text-foreground font-semibold">
                            Official Cadastral Record
                          </div>
                        </div>

                        {/* Draggable Divider */}
                        <div
                          className="absolute top-0 bottom-0 w-1 bg-emerald-500 cursor-ew-resize z-30 flex items-center justify-center shadow-lg"
                          style={{ left: `${swipePosition}%` }}
                        >
                          <div className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center shadow-md text-xs font-bold">
                            ↔
                          </div>
                        </div>

                        {/* Range Input Control */}
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={swipePosition}
                          onChange={(e) => setSwipePosition(Number(e.target.value))}
                          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 w-64 accent-emerald-700 opacity-80 hover:opacity-100"
                        />
                      </div>
                    )}

                    {/* Mode 3: Overlay Mode */}
                    {mapMode === "overlay" && (
                      <div className="relative h-full min-h-[460px] md:min-h-[500px]">
                        <div
                          className="absolute inset-0 bg-cover bg-center"
                          style={{
                            backgroundImage: `url(${selectedYear < 2022 ? sat2020 : selectedYear === 2024 ? sat2024 : satelliteMap})`,
                          }}
                        />

                        <div
                          className="absolute inset-0 bg-[#e8eae3] transition-opacity"
                          style={{ opacity: overlayOpacity / 100 }}
                        >
                          <svg className="w-full h-full" viewBox="0 0 500 400">
                            <path
                              d="M 220 50 L 420 80 L 450 260 L 240 180 Z"
                              fill="#d4e157"
                              stroke="#fbc02d"
                              strokeWidth="4"
                            />
                            <text x="310" y="160" fontSize="16" fontWeight="bold" fill="#1b5e20">
                              {currentParcel.surveyNo}
                            </text>
                          </svg>
                        </div>

                        <div className="absolute top-4 left-4 z-20 bg-background/90 backdrop-blur-xs p-3 rounded-lg border border-border shadow-md space-y-1">
                          <label className="text-xs font-semibold block">
                            Cadastral Layer Opacity: {overlayOpacity}%
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={overlayOpacity}
                            onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                            className="w-48 accent-emerald-700"
                          />
                        </div>
                      </div>
                    )}

                    {/* Mode 4 & 5: Single Map / Satellite Full Views */}
                    {(mapMode === "map" || mapMode === "satellite") && (
                      <div className="relative h-full min-h-[460px] md:min-h-[500px] p-6">
                        <div className="absolute top-4 left-4 z-10 bg-background/90 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold">
                          {mapMode === "map"
                            ? "Official Cadastral Map View"
                            : `Satellite Observation View (${selectedYear})`}
                        </div>
                        <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded-lg">
                          <div className="text-center p-4">
                            <MapIcon className="h-10 w-10 text-emerald-700 mx-auto mb-2" />
                            <h3 className="font-semibold text-sm">Full view mode active</h3>
                            <p className="text-xs text-muted-foreground">
                              Showing survey {currentParcel.surveyNo} single perspective
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section: Historical Change (Last 5 Years) */}
                <div className="bg-card border border-border/80 rounded-xl p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="rvr-head">
                      <span>Timeline</span>
                      <h3>Historical Change (Last 5 Years)</h3>
                    </div>
                    <span className="rvr-chip">2020 – 2024</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {currentParcel.historicalTimeline.map((item) => (
                      <button
                        key={item.year}
                        onClick={() => setSelectedYear(item.year)}
                        className={`text-left border rounded-lg overflow-hidden p-2 transition-all hover:border-emerald-600 ${
                          selectedYear === item.year
                            ? "border-emerald-700 bg-emerald-950/5 ring-1 ring-emerald-600"
                            : "border-border bg-background"
                        }`}
                      >
                        <div className="h-20 bg-slate-800 rounded mb-2 overflow-hidden relative">
                          <img
                            src={item.imageUrl || satelliteMap}
                            alt={`${item.year} land use`}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute top-1 left-1 bg-black/75 text-white font-mono text-[10px] px-1.5 py-0.5 rounded">
                            {item.year}
                          </span>
                        </div>
                        <div className="font-semibold text-xs text-foreground truncate">
                          {item.landUse}
                        </div>
                        <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                          {item.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Section: Field Evidence */}
                <div className="bg-card border border-border/80 rounded-xl p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="rvr-head">
                        <span>Ground truth</span>
                        <h3>Field Evidence</h3>
                      </div>
                      <span className="bg-emerald-900/10 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                        {evidenceList.length} Submissions
                      </span>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowAddEvidenceModal(true)}
                      className="gap-1.5 text-xs text-emerald-800 border-emerald-700/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Capture evidence
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {evidenceList.map((ev) => (
                      <div
                        key={ev.id}
                        className="border border-border rounded-lg p-3 bg-background flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="h-24 bg-muted rounded-md overflow-hidden relative">
                            <img
                              src={ev.imageUrl || satelliteMap}
                              alt={ev.submitterType}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                if (!e.currentTarget.src.endsWith(satelliteMap))
                                  e.currentTarget.src = satelliteMap;
                              }}
                            />
                            <span className="absolute bottom-1.5 left-1.5 bg-black/75 text-white text-[10px] px-2 py-0.5 rounded font-medium">
                              {ev.submitterType}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] font-mono text-muted-foreground block">
                              {ev.date}
                            </span>
                            <div className="text-xs font-semibold text-foreground">{ev.author}</div>
                            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                              {ev.description}
                            </p>
                            {(ev.geoTag || ev.ocrVerified) && (
                              <div className="rvr-ev-tags">
                                {ev.geoTag && (
                                  <span title={ev.geoTag}>
                                    <MapPin /> Geo-tagged
                                  </span>
                                )}
                                {ev.ocrVerified && (
                                  <span>
                                    <CheckCircle2 /> 7/12 OCR
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section: Nearby Plots Analysis */}
                <div className="bg-card border border-border/80 rounded-xl p-4 shadow-sm space-y-3">
                  <div className="rvr-head">
                    <span>Neighbourhood</span>
                    <h3>Nearby Plots Analysis</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/50 border-b border-border text-muted-foreground font-medium uppercase tracking-wider">
                        <tr>
                          <th className="p-2.5">Survey No.</th>
                          <th className="p-2.5">Official Use</th>
                          <th className="p-2.5">Detected Use</th>
                          <th className="p-2.5">Area (ha)</th>
                          <th className="p-2.5">Change</th>
                          <th className="p-2.5">Risk Level</th>
                          <th className="p-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {currentParcel.nearbyPlots.map((plot) => (
                          <tr key={plot.surveyNo} className="hover:bg-muted/30 transition-colors">
                            <td className="p-2.5 font-bold text-foreground">{plot.surveyNo}</td>
                            <td className="p-2.5 text-muted-foreground">{plot.officialUse}</td>
                            <td className="p-2.5 font-medium text-foreground">
                              {plot.detectedUse}
                            </td>
                            <td className="p-2.5 text-muted-foreground">{plot.areaHectares}</td>
                            <td className="p-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  plot.change === "Changed"
                                    ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                }`}
                              >
                                {plot.change}
                              </span>
                            </td>
                            <td className="p-2.5 font-semibold">
                              <span
                                className={
                                  plot.riskLevel === "High"
                                    ? "text-rose-600"
                                    : plot.riskLevel === "Medium"
                                      ? "text-amber-600"
                                      : "text-emerald-600"
                                }
                              >
                                ● {plot.riskLevel}
                              </span>
                            </td>
                            <td className="p-2.5 text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedSurveyNo(plot.surveyNo)}
                                className="h-7 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                              >
                                View
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right: Analysis Result / Intelligence Panel (4 columns on lg) */}
              <div className="lg:col-span-4 space-y-4 lg:self-stretch">
                <div className="rvr-panel bg-card border border-border/80 rounded-xl p-5 shadow-sm space-y-5 lg:sticky lg:top-[88px]">
                  {/* Panel Header */}
                  <div className="flex items-center justify-between border-b border-border/60 pb-3">
                    <h2 className="font-serif font-bold text-lg text-foreground">
                      Analysis Result
                    </h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide ${
                        currentParcel.mismatchDetected
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300/40"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300/40"
                      }`}
                    >
                      {currentParcel.statusPriority}
                    </span>
                  </div>

                  {/* Provenance: each row below carries its own evidence class */}
                  <div className="flex flex-wrap gap-1.5 -mt-2">
                    <span className="pv-kpi-tag pv-tag-observed">observed · satellite imagery</span>
                    <span className="pv-kpi-tag">legal evidence · state land record</span>
                    <span className="pv-kpi-tag pv-tag-derived">derived · classification</span>
                    <span className="pv-kpi-tag pv-tag-synthetic">demo parcel dataset</span>
                  </div>

                  {/* Status Warning Banner */}
                  {currentParcel.mismatchDetected ? (
                    <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg p-3.5 space-y-1">
                      <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-sm">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>LAND USE MISMATCH DETECTED</span>
                      </div>
                      <p className="text-xs text-rose-950 dark:text-rose-200 leading-relaxed">
                        {currentParcel.summary}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-lg p-3.5 space-y-1">
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>LAND USE VERIFIED MATCH</span>
                      </div>
                      <p className="text-xs text-emerald-950 dark:text-emerald-200 leading-relaxed">
                        {currentParcel.summary}
                      </p>
                    </div>
                  )}

                  {/* Structured Parcel Info Grid */}
                  <div className="space-y-2 text-xs border-b border-border/60 pb-4">
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground font-medium">Survey Number</span>
                      <span className="font-bold text-foreground">{currentParcel.surveyNo}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground font-medium">Village</span>
                      <span className="font-semibold text-foreground">{currentParcel.village}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground font-medium">Tehsil</span>
                      <span className="font-semibold text-foreground">{currentParcel.tehsil}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground font-medium">District</span>
                      <span className="font-semibold text-foreground">
                        {currentParcel.district}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground font-medium">
                        Official Land Use <span className="pv-kpi-tag">legal evidence</span>
                      </span>
                      <span className="font-semibold text-foreground">
                        {currentParcel.officialLandUse}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground font-medium">
                        Detected Land Use <span className="pv-kpi-tag pv-tag-derived">derived</span>
                      </span>
                      <span
                        className={`font-semibold ${
                          currentParcel.mismatchDetected
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-emerald-600"
                        }`}
                      >
                        {currentParcel.observedLandUse}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground font-medium">Area</span>
                      <span className="font-bold text-foreground">
                        {currentParcel.areaHectares} hectares
                      </span>
                    </div>
                  </div>

                  {/* Confidence Score Bar */}
                  <div className="space-y-1.5 border-b border-border/60 pb-4">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-muted-foreground">Detection confidence</span>
                      <span className="text-foreground font-mono">
                        {currentParcel.confidenceScore}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                        style={{ width: `${currentParcel.confidenceScore}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">
                      * Satellite classification confidence screening score. Requires ground
                      verification.
                    </p>
                  </div>

                  {/* Possible Implications */}
                  <div className="space-y-2 border-b border-border/60 pb-4">
                    <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                      Possible Implications
                    </h3>
                    <ul className="space-y-2 text-xs">
                      {currentParcel.implications.map((imp, i) => (
                        <li key={i} className="flex items-start gap-2 text-muted-foreground">
                          {imp.type === "warning" && (
                            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                          )}
                          {imp.type === "check" && (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                          )}
                          {imp.type === "info" && (
                            <Info className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
                          )}
                          {imp.type === "success" && (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                          )}
                          <span className="text-foreground font-medium leading-snug">
                            {imp.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Recommended Actions */}
                  <div className="space-y-2.5 pt-1">
                    <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2">
                      Recommended Actions
                    </h3>

                    <Button
                      onClick={() => setShowTaskModal(true)}
                      className="w-full justify-between bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs py-2.5 shadow-sm"
                    >
                      <span>Create Verification Task</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => setShowReportModal(true)}
                      className="w-full justify-between border-border hover:bg-muted text-foreground font-medium text-xs py-2.5"
                    >
                      <span>Generate Detailed Report</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => setShowReviewModal(true)}
                      className="w-full justify-between border-border hover:bg-muted text-foreground font-medium text-xs py-2.5"
                    >
                      <span>Initiate Department Review</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Modal 1: How it Works */}
        {showHowItWorks && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-serif font-bold text-lg text-foreground">
                  How Record vs Reality Works
                </h3>
                <Button variant="ghost" size="icon" onClick={() => setShowHowItWorks(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3 text-xs text-muted-foreground">
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <div>
                    <strong className="text-foreground block font-semibold mb-0.5">
                      Select Location & Parcel
                    </strong>
                    Choose State, District, Village and Survey Number from official registries.
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div>
                    <strong className="text-foreground block font-semibold mb-0.5">
                      Spatial Overlay & Classification
                    </strong>
                    Compare cadastral boundaries against Sentinel-2 LULC satellite rasters.
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center shrink-0">
                    3
                  </span>
                  <div>
                    <strong className="text-foreground block font-semibold mb-0.5">
                      Review Mismatch Signal
                    </strong>
                    Identify potential land-use divergence, area differences, and confidence scores.
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center shrink-0">
                    4
                  </span>
                  <div>
                    <strong className="text-foreground block font-semibold mb-0.5">
                      Examine Historical Timeline & Evidence
                    </strong>
                    Inspect 5-year temporal progression and citizen/field inspector submissions.
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center shrink-0">
                    5
                  </span>
                  <div>
                    <strong className="text-foreground block font-semibold mb-0.5">
                      Trigger Verification Task
                    </strong>
                    Assign field verification tasks to local officers for legal confirmation.
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  onClick={() => setShowHowItWorks(false)}
                  className="bg-emerald-800 text-white font-medium text-xs"
                >
                  Got it
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal 2: Create Verification Task */}
        {showTaskModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-card border border-border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-emerald-700" />
                  <h3 className="font-serif font-bold text-lg text-foreground">
                    Create Field Verification Task
                  </h3>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowTaskModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-muted-foreground block mb-1">
                      Survey Number
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={selectedSurveyNo}
                      className="w-full bg-muted border border-input rounded px-2.5 py-1.5 font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-muted-foreground block mb-1">
                      Village & District
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={`${selectedVillage}, ${selectedDistrict}`}
                      className="w-full bg-muted border border-input rounded px-2.5 py-1.5"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">
                    Issue Description
                  </label>
                  <input
                    type="text"
                    value={taskForm.issue}
                    onChange={(e) => setTaskForm({ ...taskForm, issue: e.target.value })}
                    className="w-full bg-background border border-input rounded px-2.5 py-1.5 font-medium"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-muted-foreground block mb-1">
                      Priority
                    </label>
                    <select
                      value={taskForm.priority}
                      onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                      className="w-full bg-background border border-input rounded px-2.5 py-1.5"
                    >
                      <option value="High Priority">High Priority</option>
                      <option value="Medium Priority">Medium Priority</option>
                      <option value="Low Priority">Low Priority</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-muted-foreground block mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={taskForm.dueDate}
                      onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                      className="w-full bg-background border border-input rounded px-2.5 py-1.5"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">
                    Assign Department
                  </label>
                  <input
                    type="text"
                    value={taskForm.department}
                    onChange={(e) => setTaskForm({ ...taskForm, department: e.target.value })}
                    className="w-full bg-background border border-input rounded px-2.5 py-1.5"
                  />
                </div>

                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">
                    Assigned Officer
                  </label>
                  <input
                    type="text"
                    value={taskForm.officer}
                    onChange={(e) => setTaskForm({ ...taskForm, officer: e.target.value })}
                    className="w-full bg-background border border-input rounded px-2.5 py-1.5"
                  />
                </div>

                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">
                    Notes / Instructions
                  </label>
                  <textarea
                    rows={2}
                    value={taskForm.notes}
                    onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value })}
                    className="w-full bg-background border border-input rounded px-2.5 py-1.5"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setShowTaskModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-emerald-800 text-white font-medium text-xs">
                    Assign Task →
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 3: Generate Detailed Report */}
        {showReportModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-emerald-700" />
                  <h3 className="font-serif font-bold text-lg text-foreground">
                    Detailed Intelligence Report
                  </h3>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowReportModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="bg-muted/40 p-4 rounded-lg space-y-2 text-xs border border-border">
                <div className="font-bold text-foreground">
                  Report Summary — Parcel {selectedSurveyNo}
                </div>
                <div>
                  Location: {selectedVillage}, {selectedDistrict}, {selectedState}
                </div>
                <div>Official Record: {currentParcel.officialLandUse}</div>
                <div>Detected Observation: {currentParcel.observedLandUse}</div>
                <div>Satellite Confidence: {currentParcel.confidenceScore}%</div>
                <div>Timestamp: {new Date().toLocaleString("en-IN")}</div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  onClick={() => {
                    setShowReportModal(false);
                    triggerToast(`PDF Report downloaded for Survey ${selectedSurveyNo}!`);
                  }}
                  className="flex-1 bg-emerald-800 text-white font-medium text-xs gap-2"
                >
                  <Download className="h-4 w-4" /> Download PDF
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowReportModal(false);
                    triggerToast(`CSV Report downloaded for Survey ${selectedSurveyNo}!`);
                  }}
                  className="flex-1 text-xs gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4" /> Download CSV
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal 4: Initiate Department Review */}
        {showReviewModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-emerald-700" />
                  <h3 className="font-serif font-bold text-lg text-foreground">
                    Department Review Initiated
                  </h3>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowReviewModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Review workflow initiated for parcel <strong>{selectedSurveyNo}</strong> (
                {selectedVillage}). This flag has been logged to the District Land Governance
                portal.
              </p>

              <div className="bg-emerald-950/10 border border-emerald-700/30 p-3 rounded text-xs text-emerald-900 dark:text-emerald-200">
                Case Reference: <strong>REF-2026-SHR-{selectedSurveyNo.replace("/", "")}</strong>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => {
                    setShowReviewModal(false);
                    triggerToast(`Department review status updated for Survey ${selectedSurveyNo}`);
                  }}
                  className="bg-emerald-800 text-white text-xs font-semibold"
                >
                  Confirm Registration
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal 5: Capture field evidence (camera, upload, demo OCR) */}
        {showAddEvidenceModal && (
          <FieldCapture
            parcel={{
              surveyNo: currentParcel.surveyNo,
              village: currentParcel.village,
              tehsil: currentParcel.tehsil,
              district: currentParcel.district,
              officialLandUse: currentParcel.officialLandUse,
              observedLandUse: currentParcel.observedLandUse,
              areaHectares: currentParcel.areaHectares,
              lat: 18.8624,
              lon: 74.3721,
            }}
            onClose={() => setShowAddEvidenceModal(false)}
            onSubmit={handleCapturedEvidence}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
