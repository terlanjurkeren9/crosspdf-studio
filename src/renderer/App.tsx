import { useCallback, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { AppShell } from './components/layout/AppShell';
import { HomeScreen } from './components/home/HomeScreen';
import { PdfViewer } from './components/viewer/PdfViewer';
import type { PdfViewerHandle } from './components/viewer/PdfViewer';
import { useUIStore } from './stores/ui.store';
import { useDocumentStore } from './stores/document.store';

export default function App() {
  const theme = useUIStore((s) => s.theme);
  const tabs = useDocumentStore((s) => s.tabs);
  const activeTabId = useDocumentStore((s) => s.activeTabId);
  const openTab = useDocumentStore((s) => s.openTab);
  const closeTab = useDocumentStore((s) => s.closeTab);
  const setSidebarPanel = useUIStore((s) => s.setSidebarPanel);

  const [activePdfDocument, setActivePdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [activeNumPages, setActiveNumPages] = useState(0);
  const [searchAutoFocus, setSearchAutoFocus] = useState(false);

  const viewerRef = useRef<PdfViewerHandle | null>(null);

  // Theme
  useEffect(() => {
    const root = document.documentElement;
    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  // Open file dialog
  const handleOpenFileDialog = useCallback(async () => {
    try {
      const result = await window.crosspdf.openFileDialog();
      if (result.canceled || result.filePaths.length === 0) return;

      const path = result.filePaths[0];
      const name = path.split(/[/\\]/).pop() ?? path;

      openTab(path, name);

      // Save to recent documents
      window.crosspdf.upsertRecentDocument(path, name).catch(() => {
        // Ignore — recent documents update is best-effort
      });
    } catch (err) {
      console.error('Open file error:', err);
    }
  }, [openTab]);

  // Open file by path (for recent documents)
  const handleOpenFilePath = useCallback(
    async (filePath: string) => {
      try {
        // Verify file exists via preload read
        const result = await window.crosspdf.readFile(filePath);
        if (!result.success) {
          console.error('Failed to read file:', result.error);
          return;
        }

        const name = filePath.split(/[/\\]/).pop() ?? filePath;
        openTab(filePath, name);

        // Update recent document timestamp
        window.crosspdf.upsertRecentDocument(filePath, name).catch(() => {
          // Ignore
        });
      } catch (err) {
        console.error('Open file error:', err);
      }
    },
    [openTab]
  );

  // Handle PDF document loaded from PdfViewer
  const handlePdfDocumentLoaded = useCallback((doc: PDFDocumentProxy | null) => {
    setActivePdfDocument(doc);
    if (doc) {
      setActiveNumPages(doc.numPages);
    } else {
      setActiveNumPages(0);
    }
  }, []);

  // Handle goToPage from sidebar
  const handleNavigateToPage = useCallback((pageNumber: number) => {
    viewerRef.current?.goToPage(pageNumber);
  }, []);

  // Keyboard shortcuts: Ctrl+O, Ctrl+W, Ctrl+F, Ctrl+T
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;

      if (meta && (e.key === 'o' || e.key === 't')) {
        e.preventDefault();
        handleOpenFileDialog();
      } else if (meta && e.key === 'w') {
        e.preventDefault();
        if (activeTabId) {
          closeTab(activeTabId);
        }
      } else if (meta && e.key === 'f') {
        e.preventDefault();
        setSearchAutoFocus(true);
        setSidebarPanel('search');
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleOpenFileDialog, closeTab, activeTabId, setSidebarPanel]);

  const hasOpenDocument = tabs.length > 0;
  const activeCurrentPage = activeTab?.currentPage ?? 1;

  return (
    <AppShell
      tabs={tabs}
      activeTabId={activeTabId}
      activePdfDocument={activePdfDocument}
      activeNumPages={activeNumPages}
      activeCurrentPage={activeCurrentPage}
      searchAutoFocus={searchAutoFocus}
      hasOpenDocument={hasOpenDocument}
      onOpenFile={handleOpenFileDialog}
      onNavigateToPage={handleNavigateToPage}
    >
      {activeTab ? (
        <PdfViewer
          key={activeTab.id}
          tab={activeTab}
          onOpenAnother={handleOpenFileDialog}
          onPdfDocumentLoaded={handlePdfDocumentLoaded}
          viewerRef={viewerRef}
        />
      ) : (
        <HomeScreen onOpenFile={handleOpenFileDialog} onOpenFilePath={handleOpenFilePath} />
      )}
    </AppShell>
  );
}
