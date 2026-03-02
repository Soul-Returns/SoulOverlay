/**
 * Web demo shim: replaces @tauri-apps/api/event.
 * listen() and emit() are no-ops — game events don't apply in browser mode.
 */

export function listen<T>(
  _event: string,
  _handler: (event: { payload: T }) => void,
): Promise<() => void> {
  return Promise.resolve(() => {});
}

export function emit(_event: string, _payload?: unknown): Promise<void> {
  return Promise.resolve();
}
