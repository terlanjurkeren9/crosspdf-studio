import { create } from 'zustand';

export interface BatchJob {
  id: string;
  type: 'merge' | 'split' | 'convert' | 'ocr' | 'redact' | 'password';
  status: 'pending' | 'running' | 'completed' | 'failed';
  inputFiles: string[];
  outputPath?: string;
  params: Record<string, unknown>;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

interface BatchState {
  jobs: BatchJob[];
  isRunning: boolean;
  addJob: (job: Omit<BatchJob, 'id' | 'status' | 'createdAt'>) => string;
  updateJob: (id: string, patch: Partial<BatchJob>) => void;
  removeJob: (id: string) => void;
  clearCompleted: () => void;
  setRunning: (running: boolean) => void;
}

export const useBatchStore = create<BatchState>((set) => ({
  jobs: [],
  isRunning: false,

  addJob: (job) => {
    const id = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newJob: BatchJob = {
      ...job,
      id,
      status: 'pending',
      createdAt: Date.now(),
    };
    set((s) => ({ jobs: [...s.jobs, newJob] }));
    return id;
  },

  updateJob: (id, patch) => {
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)),
    }));
  },

  removeJob: (id) => {
    set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) }));
  },

  clearCompleted: () => {
    set((s) => ({
      jobs: s.jobs.filter((j) => j.status !== 'completed' && j.status !== 'failed'),
    }));
  },

  setRunning: (running) => set({ isRunning: running }),
}));
