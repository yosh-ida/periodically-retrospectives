import { create } from "zustand";

type WorkspaceState = {
  isBusy: boolean;
  statusMessage: string;
  setBusy: (isBusy: boolean) => void;
  setStatusMessage: (statusMessage: string) => void;
  reset: () => void;
};

const initialWorkspaceState = {
  isBusy: false,
  statusMessage:
    "Phase 1 foundation is active. Only the core domain and storage layer are enabled.",
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  ...initialWorkspaceState,
  setBusy: (isBusy) => set({ isBusy }),
  setStatusMessage: (statusMessage) => set({ statusMessage }),
  reset: () => set(initialWorkspaceState),
}));
