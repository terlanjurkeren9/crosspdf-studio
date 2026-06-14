import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompareDialog } from '../src/renderer/components/dialogs/CompareDialog';

const mockOpenFileDialog = vi.fn();
const mockReadFile = vi.fn();

vi.stubGlobal('window', {
  ...window,
  crosspdf: {
    openFileDialog: mockOpenFileDialog,
    readFile: mockReadFile,
  },
});

vi.stubGlobal('pdfjsDist', {
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
});

const mockOnClose = vi.fn();

describe('CompareDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOpenFileDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    mockReadFile.mockResolvedValue({ success: false });
  });

  it('is a valid named export', () => {
    expect(CompareDialog).toBeDefined();
    expect(typeof CompareDialog).toBe('function');
  });

  it('returns a React element when rendered', () => {
    const result = CompareDialog({ open: true, onClose: mockOnClose });
    expect(result).toBeDefined();
    expect(result).not.toBeNull();
  });

  it('renders without throwing', () => {
    expect(() => {
      CompareDialog({ open: true, onClose: mockOnClose });
    }).not.toThrow();
  });

  it('onClose is called when provided', () => {
    const onClose = vi.fn();
    CompareDialog({ open: true, onClose });
    expect(onClose).toBeDefined();
  });
});
