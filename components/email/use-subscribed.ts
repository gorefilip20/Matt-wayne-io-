"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Shares "this visitor already signed up" across every form on the page (and
 * across reloads) so the hero form, end-of-guide form and sticky bar stay in
 * sync after one successful submit.
 */

const STORAGE_KEY = "guide:subscribed";
const EVENT = "guide:subscribed";

function read(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function subscribeToStore(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useSubscribed() {
  const email = useSyncExternalStore(subscribeToStore, read, () => null);

  const markSubscribed = useCallback((value: string) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Private mode: the in-page event still updates every form.
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { subscribedEmail: email, markSubscribed };
}
