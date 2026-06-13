export interface WriteFileResult {
  success: boolean;
  error?: string;
}

export function checkWriteResult(result: WriteFileResult): void {
  if (!result.success) {
    throw new Error(result.error || 'Failed to write output file.');
  }
}
