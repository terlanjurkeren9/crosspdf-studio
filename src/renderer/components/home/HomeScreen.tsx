import { FileText, FolderOpen, Images, Combine } from 'lucide-react';
import { useUIStore } from '../../stores/ui.store';
import { Button } from '../ui/Button';
import { RecentDocuments } from './RecentDocuments';

interface HomeScreenProps {
  onOpenFile: () => void;
  onOpenFilePath: (filePath: string) => void;
}

const quickActions = [
  {
    label: 'Open PDF',
    icon: FolderOpen,
    variant: 'primary' as const,
    action: 'open',
  },
  {
    label: 'Images to PDF',
    icon: Images,
    variant: 'secondary' as const,
    action: 'images-to-pdf',
  },
  {
    label: 'Merge PDFs',
    icon: Combine,
    variant: 'secondary' as const,
    action: 'merge',
  },
];

export function HomeScreen({ onOpenFile, onOpenFilePath }: HomeScreenProps) {
  const openDialog = useUIStore((s) => s.openDialog);
  const openPageOpsDialog = useUIStore((s) => s.openPageOpsDialog);

  const handleAction = (action: string) => {
    switch (action) {
      case 'open':
        onOpenFile();
        break;
      case 'merge':
        openPageOpsDialog('merge');
        break;
      case 'images-to-pdf':
        openDialog(action);
        break;
    }
  };

  return (
    <div className="h-full overflow-auto bg-surface-50 dark:bg-surface-950">
      <div className="mx-auto flex min-h-full max-w-4xl flex-col gap-8 px-6 py-10">
        {/* Welcome */}
        <section>
          <div className="mb-1 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-900/15">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-surface-800 dark:text-surface-100">
                CrossPDF Studio
              </h2>
              <p className="text-[13px] text-surface-400">Offline PDF workspace</p>
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-surface-400">
            Quick Actions
          </h3>
          <div className="flex flex-wrap gap-2.5">
            {quickActions.map((qa) => {
              const Icon = qa.icon;
              return (
                <Button
                  key={qa.label}
                  variant={qa.variant}
                  size="sm"
                  onClick={() => handleAction(qa.action)}
                >
                  <Icon className="h-4 w-4" />
                  {qa.label}
                </Button>
              );
            })}
          </div>
        </section>

        {/* Recent Files */}
        <section className="flex min-h-0 flex-1 flex-col">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-surface-400">
            Recent Documents
          </h3>
          <div className="flex-1 rounded-xl border border-surface-200 bg-white p-4 shadow-sm dark:border-surface-700 dark:bg-surface-800">
            <RecentDocuments onOpenFile={onOpenFilePath} />
          </div>
        </section>
      </div>
    </div>
  );
}
