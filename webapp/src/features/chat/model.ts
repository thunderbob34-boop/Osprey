/** Longest thread title we keep; longer first messages are cut on a word boundary. */
const MAX_TITLE = 48;

/**
 * A thread's title is just its opening question, tidied. Threads are found by
 * skimming, so the first few words matter more than completeness.
 */
export function titleFromFirstMessage(text: string): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (!clean) return 'New chat';
  if (clean.length <= MAX_TITLE) return clean;

  const cut = clean.slice(0, MAX_TITLE);
  const lastSpace = cut.lastIndexOf(' ');
  // Prefer a word boundary, but not one so early it throws the title away.
  const kept = lastSpace > MAX_TITLE * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${kept.trimEnd()}…`;
}
