import { createContext, useContext } from "react";
import type { Workspace } from "@/data/research-hub";

export type HubView =
  | "overview"
  | "discover"
  | "my-research"
  | "workspaces"
  | "gis"
  | "datasets"
  | "publications"
  | "policy-evidence"
  | "copilot"
  | "experiments"
  | "network"
  | "gaps";

export type EvidenceKind = "paper" | "dataset" | "policy" | "layer";

export interface HubApi {
  go: (view: HubView) => void;
  openWorkspace: (id: string) => void;
  workspaces: Workspace[];
  createWorkspace: (
    draft: Pick<Workspace, "title" | "question" | "state" | "topics"> & Partial<Workspace>,
  ) => Workspace;
  addToWorkspace: (kind: EvidenceKind, id: string, workspaceId?: string) => void;
  saved: string[];
  toggleSaved: (paperId: string) => void;
  openPaper: (id: string) => void;
  openDataset: (id: string) => void;
  toast: (message: string) => void;
}

export const HubContext = createContext<HubApi | null>(null);

export function useHub(): HubApi {
  const api = useContext(HubContext);
  if (!api) throw new Error("useHub must be used inside the Research Hub");
  return api;
}
