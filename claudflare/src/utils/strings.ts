/**
 * Escape special characters for shell execution when inside double quotes
 * Order matters: backslashes first, then other special chars
 * Tested and verified to handle: backticks, dollar signs, quotes, backslashes, and edge cases
 */
export const escapeShell = (str: string): string =>
  str
    .replace(/\\/g, "\\\\") // Escape backslashes first (must be first!)
    .replace(/"/g, '\\"') // Escape double quotes
    .replace(/\$/g, "\\$") // Escape dollar signs (variable substitution)
    .replace(/`/g, "\\`"); // Escape backticks (command substitution)
