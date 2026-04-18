import { create } from "zustand";

type WorkspaceState = {
  isBusy: boolean;
  statusMessage: string;
  setBusy: (isBusy: boolean) => void;
  setStatusMessage: (statusMessage: string) => void;
  clearStatusMessage: () => void;
  reset: () => void;
};

const initialWorkspaceState = {
  isBusy: false,
  statusMessage: "Theme management is ready. Create a theme to start tracking a reflection topic.",
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  ...initialWorkspaceState,
  setBusy: (isBusy) => set({ isBusy }),
  setStatusMessage: (statusMessage) => set({ statusMessage }),
  clearStatusMessage: () => set({ statusMessage: "" }),
  reset: () => set(initialWorkspaceState),
}));
