import { describe, it, expect, beforeEach } from 'vitest';
import { useBatchStore } from '../src/renderer/stores/batch.store';

function resetStore() {
  useBatchStore.setState({ jobs: [], isRunning: false });
}

describe('Batch Store', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('addJob', () => {
    it('adds a job with generated id and pending status', () => {
      const id = useBatchStore.getState().addJob({
        type: 'merge',
        inputFiles: ['/a.pdf', '/b.pdf'],
        params: {},
      });
      expect(id).toBeTruthy();

      const { jobs } = useBatchStore.getState();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].id).toBe(id);
      expect(jobs[0].status).toBe('pending');
      expect(jobs[0].type).toBe('merge');
      expect(jobs[0].inputFiles).toEqual(['/a.pdf', '/b.pdf']);
      expect(jobs[0].createdAt).toBeGreaterThan(0);
    });

    it('generates unique ids for multiple jobs', () => {
      const id1 = useBatchStore.getState().addJob({
        type: 'merge',
        inputFiles: ['/a.pdf'],
        params: {},
      });
      const id2 = useBatchStore.getState().addJob({
        type: 'split',
        inputFiles: ['/b.pdf'],
        params: {},
      });
      expect(id1).not.toBe(id2);
    });
  });

  describe('updateJob', () => {
    it('updates job fields', () => {
      const id = useBatchStore.getState().addJob({
        type: 'merge',
        inputFiles: ['/a.pdf'],
        params: {},
      });

      useBatchStore.getState().updateJob(id, { status: 'running' });
      expect(useBatchStore.getState().jobs[0].status).toBe('running');
    });

    it('sets outputPath on completion', () => {
      const id = useBatchStore.getState().addJob({
        type: 'merge',
        inputFiles: ['/a.pdf', '/b.pdf'],
        params: {},
      });

      useBatchStore.getState().updateJob(id, {
        status: 'completed',
        outputPath: '/out/merged.pdf',
        completedAt: Date.now(),
      });

      const job = useBatchStore.getState().jobs[0];
      expect(job.status).toBe('completed');
      expect(job.outputPath).toBe('/out/merged.pdf');
      expect(job.completedAt).toBeGreaterThan(0);
    });

    it('sets error on failure', () => {
      const id = useBatchStore.getState().addJob({
        type: 'merge',
        inputFiles: ['/a.pdf'],
        params: {},
      });

      useBatchStore.getState().updateJob(id, {
        status: 'failed',
        error: 'Read failed',
        completedAt: Date.now(),
      });

      const job = useBatchStore.getState().jobs[0];
      expect(job.status).toBe('failed');
      expect(job.error).toBe('Read failed');
    });

    it('does not affect other jobs', () => {
      const id1 = useBatchStore.getState().addJob({
        type: 'merge',
        inputFiles: ['/a.pdf'],
        params: {},
      });
      const id2 = useBatchStore.getState().addJob({
        type: 'split',
        inputFiles: ['/b.pdf'],
        params: {},
      });

      useBatchStore.getState().updateJob(id1, { status: 'running' });
      expect(useBatchStore.getState().jobs[1].status).toBe('pending');
      expect(useBatchStore.getState().jobs[1].id).toBe(id2);
    });
  });

  describe('removeJob', () => {
    it('removes a job by id', () => {
      const id = useBatchStore.getState().addJob({
        type: 'merge',
        inputFiles: ['/a.pdf'],
        params: {},
      });
      expect(useBatchStore.getState().jobs).toHaveLength(1);

      useBatchStore.getState().removeJob(id);
      expect(useBatchStore.getState().jobs).toHaveLength(0);
    });

    it('removes only the target job', () => {
      const id1 = useBatchStore.getState().addJob({
        type: 'merge',
        inputFiles: ['/a.pdf'],
        params: {},
      });
      useBatchStore.getState().addJob({
        type: 'split',
        inputFiles: ['/b.pdf'],
        params: {},
      });

      useBatchStore.getState().removeJob(id1);
      expect(useBatchStore.getState().jobs).toHaveLength(1);
      expect(useBatchStore.getState().jobs[0].type).toBe('split');
    });
  });

  describe('clearCompleted', () => {
    it('removes completed and failed jobs', () => {
      const id1 = useBatchStore.getState().addJob({
        type: 'merge',
        inputFiles: ['/a.pdf'],
        params: {},
      });
      const id2 = useBatchStore.getState().addJob({
        type: 'merge',
        inputFiles: ['/b.pdf'],
        params: {},
      });
      const id3 = useBatchStore.getState().addJob({
        type: 'merge',
        inputFiles: ['/c.pdf'],
        params: {},
      });

      useBatchStore.getState().updateJob(id1, { status: 'completed' });
      useBatchStore.getState().updateJob(id2, { status: 'failed' });
      // id3 stays pending

      useBatchStore.getState().clearCompleted();
      const remaining = useBatchStore.getState().jobs;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(id3);
      expect(remaining[0].status).toBe('pending');
    });

    it('keeps running and pending jobs', () => {
      const id1 = useBatchStore.getState().addJob({
        type: 'merge',
        inputFiles: ['/a.pdf'],
        params: {},
      });
      useBatchStore.getState().addJob({
        type: 'merge',
        inputFiles: ['/b.pdf'],
        params: {},
      });

      useBatchStore.getState().updateJob(id1, { status: 'running' });

      useBatchStore.getState().clearCompleted();
      expect(useBatchStore.getState().jobs).toHaveLength(2);
    });
  });

  describe('setRunning', () => {
    it('sets isRunning flag', () => {
      expect(useBatchStore.getState().isRunning).toBe(false);

      useBatchStore.getState().setRunning(true);
      expect(useBatchStore.getState().isRunning).toBe(true);

      useBatchStore.getState().setRunning(false);
      expect(useBatchStore.getState().isRunning).toBe(false);
    });
  });
});
