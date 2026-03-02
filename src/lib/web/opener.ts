/**
 * Web demo shim: replaces @tauri-apps/plugin-opener.
 * openUrl() delegates to window.open().
 */

export function openUrl(url: string): Promise<void> {
  window.open(url, "_blank", "noopener,noreferrer");
  return Promise.resolve();
}
