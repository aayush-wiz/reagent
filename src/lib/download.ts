function saveBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Trigger a client-side download of text content as a file. */
export function downloadText(filename: string, content: string, mime = "text/markdown"): void {
  saveBlob(filename, new Blob([content], { type: mime }));
}

/** Download a server file (authenticated fetch → blob → save) — binary-safe (PDFs, etc.). */
export async function downloadUrl(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  saveBlob(filename, await res.blob());
}
