/**
 * Land Difference — API abstraction layer.
 *
 * All UI components consume data through this service.
 * Currently backed by demo data; designed to be trivially
 * replaced with real API calls.
 *
 * Future API endpoints:
 *   GET /api/land-difference?bbox=...&from=2018&to=2024
 *   GET /api/parcels?bbox=...
 *   GET /api/land-use?bbox=...&year=2024
 *   GET /api/risk?bbox=...
 *   GET /api/disputes?bbox=...
 *   GET /api/policy?state=...
 */

import {
  LAND_TRANSITIONS,
  CHANGE_KPIS,
  DEMO_PARCELS,
  SPATIAL_IMPACT,
  POLICY_CONTEXT,
  DATA_SOURCES,
  getChangeIntensity,
  type LandTransition,
  type ChangeKPI,
  type DemoParcel,
  type SpatialImpact,
  type PolicyContext,
} from "@/data/land-difference";

export type DataMode = "demo" | "live";

let currentMode: DataMode = "demo";

export function getDataMode(): DataMode {
  return currentMode;
}

export function setDataMode(mode: DataMode): void {
  currentMode = mode;
}

export async function fetchLandTransitions(
  _state: string,
  _fromYear: string,
  _toYear: string,
): Promise<{ transitions: LandTransition[]; isDemo: boolean }> {
  // Simulate network delay
  await new Promise((r) => setTimeout(r, 400));
  return { transitions: LAND_TRANSITIONS, isDemo: true };
}

export async function fetchChangeKPIs(
  _state: string,
  _fromYear: string,
  _toYear: string,
): Promise<{ kpis: ChangeKPI[]; isDemo: boolean }> {
  await new Promise((r) => setTimeout(r, 300));
  return { kpis: CHANGE_KPIS, isDemo: true };
}

export async function fetchParcels(
  _bbox: [number, number, number, number],
  _state: string,
): Promise<{ parcels: DemoParcel[]; isDemo: boolean }> {
  await new Promise((r) => setTimeout(r, 500));
  return { parcels: DEMO_PARCELS, isDemo: true };
}

export async function fetchSpatialImpact(
  _state: string,
  _fromYear: string,
  _toYear: string,
): Promise<{ impact: SpatialImpact; isDemo: boolean }> {
  await new Promise((r) => setTimeout(r, 200));
  return { impact: SPATIAL_IMPACT, isDemo: true };
}

export async function fetchPolicyContext(
  _state: string,
): Promise<{ policy: PolicyContext; isDemo: boolean }> {
  await new Promise((r) => setTimeout(r, 150));
  return { policy: POLICY_CONTEXT, isDemo: true };
}

export function getDataSources() {
  return DATA_SOURCES;
}

export function computeChangeIntensity(transitions: LandTransition[]) {
  return getChangeIntensity(transitions);
}

export function generateAIAnalysis(parcel: DemoParcel): string {
  return `OBSERVED CHANGE\n${parcel.landUseBefore} land appears to have transitioned to ${parcel.landUseAfter} between the selected observation period.\n\nEVIDENCE\n• Satellite imagery comparison (Sentinel-2 cloudless mosaics)\n• Parcel boundary overlay (Survey No. ${parcel.surveyNo})\n• Land-use classification model output\n• Location context: ${parcel.village}, ${parcel.district}\n\nPOLICY CONTEXT\nPotentially relevant land-use conversion regulations under the applicable state land revenue code. This observation requires verification by the concerned revenue authority.\n\nRISK CONTEXT\nFlood risk: Moderate (based on proximity to water bodies)\nSeismic zone: III\n\nDISPUTE CONTEXT\nNo aggregate dispute signal available for this specific parcel.\n\nIMPORTANT: This is an AI-generated preliminary observation based on satellite imagery analysis. It does not constitute a legal determination. All findings require verification by competent authorities.`;
}
