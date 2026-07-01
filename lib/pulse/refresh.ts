export type PulseRefreshReason =
  | "attendance"
  | "lesson"
  | "assessment"
  | "homework"
  | "reflection"
  | "manual";

type Listener = (reason: PulseRefreshReason) => void;

const listeners = new Set<Listener>();

export function subscribePulse(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function refreshPulse(reason: PulseRefreshReason) {
  listeners.forEach((listener) => listener(reason));
}
