/**
 * Formats a duration in seconds into a MM:SS string.
 * @param timeInSeconds The total seconds to format.
 * @returns A string in the format "MM:SS".
 */
export const formatTime = (timeInSeconds: number): string => {
  const minutes = Math.floor(timeInSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (timeInSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

/**
 * Formats a UNIX timestamp into a human-readable, locale-aware string.
 * @param timestamp The timestamp (milliseconds since epoch) to format.
 * @returns A formatted date and time string (e.g., "Jan 1, 2024, 12:30 PM").
 */
export const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Converts a timestamp into a relative time string (e.g., "5 minutes ago").
 * @param timestamp The timestamp in milliseconds.
 * @returns A human-readable relative time string.
 */
export const formatTimeAgo = (timestamp: number): string => {
  const now = new Date();
  const past = new Date(timestamp);
  const seconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds} seconds ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;

  const years = Math.floor(days / 365);
  return `${years} year${years > 1 ? 's' : ''} ago`;
};
