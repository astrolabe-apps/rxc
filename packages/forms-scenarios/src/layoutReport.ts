import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ScreenNode } from "./target.js";
import { compareLayouts, decodePng, type LayoutDifference, type LayoutTolerance } from "./visual.js";

/**
 * What a `--shots` directory holds, beside its pictures: each scenario's folder and steps, and
 * the two targets — enough to compare the layouts again without a device.
 */
export interface ShotsManifest {
  targets: string[];
  scenarios: { name: string; folder: string; steps: string[] }[];
}

/** One step whose layouts differ, and by how much. */
export interface LayoutStep {
  scenario: string;
  folder: string;
  /** 0 the form as it opened, then each step. */
  step: number;
  what: string;
  differences: LayoutDifference[];
  /** The px the differences add up to, a colour counting a sixth of its distance. */
  score: number;
}

/** Compare every step two targets both pictured, from a `--shots` directory's files. */
export function scoreShots(dir: string, tolerance?: LayoutTolerance): LayoutStep[] {
  const m = JSON.parse(readFileSync(join(dir, "shots.json"), "utf8")) as ShotsManifest;
  const [a, b] = m.targets;
  if (!a || !b) return [];
  const out: LayoutStep[] = [];
  for (const s of m.scenarios)
    for (let i = 0; i <= s.steps.length; i++) {
      const load = (t: string) => {
        const screen = join(dir, s.folder, `${i}-${t}.screen.json`);
        if (!existsSync(screen)) return undefined;
        const png = join(dir, s.folder, `${i}-${t}.png`);
        let picture;
        try {
          picture = existsSync(png) ? decodePng(readFileSync(png)) : undefined;
        } catch {
          picture = undefined;
        }
        return { nodes: JSON.parse(readFileSync(screen, "utf8")) as ScreenNode[], picture };
      };
      const sa = load(a);
      const sb = load(b);
      if (!sa || !sb) continue;
      const differences = compareLayouts(sa, sb, tolerance);
      if (!differences.length) continue;
      const score = Math.round(differences.reduce((t, d) => t + (d.kind === "colour" ? d.delta / 6 : d.delta), 0));
      out.push({ scenario: s.name, folder: s.folder, step: i, what: i === 0 ? "opened" : `${i}. ${s.steps[i - 1]}`, differences, score });
    }
  return out.sort((x, y) => y.score - x.score);
}

/** The layout report, the steps that differ most first, each difference on a line; written to `layout.md`. */
export function writeLayoutReport(dir: string, steps: LayoutStep[]): string {
  const m = JSON.parse(readFileSync(join(dir, "shots.json"), "utf8")) as ShotsManifest;
  const lines = [
    `# Layout differences, ${m.targets[0]} against ${m.targets[1]}`,
    "",
    `${steps.length} step(s) differ. Score: the px the differences add up to (a colour counts a sixth of its distance).`,
    "",
  ];
  for (const l of steps) {
    lines.push(`## ${l.score} — ${l.scenario}: ${l.what}`, "");
    for (const d of [...l.differences].sort((x, y) => y.delta - x.delta))
      lines.push(`- ${d.kind} — "${d.words.slice(0, 60)}": ${d.first} vs ${d.second}`);
    lines.push("");
  }
  const file = join(dir, "layout.md");
  writeFileSync(file, lines.join("\n"));
  return file;
}
