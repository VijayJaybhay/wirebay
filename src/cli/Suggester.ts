/**
 * "Did you mean …?" suggestions for mistyped words.
 * @module
 */

/** Suggests the closest known word using edit distance. */
export class Suggester {
  private readonly candidates: string[];

  /** @param candidates - Known words to suggest from. */
  constructor(candidates: Iterable<string>) {
    this.candidates = [...new Set(candidates)];
  }

  /**
   * @param word - What the user typed.
   * @returns `Did you mean "x"?`, or `undefined` when nothing is close enough.
   */
  suggest(word: string): string | undefined {
    let best: { candidate: string; distance: number } | undefined;
    for (const candidate of this.candidates) {
      const d = Suggester.distance(word.toLowerCase(), candidate.toLowerCase());
      if (!best || d < best.distance) best = { candidate, distance: d };
    }
    if (best && best.distance <= Math.max(1, Math.floor(word.length / 3))) return `Did you mean "${best.candidate}"?`;
    return undefined;
  }

  /**
   * Edit distance where swapping two neighbouring letters ("snyc" → "sync") counts as one edit
   * (optimal string alignment distance). Uses three rolling rows instead of a full matrix.
   */
  static distance(a: string, b: string): number {
    let beforePrev: number[] = [];
    let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const row: number[] = [i];
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let best = Math.min(Suggester.at(prev, j) + 1, Suggester.at(row, j - 1) + 1, Suggester.at(prev, j - 1) + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) best = Math.min(best, Suggester.at(beforePrev, j - 2) + 1);
        row.push(best);
      }
      beforePrev = prev;
      prev = row;
    }
    return Suggester.at(prev, b.length);
  }

  /** Row lookup; every index read here has been written already, so a miss means "infinitely far". */
  private static at(row: number[], index: number): number {
    return row[index] ?? Number.POSITIVE_INFINITY;
  }
}
