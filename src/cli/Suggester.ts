/**
 * "Did you mean …?" suggestions for mistyped words.
 * @module
 */

/** Suggests the closest known word using edit distance. */
export class Suggester {
  /**
   * @param word - What the user typed.
   * @param candidates - Known words.
   * @returns `Did you mean "x"?`, or `undefined` when nothing is close enough.
   */
  static suggest(word: string, candidates: Iterable<string>): string | undefined {
    let best: { c: string; d: number } | undefined;
    for (const c of new Set(candidates)) {
      const d = Suggester.distance(word.toLowerCase(), c.toLowerCase());
      if (!best || d < best.d) best = { c, d };
    }
    if (best && best.d <= Math.max(1, Math.floor(word.length / 3))) return `Did you mean "${best.c}"?`;
    return undefined;
  }

  /** Edit distance where swapping two neighbouring letters ("snyc" → "sync") counts as one edit. */
  static distance(a: string, b: string): number {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) dp[0]![j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) dp[i]![j] = Math.min(dp[i]![j]!, dp[i - 2]![j - 2]! + 1);
      }
    }
    return dp[a.length]![b.length]!;
  }
}
