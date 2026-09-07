/**
 * Sass emits platform line endings. The committed generated stylesheet may
 * therefore differ byte-for-byte after a checkout with core.autocrlf enabled
 * while representing the same CSS.
 */
export function normalizeCssLineEndings(contents) {
  return contents.toString("utf8").replace(/\r\n/g, "\n");
}

export function cssContentsMatch(generated, committed) {
  return normalizeCssLineEndings(generated) === normalizeCssLineEndings(committed);
}
