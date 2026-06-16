export const autoClosedPairs = {
  '(': ')',
  '[': ']',
  '{': '}',
  '"': '"',
  "'": "'",
  '`': '`'
} as const;

export const openerForCloser = new Map<string, string>(
  Object.entries(autoClosedPairs).map(([opener, closer]) => [closer, opener])
);

export function isAutoClosedPairText(text: string): boolean {
  const first = text[0];
  const last = text[text.length - 1];

  if (first === undefined || last === undefined || autoClosedPairs[first as keyof typeof autoClosedPairs] !== last) {
    return false;
  }

  return /^[\s]*$/.test(text.slice(1, -1));
}
