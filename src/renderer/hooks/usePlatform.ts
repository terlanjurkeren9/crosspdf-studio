import { useState, useEffect } from 'react';
import type { PlatformInfo } from '../../shared/types/ipc.types';

export function usePlatform() {
  const [platform, setPlatform] = useState<PlatformInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.crosspdf
      .getPlatform()
      .then(setPlatform)
      .catch((err: Error) => setError(err.message));
  }, []);

  const isMac = platform?.platform === 'darwin';
  const isWin = platform?.platform === 'win32';
  const isLinux = platform?.platform === 'linux';

  return { platform, error, isMac, isWin, isLinux };
}
