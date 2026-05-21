import { usePlatform } from '../../hooks/usePlatform';
import { Button } from '../ui/Button';
import { RecentDocuments } from './RecentDocuments';

interface HomeScreenProps {
  onOpenFile: () => void;
  onOpenFilePath: (filePath: string) => void;
}

export function HomeScreen({ onOpenFile, onOpenFilePath }: HomeScreenProps) {
  const { platform, isMac } = usePlatform();

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Logo / Brand */}
        <div className="space-y-3">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-brand-500 flex items-center justify-center">
            <span className="text-white text-2xl font-bold">CP</span>
          </div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
            CrossPDF Studio
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            Professional cross-platform PDF editor
          </p>
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <Button onClick={onOpenFile} className="w-full">
            Open PDF Document
          </Button>
          <p className="text-xs text-surface-400">
            Press{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-surface-200 dark:bg-surface-700 text-surface-500 text-xs">
              Ctrl+O
            </kbd>{' '}
            to open a PDF file
          </p>
        </div>

        {/* Recent Documents */}
        <RecentDocuments onOpenFile={onOpenFilePath} />

        {/* System Info */}
        {platform && (
          <div className="pt-6 border-t border-surface-200 dark:border-surface-800">
            <div className="grid grid-cols-2 gap-2 text-xs text-surface-400">
              <span className="text-right">Platform</span>
              <span className="text-left text-surface-600 dark:text-surface-300">
                {isMac ? 'macOS' : platform.platform}
              </span>
              <span className="text-right">Arch</span>
              <span className="text-left text-surface-600 dark:text-surface-300">
                {platform.arch}
              </span>
              <span className="text-right">Electron</span>
              <span className="text-left text-surface-600 dark:text-surface-300">
                {platform.electronVersion}
              </span>
              <span className="text-right">Chrome</span>
              <span className="text-left text-surface-600 dark:text-surface-300">
                {platform.chromeVersion}
              </span>
              <span className="text-right">Node</span>
              <span className="text-left text-surface-600 dark:text-surface-300">
                {platform.nodeVersion}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
