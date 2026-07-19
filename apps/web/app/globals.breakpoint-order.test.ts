// @vitest-environment node
import { describe, it, expect } from "vitest";
import { compile } from "tailwindcss";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

/**
 * Regression guard for the `3xl` breakpoint cascade bug.
 *
 * Tailwind 4 registers `@media (min-width: …)` variant blocks in the order
 * their `--breakpoint-*` custom properties are inserted into its internal
 * theme map — NOT sorted by pixel value (see `Variants.group` in
 * tailwindcss/dist/lib.js, which iterates `theme.namespace("--breakpoint")`
 * with no `.sort()`). A project `@theme` block that only adds
 * `--breakpoint-3xl` — leaving `sm`/`md`/`lg`/`xl`/`2xl` to fall through
 * from tailwindcss's own `@theme default` scale — gets `3xl` inserted (and
 * therefore emitted) before the defaults, regardless of its 1440px value
 * being larger than `lg`'s 1024px. Equal-specificity CSS resolves by source
 * order, so `lg:*` utilities would silently beat `3xl:*` utilities on the
 * same property above 1440px.
 *
 * jsdom does not evaluate media queries at all, so this can't be caught by
 * a jsdom-rendered test — it has to inspect the actual compiled stylesheet.
 * This test runs the real `app/globals.css` through Tailwind's own
 * `compile()` (the same engine the dev server and build use) and asserts
 * the emitted media block order is truly ascending by pixel value:
 * `lg` (1024px) before `3xl` (1440px) before `2xl` (1536px).
 *
 * The fix in `app/globals.css` redeclares the whole sm..3xl scale in
 * ascending order so every breakpoint lands in the same theme-merge pass
 * and keeps this file's top-to-bottom order — correct by construction.
 * Reverting to only `--breakpoint-3xl: 1440px;` (dropping the sm..2xl
 * redeclaration) reproduces the bug and fails this test.
 */

const webRoot = path.resolve(__dirname, "..");
const req = createRequire(__filename);

async function loadStylesheet(id: string, base: string) {
  let resolved: string;
  if (id === "tailwindcss") {
    resolved = req.resolve("tailwindcss/index.css", { paths: [webRoot] });
  } else if (id === "tw-animate-css") {
    // tw-animate-css only exports a `style` condition, which plain
    // `require.resolve` doesn't understand — derive its dist file from
    // tailwindcss's own (exported) location as a hoisted sibling package.
    const tailwindPkg = req.resolve("tailwindcss/package.json", {
      paths: [webRoot],
    });
    const nodeModules = path.dirname(path.dirname(tailwindPkg));
    resolved = path.join(
      nodeModules,
      "tw-animate-css",
      "dist",
      "tw-animate.css"
    );
  } else {
    resolved = req.resolve(id, { paths: [base, webRoot] });
  }
  const content = await readFile(resolved, "utf8");
  return { path: resolved, base: path.dirname(resolved), content };
}

async function compiledOrderOf(candidates: string[]) {
  const css = await readFile(path.join(webRoot, "app/globals.css"), "utf8");
  const compiler = await compile(css, { base: webRoot, loadStylesheet });
  return compiler.build(candidates);
}

describe("breakpoint media-block emission order (app/globals.css)", () => {
  it("emits 3xl's media block after lg's and before 2xl's, matching ascending pixel value", async () => {
    const out = await compiledOrderOf([
      "lg:grid-cols-4",
      "3xl:grid-cols-5",
      "2xl:grid-cols-6",
    ]);

    const lgIndex = out.indexOf("grid-cols-4");
    const threeXlIndex = out.indexOf("grid-cols-5");
    const twoXlIndex = out.indexOf("grid-cols-6");

    expect(lgIndex).toBeGreaterThan(-1);
    expect(threeXlIndex).toBeGreaterThan(-1);
    expect(twoXlIndex).toBeGreaterThan(-1);

    // Same-specificity cascade: whichever media block comes LAST in the
    // stylesheet wins at a width where both match. lg (1024px) must lose to
    // 3xl (1440px) above 1440px, so lg's block must appear first.
    expect(lgIndex).toBeLessThan(threeXlIndex);
    // 2xl (1536px) is genuinely wider than 3xl (1440px) — Tailwind's own
    // default breakpoint, unmodified — so it must still win above 1536px.
    expect(threeXlIndex).toBeLessThan(twoXlIndex);
  });

  it("lets a 3xl: utility beat a lg: utility on the same property (the reported bug)", async () => {
    // The concrete shape of the original bug report: two classes on the
    // *same* property, differing only in breakpoint. Above 1440px both
    // media queries match, so the one that comes later in the stylesheet
    // wins the cascade. Before the fix, `lg:grid-cols-4` (emitted first
    // regardless of order supplied here) silently beat `3xl:grid-cols-5`.
    const out = await compiledOrderOf(["3xl:grid-cols-5", "lg:grid-cols-4"]);

    const lgIndex = out.indexOf("grid-cols-4");
    const threeXlIndex = out.indexOf("grid-cols-5");

    expect(lgIndex).toBeLessThan(threeXlIndex);
  });
});
