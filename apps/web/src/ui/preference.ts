import { useSyncExternalStore } from "react";

/**
 * A setting the player chooses, remembered on this device.
 *
 * Deliberately not in the URL. The link is the *match* — a seed, a game type,
 * an economy — and two people opening the same link must get the same match;
 * whether one of them prefers the board sideways or likes the odds hidden is
 * about them, not about the game, and putting it in the link would make a
 * shared match look different depending on who last touched the toggle.
 *
 * Shared through a module-level store rather than through React context: a
 * toggle in the match header and a board three components away have to agree
 * instantly, and there is exactly one of each of these in the app.
 */
export interface Preference<T extends string> {
  /** Read the current value. */
  get: () => T;
  /** Change it, telling everybody listening. */
  set: (value: T) => void;
  /** Subscribe to changes, for {@link useSyncExternalStore}. */
  subscribe: (onChange: () => void) => () => void;
}

/**
 * Build a remembered setting.
 *
 * `allowed` is both the type and the validator: anything stored that is not on
 * the list is ignored in favour of the default, because local storage is
 * untrusted input like any other and a hand-edited value must not be able to
 * put the interface into a state it has no rendering for.
 */
export function preference<T extends string>(
  key: string,
  fallback: T,
  allowed: readonly T[],
): Preference<T> {
  let current: T | null = null;
  const listeners = new Set<() => void>();

  const get = (): T => {
    if (current !== null) return current;

    try {
      const saved = window.localStorage.getItem(key);
      if (saved !== null && (allowed as readonly string[]).includes(saved)) {
        current = saved as T;
      }
    } catch {
      /* A private window remembers nothing, which is not an error. */
    }

    return current ?? fallback;
  };

  const set = (value: T): void => {
    current = value;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* It still applies for this session; it just will not be remembered. */
    }
    for (const listener of [...listeners]) listener();
  };

  const subscribe = (onChange: () => void) => {
    listeners.add(onChange);
    return () => listeners.delete(onChange);
  };

  return { get, set, subscribe };
}

/** Read a remembered setting, and re-render when it changes. */
export function usePreference<T extends string>(setting: Preference<T>, fallback: T): T {
  return useSyncExternalStore(setting.subscribe, setting.get, () => fallback);
}
