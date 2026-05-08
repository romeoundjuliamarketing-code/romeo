type Listener = (isOffline: boolean) => void;

const listeners = new Set<Listener>();
let offline = false;

function notify(next: boolean) {
  if (offline === next) return;
  offline = next;
  listeners.forEach((fn) => fn(offline));
}

export function reportNetworkError(err: unknown): void {
  let msg = '';
  if (err instanceof Error) {
    msg = err.message.toLowerCase();
  } else if (err !== null && typeof err === 'object' && 'message' in err) {
    msg = String((err as { message: unknown }).message).toLowerCase();
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    notify(true);
  }
}

export function reportNetworkSuccess(): void {
  notify(false);
}

export function subscribeNetworkStatus(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getNetworkOffline(): boolean {
  return offline;
}

export async function checkConnectivity(): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    await fetch('https://captive.apple.com/hotspot-detect.html', {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    notify(false);
  } catch {
    notify(true);
  }
}
