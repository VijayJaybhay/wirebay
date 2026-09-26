/**
 * A one-line progress indicator for slow steps (starting servers, updating tools).
 * @module
 */

/**
 * Shows `⠋ Starting github… 12s` on one line of stderr and redraws it in place.
 *
 * It only draws in an interactive terminal: with stderr redirected, in CI, or when disabled it does
 * nothing, so logs and `--json` output stay clean. Stdout is never touched. The line keeps its
 * last text while synchronous work blocks the event loop, then animates again.
 *
 * @example
 * const spinner = terminal.progress("Starting github…");
 * await startServer();
 * spinner.stop();
 */
export class Spinner {
  /** Animation frames. */
  static readonly frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  /** Milliseconds between frames. */
  static readonly intervalMs = 80;
  /** Show elapsed seconds once a step has taken this long. */
  static readonly showElapsedAfterMs = 2000;

  private readonly stream: NodeJS.WriteStream;
  private readonly enabled: boolean;
  private text = "";
  private frame = 0;
  private startedAt = 0;
  private timer: NodeJS.Timeout | undefined;
  private drawn = false;

  /**
   * @param stream - Where to draw (stderr).
   * @param enabled - False turns every method into a no-op.
   */
  constructor(stream: NodeJS.WriteStream, enabled: boolean) {
    this.stream = stream;
    this.enabled = enabled;
  }

  /** True while the spinner is running. */
  get active(): boolean {
    return this.timer !== undefined;
  }

  /** Start (or restart) with a message; the elapsed time restarts too. */
  start(text: string): this {
    if (!this.enabled) return this;
    this.text = text;
    this.startedAt = Date.now();
    if (!this.timer) {
      this.timer = setInterval(() => {
        this.frame = (this.frame + 1) % Spinner.frames.length;
        this.draw();
      }, Spinner.intervalMs);
      this.timer.unref();
    }
    this.draw();
    return this;
  }

  /** Change the message and restart the elapsed time, without stopping. */
  update(text: string): void {
    if (this.active) this.start(text);
  }

  /** Remove the line so ordinary output can be printed; the next frame draws it again. */
  clear(): void {
    if (!this.drawn) return;
    this.stream.write("\r\x1b[2K");
    this.drawn = false;
  }

  /** Draw the current line again right away (after output was printed while it was running). */
  redraw(): void {
    if (this.active) this.draw();
  }

  /** Stop and erase the line. */
  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.clear();
  }

  private draw(): void {
    const elapsed = Date.now() - this.startedAt;
    const seconds = elapsed >= Spinner.showElapsedAfterMs ? ` ${String(Math.floor(elapsed / 1000))}s` : "";
    this.stream.write(`\r\x1b[2K${Spinner.frames[this.frame] ?? ""} ${this.text}${seconds}`);
    this.drawn = true;
  }
}
