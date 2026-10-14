import { afterAll, describe, expect, it } from "vitest";
import type { Scenario } from "./scenario.js";
import type { Target } from "./target.js";
import { formatResult, runScenario } from "./run.js";

/**
 * Each scenario as a vitest test on `target`, failing with the run's report.
 * Device runs are slow: the timeout is per scenario.
 *
 * @group Running
 */
export function scenarioTests(
  scenarios: readonly Scenario[],
  target: Target,
  options: { timeout?: number } = {},
): void {
  describe(target.name, () => {
    afterAll(() => target.close());
    for (const s of scenarios)
      it(
        s.name,
        async () => {
          const r = await runScenario(s, target);
          expect(r.ok, formatResult(r)).toBe(true);
        },
        options.timeout ?? 180_000,
      );
  });
}
