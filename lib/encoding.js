/**
 * Detect and attempt to fix garbled encoding in text fields.
 *
 * Returns { ok: true, data } with cleaned data on success,
 * or { ok: false, error, hint } when the text is unrecoverably garbled.
 */

// Common cp1252 byte → UTF-8 mojibake patterns (Latin-1 interpreted Chinese)
const MOJIBAKE_RE = /[\xC0-\xFF][\x80-\xBF]/;

/**
 * Check if a string looks like garbled text.
 */
function isGarbled(str) {
  if (typeof str !== 'string') return false;
  // U+FFFD replacement characters
  if (/\uFFFD/.test(str)) return true;
  // Consecutive raw high bytes (cp1252 / Latin-1 leak)
  if (/[\x80-\xFF]{4,}/.test(str)) return true;
  // Suspicious ratio: mostly non-printable / control chars
  if (/[\x00-\x08\x0E-\x1F]{3,}/.test(str)) return true;
  return false;
}

/**
 * Validate all string fields in a plain object.
 * @param {Record<string, any>} data - The parsed request body fields to check
 * @param {string[]} fields - Field names that contain user text
 * @returns {{ ok: true, data: Record<string, any> } | { ok: false, error: string, hint: string }}
 */
export function validateEncoding(data, fields) {
  const garbledFields = [];

  for (const key of fields) {
    const val = data[key];
    if (typeof val === 'string' && isGarbled(val)) {
      garbledFields.push(key);
    }
  }

  if (garbledFields.length === 0) {
    return { ok: true, data };
  }

  return {
    ok: false,
    error: `Encoding error: garbled characters detected in field(s): ${garbledFields.join(', ')}. The text was likely corrupted by a non-UTF-8 shell or HTTP client.`,
    hint: [
      'Ensure your HTTP client sends UTF-8 encoded JSON.',
      'curl on Windows: use --data-binary @payload.json with a UTF-8 file, or switch to PowerShell: Invoke-RestMethod -Body ([System.Text.Encoding]::UTF8.GetBytes($json))',
      'Python on Windows: use requests.post(url, json=data) instead of data=, and add sys.stdout.reconfigure(encoding="utf-8").',
      'Node.js: ensure the process runs with chcp 65001 or set encoding to UTF-8 before spawning.',
    ].join(' '),
  };
}
