/**
 * Hand a file to whoever is at the keyboard.
 *
 * A download rather than a copy-to-clipboard or a POST somewhere: there is no
 * server to send it to, the file *is* the deliverable, and a file can be read,
 * edited and forwarded by the person who made it before anyone else sees it.
 * Nothing about a match leaves the machine unless somebody chooses to send it.
 */
export function downloadFile(filename: string, contents: string, type: string): void {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();

  /* The object URL pins the blob in memory until it is let go. */
  URL.revokeObjectURL(url);
}

/** Where this page lives, without whatever query happens to be on it. */
export function pageOrigin(): string {
  return typeof window === "undefined"
    ? ""
    : `${window.location.origin}${window.location.pathname}`;
}
