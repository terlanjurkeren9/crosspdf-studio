import { useCallback, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { AppShell } from './components/layout/AppShell';
import { HomeScreen } from './components/home/HomeScreen';
import { PdfViewer } from './components/viewer/PdfViewer';
import type { PdfViewerHandle } from './components/viewer/PdfViewer';
import { MergeDialog } from './components/dialogs/MergeDialog';
import { SplitDialog } from './components/dialogs/SplitDialog';
import { ExtractPagesDialog } from './components/dialogs/ExtractPagesDialog';
import { DeletePagesDialog } from './components/dialogs/DeletePagesDialog';
import { ReorderDialog } from './components/dialogs/ReorderDialog';
import { OcrDialog } from './components/dialogs/OcrDialog';
import { FormsDialog } from './components/dialogs/FormsDialog';
import { PasswordDialog } from './components/dialogs/PasswordDialog';
import { PasswordProtectionDialog } from './components/dialogs/PasswordProtectionDialog';
import { PreferencesDialog } from './components/dialogs/PreferencesDialog';
import { RedactionDialog } from './components/dialogs/RedactionDialog';
import { PdfToImagesDialog } from './components/dialogs/PdfToImagesDialog';
import { ImagesToPdfDialog } from './components/dialogs/ImagesToPdfDialog';
import { deletePages } from './services/pdf-ops.service';
import { renderRedactedPages } from './services/redaction.service';
import { applyRedactions } from './services/pdf-ops.service';
import type { RedactionAnnotation } from './types/annotation.types';
import { isRedaction } from './types/annotation.types';
import { useUIStore } from './stores/ui.store';
import { useDocumentStore } from './stores/document.store';
import { useAnnotationStore } from './stores/annotation.store';

export default function App() {
  const theme = useUIStore((s) => s.theme);
  const tabs = useDocumentStore((s) => s.tabs);
  const activeTabId = useDocumentStore((s) => s.activeTabId);
  const openTab = useDocumentStore((s) => s.openTab);
  const closeTab = useDocumentStore((s) => s.closeTab);
  const setSidebarPanel = useUIStore((s) => s.setSidebarPanel);
  const activePageOpsDialog = useUIStore((s) => s.activePageOpsDialog);
  const activeDialog = useUIStore((s) => s.activeDialog);
  const dialogProps = useUIStore((s) => s.dialogProps);
  const pageOpsDialogProps = useUIStore((s) => s.pageOpsDialogProps);
  const closePageOpsDialog = useUIStore((s) => s.closePageOpsDialog);
  const closeDialog = useUIStore((s) => s.closeDialog);

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

      // Check if file is password-protected
      try {
        const checkResult = await window.crosspdf.checkEncrypted(path);
        if (checkResult.success && checkResult.isEncrypted) {
          // Show password dialog instead of opening directly
          useUIStore.getState().openDialog('password', {
            filePath: path,
            fileName: name,
          });
          return;
        }
      } catch {
        // If check fails, try normal open anyway
      }

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
        const name = filePath.split(/[/\\]/).pop() ?? filePath;

        // Verify file exists via preload read
        const result = await window.crosspdf.readFile(filePath);
        if (!result.success) {
          console.error('Failed to read file:', result.error);
          return;
        }

        // Check if file is password-protected
        try {
          const checkResult = await window.crosspdf.checkEncrypted(filePath);
          if (checkResult.success && checkResult.isEncrypted) {
            useUIStore.getState().openDialog('password', {
              filePath,
              fileName: name,
            });
            // Update recent timestamp after showing dialog (best-effort)
            window.crosspdf.upsertRecentDocument(filePath, name).catch(() => {
              // Ignore
            });
            return;
          }
        } catch {
          // If check fails, try normal open anyway
        }

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
      } else if (meta && e.key === ',') {
        e.preventDefault();
        useUIStore.getState().openDialog('preferences');
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleOpenFileDialog, closeTab, activeTabId, setSidebarPanel]);

  // Listen for crosspdf:open-file custom events (fired by dialogs after ops)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ filePath: string }>).detail;
      if (detail?.filePath) {
        handleOpenFilePath(detail.filePath);
      }
    };
    window.addEventListener('crosspdf:open-file', handler);
    return () => window.removeEventListener('crosspdf:open-file', handler);
  }, [handleOpenFilePath]);

  // Delete page handler
  const handleDeleteConfirm = useCallback(async () => {
    const props = pageOpsDialogProps as {
      pages?: number[];
      numPages?: number;
      filePath?: string;
      fileName?: string;
    };
    const pages = props?.pages ?? [];
    const filePath = props?.filePath ?? activeTab?.filePath;
    const fileName = props?.fileName ?? activeTab?.fileName ?? 'document';

    if (!filePath || pages.length === 0) return;

    try {
      const readResult = await window.crosspdf.readFile(filePath);
      if (!readResult.success || !readResult.data) throw new Error('Failed to read file');

      const result = await deletePages(readResult.data, pages);

      const saveResult = await window.crosspdf.saveFileDialog({
        defaultPath: fileName.replace('.pdf', '') + '-deleted.pdf',
        filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
      });
      if (saveResult.canceled || !saveResult.filePath) return;

      await window.crosspdf.writeFile(saveResult.filePath, result.buffer as ArrayBuffer);

      closePageOpsDialog();
      const openNow = confirm(
        `${pages.length === 1 ? 'Page' : 'Pages'} ${pages.join(', ')} deleted.\nOpen the result?`
      );
      if (openNow) {
        handleOpenFilePath(saveResult.filePath);
      }
    } catch (err) {
      console.error('Delete pages failed:', err);
      alert('Delete failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }, [pageOpsDialogProps, activeTab, closePageOpsDialog, handleOpenFilePath]);

  // ── Redaction apply handler ─────────────────────────────────

  const handleRedactionConfirm = useCallback(async () => {
    const props = dialogProps as {
      totalRedactions?: number;
      affectedPages?: number[];
      filePath?: string;
      fileName?: string;
      tabId?: string;
    };
    const filePath = props?.filePath ?? activeTab?.filePath;
    const fileName = props?.fileName ?? activeTab?.fileName ?? 'document';
    const tabId = props?.tabId ?? activeTab?.id;

    if (!filePath || !tabId) return;

    closeDialog();

    try {
      const allAnnotations = useAnnotationStore.getState().annotationsByTab[tabId] ?? [];
      const redactions = allAnnotations.filter((a): a is RedactionAnnotation => isRedaction(a));

      if (redactions.length === 0) {
        alert('No redaction marks to apply.');
        return;
      }

      // Build per-page redaction map
      const redactionsByPage = new Map<number, RedactionAnnotation[]>();
      for (const r of redactions) {
        const list = redactionsByPage.get(r.pageNumber) ?? [];
        list.push(r);
        redactionsByPage.set(r.pageNumber, list);
      }

      // Read source file
      const readResult = await window.crosspdf.readFile(filePath);
      if (!readResult.success || !readResult.data) {
        throw new Error('Failed to read source file');
      }

      // Render redacted pages to PNGs (with burns)
      const totalPages = activeNumPages;
      const renderedRedactedPages = await renderRedactedPages(
        readResult.data,
        redactionsByPage,
        totalPages
      );

      if (renderedRedactedPages.length === 0) {
        throw new Error('Failed to render any redacted pages');
      }

      // Apply redactions via worker
      const resultBytes = await applyRedactions(readResult.data, renderedRedactedPages);

      // Save As dialog
      const defaultName = fileName.replace(/\.pdf$/i, '') + '-redacted.pdf';
      const saveResult = await window.crosspdf.saveFileDialog({
        defaultPath: defaultName,
        filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
      });
      if (saveResult.canceled || !saveResult.filePath) return;

      await window.crosspdf.writeFile(saveResult.filePath, resultBytes.buffer as ArrayBuffer);

      const openNow = confirm(
        'Redactions applied successfully.\n\n' +
          `${redactions.length} mark(s) across ${renderedRedactedPages.length} page(s) burned.\n` +
          'Redacted pages are now image-only (text not selectable/searchable).\n\n' +
          'Open the result?'
      );
      if (openNow) {
        handleOpenFilePath(saveResult.filePath);
      }
    } catch (err) {
      console.error('Redaction apply failed:', err);
      alert('Redaction apply failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }, [dialogProps, activeTab, closeDialog, handleOpenFilePath, activeNumPages]);

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

      {/* Page ops dialogs */}
      <MergeDialog open={activePageOpsDialog === 'merge'} onClose={closePageOpsDialog} />

      {activeTab && (
        <SplitDialog
          open={activePageOpsDialog === 'split'}
          onClose={closePageOpsDialog}
          sourceFilePath={activeTab.filePath}
          sourceFileName={activeTab.fileName}
          totalPages={activeNumPages}
        />
      )}

      {activeTab && (
        <ExtractPagesDialog
          open={activePageOpsDialog === 'extract'}
          onClose={closePageOpsDialog}
          sourceFilePath={activeTab.filePath}
          sourceFileName={activeTab.fileName}
          totalPages={activeNumPages}
          preSelectedPages={(pageOpsDialogProps as { pages?: number[] })?.pages}
        />
      )}

      <DeletePagesDialog
        open={activePageOpsDialog === 'delete'}
        onClose={closePageOpsDialog}
        onConfirm={handleDeleteConfirm}
        pages={(pageOpsDialogProps as { pages?: number[] })?.pages ?? []}
      />

      {activeTab && (
        <ReorderDialog
          open={activePageOpsDialog === 'reorder'}
          onClose={closePageOpsDialog}
          sourceFilePath={activeTab.filePath}
          sourceFileName={activeTab.fileName}
          totalPages={activeNumPages}
        />
      )}

      {/* Phase 4 dialogs — conditionally rendered for clean mount/unmount */}
      {activeDialog === 'ocr' && activeTab && (
        <OcrDialog
          key={`ocr-${activeDialog === 'ocr'}`}
          open={true}
          onClose={closeDialog}
          filePath={activeTab.filePath}
          fileName={activeTab.fileName}
          numPages={activeNumPages}
          password={activeTab.password}
        />
      )}

      {activeDialog === 'forms' && activeTab && (
        <FormsDialog
          key={`forms-${activeDialog === 'forms'}`}
          open={true}
          onClose={closeDialog}
          filePath={activeTab.filePath}
          fileName={activeTab.fileName}
        />
      )}

      {activeDialog === 'password-protection' && activeTab && (
        <PasswordProtectionDialog
          key={`password-protection-${activeDialog === 'password-protection'}`}
          open={true}
          onClose={closeDialog}
          filePath={activeTab.filePath}
          fileName={activeTab.fileName}
          onPasswordChanged={(password) => {
            useDocumentStore.getState().updateTabState(activeTab.id, { password });
          }}
        />
      )}

      {activeDialog === 'password' && (
        <PasswordDialog
          key={`password-${activeDialog === 'password'}`}
          open={true}
          onClose={closeDialog}
          filePath={(dialogProps as { filePath?: string }).filePath ?? ''}
          fileName={(dialogProps as { fileName?: string }).fileName ?? ''}
          onSuccess={(_data, password) => {
            const filePath = (dialogProps as { filePath?: string }).filePath ?? '';
            const fileName =
              (dialogProps as { fileName?: string }).fileName ??
              filePath.split(/[/\\]/).pop() ??
              filePath;
            openTab(filePath, fileName, password);
            closeDialog();
          }}
        />
      )}

      {activeDialog === 'redaction' && (
        <RedactionDialog
          key={`redaction-${activeDialog === 'redaction'}`}
          open={true}
          onClose={closeDialog}
          onConfirm={handleRedactionConfirm}
          affectedPages={(dialogProps as { affectedPages?: number[] }).affectedPages ?? []}
          totalRedactions={(dialogProps as { totalRedactions?: number }).totalRedactions ?? 0}
        />
      )}

      {activeDialog === 'pdf-to-images' && activeTab && (
        <PdfToImagesDialog
          key={`pdf-to-images-${activeDialog === 'pdf-to-images'}`}
          open={true}
          onClose={closeDialog}
          filePath={(dialogProps as { filePath?: string }).filePath ?? activeTab.filePath}
          fileName={(dialogProps as { fileName?: string }).fileName ?? activeTab.fileName}
          numPages={(dialogProps as { numPages?: number }).numPages ?? activeNumPages}
        />
      )}

      {activeDialog === 'images-to-pdf' && (
        <ImagesToPdfDialog
          key={`images-to-pdf-${activeDialog === 'images-to-pdf'}`}
          open={true}
          onClose={closeDialog}
        />
      )}

      {activeDialog === 'preferences' && (
        <PreferencesDialog
          key={`preferences-${activeDialog === 'preferences'}`}
          open={true}
          onClose={closeDialog}
        />
      )}
    </AppShell>
  );
}
