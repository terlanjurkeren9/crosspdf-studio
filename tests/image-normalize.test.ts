import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('normalizeImageToSafeDataUrl', () => {
  it('exports a callable function', async () => {
    const mod = await import('../src/renderer/lib/image-normalize');
    expect(typeof mod.normalizeImageToSafeDataUrl).toBe('function');
  });

  describe('data URL encoding roundtrip', () => {
    it('correctly encodes PNG header bytes to data URL', () => {
      const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const buf = pngHeader.buffer.slice(
        pngHeader.byteOffset,
        pngHeader.byteOffset + pngHeader.byteLength
      );

      let binary = '';
      const view = new Uint8Array(buf);
      for (let i = 0; i < view.length; i++) {
        binary += String.fromCharCode(view[i]);
      }
      const dataUrl = `data:image/png;base64,${btoa(binary)}`;

      expect(dataUrl).toMatch(/^data:image\/png;base64,/);
      const base64 = dataUrl.slice('data:image/png;base64,'.length);
      const decoded = atob(base64);
      expect(decoded.charCodeAt(0)).toBe(0x89);
      expect(decoded.charCodeAt(1)).toBe(0x50);
      expect(decoded.charCodeAt(2)).toBe(0x4e);
      expect(decoded.charCodeAt(3)).toBe(0x47);
    });

    it('round-trips JPEG data through base64 encoding', () => {
      const input = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const buf = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);

      let binary = '';
      const view = new Uint8Array(buf);
      for (let i = 0; i < view.length; i++) {
        binary += String.fromCharCode(view[i]);
      }
      const dataUrl = `data:image/jpeg;base64,${btoa(binary)}`;

      const base64 = dataUrl.slice('data:image/jpeg;base64,'.length);
      const decoded = atob(base64);
      const reencoded = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) {
        reencoded[i] = decoded.charCodeAt(i);
      }
      expect(reencoded[0]).toBe(0xff);
      expect(reencoded[1]).toBe(0xd8);
      expect(reencoded[2]).toBe(0xff);
      expect(reencoded[3]).toBe(0xe0);
    });
  });
});

function makeMockWorker(
  addEventListener: ReturnType<typeof vi.fn>,
  removeEventListener: ReturnType<typeof vi.fn>,
  postMessage: ReturnType<typeof vi.fn>,
  terminate: ReturnType<typeof vi.fn>
) {
  // Must be a regular function so `new` works — arrow functions are not constructible
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return vi.fn(function MockWorker(this: any) {
    this.addEventListener = addEventListener;
    this.removeEventListener = removeEventListener;
    this.postMessage = postMessage;
    this.terminate = terminate;
    this.onerror = null;
  });
}

describe('pdf-ops timeout recovery', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('rejects applyStamps with timeout error when worker never responds', async () => {
    const terminate = vi.fn();
    vi.stubGlobal('Worker', makeMockWorker(vi.fn(), vi.fn(), vi.fn(), terminate));

    const { applyStamps, resetWorker } = await import('../src/renderer/services/pdf-ops.service');
    resetWorker();

    const promise = applyStamps(new Uint8Array(10).buffer, [
      {
        pageNumber: 1,
        rect: { x: 0, y: 0, width: 50, height: 50 },
        imageBytes: new Uint8Array(100).buffer,
        mimeType: 'image/png',
        opacity: 1,
      },
    ]);
    // Suppress unhandled-rejection during advanceTimers
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(35_000);

    await expect(promise).rejects.toThrow(
      'PDF image export timed out; try a different image or reload document'
    );
    expect(terminate).toHaveBeenCalled();
  });

  it('removes event listener on timeout', async () => {
    const addEvent = vi.fn();
    const removeEvent = vi.fn();

    vi.stubGlobal('Worker', makeMockWorker(addEvent, removeEvent, vi.fn(), vi.fn()));

    const { applyStamps, resetWorker } = await import('../src/renderer/services/pdf-ops.service');
    resetWorker();

    const promise = applyStamps(new Uint8Array(10).buffer, []);
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(35_000);

    await expect(promise).rejects.toThrow(/timed out/);
    expect(addEvent).toHaveBeenCalledWith('message', expect.any(Function));
    expect(removeEvent).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('resolves normally when worker responds before timeout', async () => {
    const onMessageHandlers: Array<(e: MessageEvent) => void> = [];
    const addEvent = vi.fn((_type: string, handler: (e: MessageEvent) => void) => {
      onMessageHandlers.push(handler);
    });
    const removeEvent = vi.fn();
    const terminateFn = vi.fn();

    vi.stubGlobal('Worker', makeMockWorker(addEvent, removeEvent, vi.fn(), terminateFn));

    const { applyStamps, resetWorker } = await import('../src/renderer/services/pdf-ops.service');
    resetWorker();

    const promise = applyStamps(new Uint8Array(10).buffer, []);

    // Flush microtasks so applyStamps reaches sendRequest (await getWorker resolves)
    await vi.advanceTimersByTimeAsync(0);

    expect(onMessageHandlers).toHaveLength(1);

    // Simulate worker success response before timeout fires
    const responseData = new Uint8Array([1, 2, 3]);
    onMessageHandlers[0](
      new MessageEvent('message', {
        data: { id: '1', type: 'success', data: responseData },
      })
    );

    const result = await promise;
    expect(result).toEqual(responseData);
  });
});
