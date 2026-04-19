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
  statusMessage:
    "反省点の準備ができています。まずは 1 件作成して、振り返りと通知の流れを試せます。",
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  ...initialWorkspaceState,
  setBusy: (isBusy) => set({ isBusy }),
  setStatusMessage: (statusMessage) => set({ statusMessage }),
  clearStatusMessage: () => set({ statusMessage: "" }),
  reset: () => set(initialWorkspaceState),
}));
