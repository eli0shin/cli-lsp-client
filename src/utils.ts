/**
 * Utility functions shared across the application
 */

/**
 * Creates a short unique identifier for a directory path using a simple hash function
 * @param dirPath The directory path to hash
 * @returns A base36 string representation of the hash
 */
export function hashPath(dirPath: string): string {
  let hash = 0;
  for (let i = 0; i < dirPath.length; i++) {
    const char = dirPath.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}