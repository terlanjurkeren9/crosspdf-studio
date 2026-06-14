import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useTranslation } from 'react-i18next';
import { AppShell } from './components/layout/AppShell';
import { HomeScreen } from './components/home/HomeScreen';
import { PdfViewer } from './components/viewer/PdfViewer';
import type { PdfViewerHandle } from './components/viewer/PdfViewer';
import { CommandPalette } from './components/command/CommandPalette';
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
import { SignatureDialog } from './components/dialogs/SignatureDialog';
import { CompareDialog } from './components/dialogs/CompareDialog';
import { BatchDialog } from './components/dialogs/BatchDialog';
import { ValidateDialog } from './components/dialogs/ValidateDialog';
import { deletePages } from './services/pdf-ops.service';
import { renderRedactedPages } from './services/redaction.service';
import { applyRedactions } from './services/pdf-ops.service';
import type { RedactionAnnotation } from './types/annotation.types';
import { isRedaction } from './types/annotation.types';
import { useUIStore } from './stores/ui.store';
import { useDocumentStore, type TabState } from './stores/document.store';
import { useAnnotationStore } from './stores/annotation.store';
import {
  COMMAND_DEFINITIONS,
  isCommandPaletteShortcut,
  type CommandItem,
} from './lib/command-palette';

export default function App() {
  const { t } = useTranslation();
  const theme = useUIStore((s) => s.theme);
  const tabs = useDocumentStore((s) => s.tabs);
  const activeTabId = useDocumentStore((s) => s.activeTabId);
  const openTab = useDocumentStore((s) => s.openTab);
  const restoreSession = useDocumentStore((s) => s.restoreSession);
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
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const viewerRef = useRef<PdfViewerHandle | null>(null);

  // Session restore — skip during E2E tests to avoid stale persisted tabs
  useEffect(() => {
    if (window.crosspdf.isE2E) return;
    window.crosspdf
      .loadSession()
      .then((session) => {
        if (session && session.tabs && Array.isArray(session.tabs) && session.tabs.length > 0) {
          restoreSession(session.tabs as TabState[], session.activeTabId);
        }
      })
      .catch(console.error);
  }, [restoreSession]);

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

  // Auto-update status push subscription
  useEffect(() => {
    const unsubscribe = window.crosspdf.onUpdateStatus((state) => {
      const showToast = useUIStore.getState().showToast;
      if (state.status === 'downloaded') {
        showToast('Update downloaded. Restart to install.');
      }
    });
    return unsubscribe;
  }, []);

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

  const commands = useMemo<CommandItem[]>(() => {
    const runCommand = (id: string) => {
      switch (id) {
        case 'file.open':
          return handleOpenFileDialog();
        case 'file.save':
          return viewerRef.current?.save();
        case 'file.saveAs':
          return viewerRef.current?.saveAs();
        case 'file.print':
          return viewerRef.current?.print();
        case 'view.zoomIn':
          return viewerRef.current?.zoomIn();
        case 'view.zoomOut':
          return viewerRef.current?.zoomOut();
        case 'view.fitPage':
          return viewerRef.current?.setFitMode('fit-page');
        case 'view.fitWidth':
          return viewerRef.current?.setFitMode('fit-width');
        case 'view.actualSize':
          return viewerRef.current?.setFitMode('actual');
        case 'view.handTool':
          return viewerRef.current?.setTool('hand');
        case 'view.selectTool':
          return viewerRef.current?.setTool('select');
        case 'navigation.nextPage':
          return viewerRef.current?.nextPage();
        case 'navigation.previousPage':
          return viewerRef.current?.previousPage();
        case 'navigation.goToPage': {
          const value = window.prompt(t('commandPalette.goToPagePrompt'));
          const page = value ? Number.parseInt(value, 10) : Number.NaN;
          if (!Number.isNaN(page)) viewerRef.current?.goToPage(page);
          return;
        }
        case 'annotate.highlight':
          return viewerRef.current?.setTool('highlight');
        case 'annotate.underline':
          return viewerRef.current?.setTool('underline');
        case 'annotate.strikeout':
          return viewerRef.current?.setTool('strikeout');
        case 'annotate.note':
          return viewerRef.current?.setTool('sticky-note');
        case 'annotate.addText':
          return viewerRef.current?.setTool('free-text');
        case 'app.preferences':
          return useUIStore.getState().openDialog('preferences');
        case 'app.closeTab':
          if (activeTabId) closeTab(activeTabId);
          return;
      }
    };

    return COMMAND_DEFINITIONS.map((command) => ({
      ...command,
      label: t(command.labelKey),
      disabled: command.requiresDocument ? !activeTab : false,
      run: () => runCommand(command.id),
    }));
  }, [activeTab, activeTabId, closeTab, handleOpenFileDialog, t]);

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

  // Keyboard shortcuts: Ctrl+O, Ctrl+W, Ctrl+F, Ctrl+K, Ctrl+T
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;

      if (isCommandPaletteShortcut(e)) {
        e.preventDefault();
        setCommandPaletteOpen((open) => !open);
      } else if (meta && (e.key === 'o' || e.key === 't')) {
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
      onOpenFilePath={handleOpenFilePath}
      onNavigateToPage={handleNavigateToPage}
    >
      {activeTab ? (
        <PdfViewer
          key={activeTab.id}
          tab={activeTab}
          onOpenAnother={handleOpenFileDialog}
          onCommandPalette={() => setCommandPaletteOpen(true)}
          onPdfDocumentLoaded={handlePdfDocumentLoaded}
          viewerRef={viewerRef}
        />
      ) : (
        <HomeScreen onOpenFile={handleOpenFileDialog} onOpenFilePath={handleOpenFilePath} />
      )}

      {commandPaletteOpen && (
        <CommandPalette
          open={true}
          commands={commands}
          onClose={() => setCommandPaletteOpen(false)}
        />
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
          password={activeTab.password}
        />
      )}

      {activeDialog === 'images-to-pdf' && (
        <ImagesToPdfDialog
          key={`images-to-pdf-${activeDialog === 'images-to-pdf'}`}
          open={true}
          onClose={closeDialog}
        />
      )}

      {activeDialog === 'signature' && (
        <SignatureDialog
          key={`signature-${activeDialog === 'signature'}`}
          open={true}
          onClose={closeDialog}
          activeFile={activeTab?.filePath ?? null}
          activeFileName={activeTab?.fileName ?? null}
        />
      )}

      {activeDialog === 'compare' && (
        <CompareDialog
          key={`compare-${activeDialog === 'compare'}`}
          open={true}
          onClose={closeDialog}
        />
      )}

      {activeDialog === 'batch' && (
        <BatchDialog key={`batch-${activeDialog === 'batch'}`} open={true} onClose={closeDialog} />
      )}

      {activeDialog === 'validate' && (
        <ValidateDialog
          key={`validate-${activeDialog === 'validate'}`}
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
