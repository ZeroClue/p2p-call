import { CallHistoryEntry } from '@/types';

const HISTORY_KEY = 'p2p-call-history';
const MAX_HISTORY_ITEMS = 20;

/**
 * Retrieves the call history from localStorage.
 * @returns An array of call history entries, or an empty array if none exists or an error occurs.
 */
export const getHistory = (): CallHistoryEntry[] => {
  try {
    const historyJson = localStorage.getItem(HISTORY_KEY);
    if (historyJson) {
      const history = JSON.parse(historyJson);
      // Basic validation to ensure it's an array
      if (Array.isArray(history)) {
        return history;
      }
    }
  } catch (error) {
    console.error("Failed to parse call history from localStorage", error);
    // If parsing fails, it's safer to start with a clean slate
    localStorage.removeItem(HISTORY_KEY);
  }
  return [];
};

/**
 * Saves the call history to localStorage.
 * @param history The array of call history entries to save. The list will be truncated if it exceeds MAX_HISTORY_ITEMS.
 */
export const saveHistory = (history: CallHistoryEntry[]): void => {
  try {
    // Keep history to a reasonable size to avoid excessive localStorage usage
    const limitedHistory = history.slice(0, MAX_HISTORY_ITEMS);
    const historyJson = JSON.stringify(limitedHistory);
    localStorage.setItem(HISTORY_KEY, historyJson);
  } catch (error) {
    console.error("Failed to save call history to localStorage", error);
  }
};
