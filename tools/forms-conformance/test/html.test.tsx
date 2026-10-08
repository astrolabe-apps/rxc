import type { ReactNode } from "react";
import { htmlRenderers, HtmlThemeProvider, tailwindHtmlTheme } from "@rx-controls/forms-html";
import { describeConformance } from "../src/suite";

/*
 * The html implementation's run of the suite lives here rather than in
 * forms-html: this package depends on forms-json, whose tests render through
 * forms-html, so forms-html depending back on it would be a cycle. MUI and Ant
 * run the suite from their own packages.
 */
const looks = (node: ReactNode) => (
  <HtmlThemeProvider
    theme={{
      text: { variants: { lead: "lead" } },
      contents: { variants: { card: { wrapper: "card" } } },
      action: { variants: { quiet: { className: "quiet" } } },
      image: { variants: { rounded: "rounded" } },
    }}
  >
    {node}
  </HtmlThemeProvider>
);
describeConformance({ name: "html", renderers: htmlRenderers, looks });
describeConformance({
  name: "html · tailwind",
  renderers: htmlRenderers,
  wrap: (node) => <HtmlThemeProvider theme={tailwindHtmlTheme}>{node}</HtmlThemeProvider>,
  looks,
});
