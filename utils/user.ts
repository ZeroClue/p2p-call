import { generateUUID } from './id';

const USER_ID_KEY = 'p2p-user-id';


/**
 * Retrieves the unique user ID from localStorage. If it doesn't exist,
 * it generates a new one, saves it, and then returns it.
 * This ensures the user has a persistent identity across sessions.
 * @returns {string} The user's unique ID.
 */
export const getUserId = (): string => {
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = generateUUID();
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
};

const USER_DISPLAY_NAME_KEY = 'p2p-user-display-name';

/**
 * Retrieves the user's chosen display name from localStorage.
 * @returns {string | null} The user's display name, or null if not set.
 */
export const getUserDisplayName = (): string | null => {
  return localStorage.getItem(USER_DISPLAY_NAME_KEY);
};

/**
 * Saves the user's chosen display name to localStorage.
 * @param {string} name The display name to save. If empty/whitespace, removes the item.
 */
export const saveUserDisplayName = (name: string): void => {
  if (name && name.trim()) {
    localStorage.setItem(USER_DISPLAY_NAME_KEY, name.trim());
  } else {
    localStorage.removeItem(USER_DISPLAY_NAME_KEY);
  }
};