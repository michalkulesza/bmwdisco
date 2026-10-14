import { create } from 'zustand';

interface ReportState {
  open: boolean;
  openReport: () => void;
  closeReport: () => void;
}

export const useReportStore = create<ReportState>((set) => ({
  open: false,
  openReport: () => set({ open: true }),
  closeReport: () => set({ open: false }),
}));
