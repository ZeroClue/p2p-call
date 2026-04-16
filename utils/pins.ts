import { PinnedEntry } from '@/types';

const PINNED_KEY = 'p2p-call-pins';

/**
 * Retrieves the pinned calls from localStorage to persist them across sessions.
 * @returns An array of pinned entries, or an empty array if none exists or an error occurs.
 */
export const getPinned = (): PinnedEntry[] => {
  try {
    const pinnedJson = localStorage.getItem(PINNED_KEY);
    if (pinnedJson) {
      const pinned = JSON.parse(pinnedJson);
      // Basic validation to ensure it's an array
      if (Array.isArray(pinned)) {
        return pinned;
      }
    }
  } catch (error) {
    console.error("Failed to parse pinned calls from localStorage", error);
    localStorage.removeItem(PINNED_KEY);
  }
  return [];
};

/**
 * Saves the pinned calls to localStorage, ensuring they are persisted.
 * @param pins The array of pinned entries to save.
 */
export const savePinned = (pins: PinnedEntry[]): void => {
  try {
    const pinnedJson = JSON.stringify(pins);
    localStorage.setItem(PINNED_KEY, pinnedJson);
  } catch (error) {
    console.error("Failed to save pinned calls to localStorage", error);
  }
};