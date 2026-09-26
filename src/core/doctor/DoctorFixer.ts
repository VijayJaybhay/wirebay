/**
 * `wirebay doctor --fix`: turns repairable doctor findings into changes.
 * @module
 */

import type { AppContext } from "../../app/AppContext.ts";
import type { SyncOutcome } from "../sync/SyncEngine.ts";
import type { DoctorCheck, Repair } from "./Doctor.ts";

/** One repair `doctor --fix` can apply. */
export interface Fix {
  /** The finding it repairs. */
  check: DoctorCheck;
  /** What it will do, in one line. */
  describe: string;
  /**
   * Apply it (or with `dryRun`, only plan it).
   * @returns What changed, for the sync report.
   */
  apply(options: { dryRun?: boolean }): SyncOutcome;
}

/**
 * Builds fixes from doctor checks that carry a {@link Repair}. Only wirebay-managed entries are
 * ever changed: files wirebay didn't write are reported by doctor but never touched.
 */
export class DoctorFixer {
  private readonly ctx: AppContext;

  constructor(ctx: AppContext) {
    this.ctx = ctx;
  }

  /** The fixes for these checks, in order. */
  fixesFor(checks: DoctorCheck[]): Fix[] {
    return checks.flatMap((check) => (check.repair ? [this.fix(check, check.repair)] : []));
  }

  private fix(check: DoctorCheck, repair: Repair): Fix {
    const ctx = this.ctx;
    const where = repair.scope === "user" ? "global" : "project";
    if (repair.kind === "remove-from-tool") {
      return {
        check,
        describe: `remove ${repair.servers.join(", ")} from ${repair.tool} (${where}); the file is deleted if nothing else is left in it`,
        apply: ({ dryRun }) => {
          if (!dryRun) ctx.desired.save(repair.scope, ctx.desired.servers(repair.scope).disable(repair.servers, [repair.tool]));
          return ctx.sync.run({ tools: [repair.tool], scope: repair.scope, servers: repair.servers, dryRun, removeOnly: dryRun });
        },
      };
    }
    return {
      check,
      describe: `update ${repair.tools.join(", ")} (${where}) to match wirebay's config`,
      apply: ({ dryRun }) => ctx.sync.run({ tools: repair.tools, scope: repair.scope, dryRun }),
    };
  }
}
