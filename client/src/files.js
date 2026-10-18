// Hand a generated file to the user. On phones the share sheet is the reliable
// route (it offers "Save to Files", AirDrop, Drive, …) — an installed PWA can't
// always trigger a plain download. Desktops get an ordinary download.
export async function saveFile(data, filename, type) {
  const file = new File([data], filename, { type });
  const touch = window.matchMedia?.('(pointer: coarse)').matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;   // user dismissed the sheet
      // NotAllowedError etc. — fall through to a download
    }
  }
  const url = URL.createObjectURL(file);
  const a   = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// Prompt for a file and resolve with its bytes (null if cancelled).
export function pickFile(accept) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    if (accept) input.accept = accept;
    input.onchange = async () => {
      const f = input.files?.[0];
      resolve(f ? new Uint8Array(await f.arrayBuffer()) : null);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
