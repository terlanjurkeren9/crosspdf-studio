export async function normalizeImageToSafeDataUrl(
  imageBytes: ArrayBuffer,
  mimeType: string
): Promise<{ dataUrl: string; width: number; height: number }> {
  const bytes = new Uint8Array(imageBytes);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const sourceDataUrl = `data:${mimeType};base64,${btoa(binary)}`;

  const img = new Image();
  img.src = sourceDataUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load image'));
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const safeDataUrl = canvas.toDataURL('image/png');
  return { dataUrl: safeDataUrl, width: img.naturalWidth, height: img.naturalHeight };
}
