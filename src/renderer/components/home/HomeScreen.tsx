import { FilePlus2, FileText, FolderOpen, Images, ShieldCheck } from 'lucide-react';
import { useUIStore } from '../../stores/ui.store';
import { Button } from '../ui/Button';
import { RecentDocuments } from './RecentDocuments';

interface HomeScreenProps {
  onOpenFile: () => void;
  onOpenFilePath: (filePath: string) => void;
}

export function HomeScreen({ onOpenFile, onOpenFilePath }: HomeScreenProps) {
  const openDialog = useUIStore((s) => s.openDialog);

  return (
    <div className="h-full overflow-auto bg-surface-50 dark:bg-surface-950">
      <div className="mx-auto grid min-h-full max-w-6xl grid-cols-1 gap-6 px-8 py-8 xl:h-full xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="flex min-h-0 flex-col">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-600 text-white shadow-sm shadow-brand-900/20">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-surface-950 dark:text-surface-50">
                CrossPDF Studio
              </h2>
              <p className="text-sm text-surface-500 dark:text-surface-400">
                Offline PDF editing workspace
              </p>
            </div>
          </div>

          <div className="min-h-0 flex-1 rounded-md border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-800 dark:bg-surface-900">
            <RecentDocuments onOpenFile={onOpenFilePath} />
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-md border border-surface-200 bg-white p-3 shadow-sm dark:border-surface-800 dark:bg-surface-900">
            <h3 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-surface-500">
              Start
            </h3>
            <div className="space-y-2">
              <Button onClick={onOpenFile} className="w-full justify-start">
                <FolderOpen className="h-4 w-4" />
                Open PDF
              </Button>
              <Button
                variant="secondary"
                onClick={() => openDialog('images-to-pdf')}
                className="w-full justify-start"
              >
                <Images className="h-4 w-4" />
                Images to PDF
              </Button>
            </div>
          </div>

          <div className="rounded-md border border-surface-200 bg-white p-4 text-sm shadow-sm dark:border-surface-800 dark:bg-surface-900">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-surface-500">
              Common tools
            </h3>
            <div className="space-y-3 text-surface-600 dark:text-surface-300">
              <div className="flex items-center gap-2">
                <FilePlus2 className="h-4 w-4 text-brand-600" />
                Merge, split, extract, reorder
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-brand-600" />
                Redaction and password protection
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-brand-600" />
                OCR, comments, highlights
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
