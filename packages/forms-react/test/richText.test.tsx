import { describe, expect, it, vi } from "vitest";
import { FormProvider, html, parseRichText, RichText, richTextWords, TextField } from "../src/index";
import { setupDom } from "./harness";
import { testRenderers } from "./testRenderers";

const dom = setupDom();

describe("rich text", () => {
  it("parses the inline subset, nested, with whitespace collapsed", () => {
    expect(parseRichText("Is  <b>UBER\n<i>really</i></b> 1m<sup>3</sup>?<br/>Next")).toEqual([
      { kind: "text", text: "Is " },
      {
        kind: "strong",
        children: [
          { kind: "text", text: "UBER " },
          { kind: "em", children: [{ kind: "text", text: "really" }] },
        ],
      },
      { kind: "text", text: " 1m" },
      { kind: "sup", children: [{ kind: "text", text: "3" }] },
      { kind: "text", text: "?" },
      { kind: "break" },
      { kind: "text", text: "Next" },
    ]);
  });

  it("decodes entities, tolerating a missing semicolon, as the corpus writes them", () => {
    expect(richTextWords(parseRichText("classes,&nbsp<a href='/x'>here</a> &amp; &#169; &#x2014; &bogus;"))).toBe(
      "classes, here & © — &bogus;",
    );
  });

  it("keeps a link's safe target and its words, and drops a script's", () => {
    expect(parseRichText('<a target="_blank" href="https://x.test/a?b=1&amp;c=2">go</a>')).toEqual([
      { kind: "link", href: "https://x.test/a?b=1&c=2", target: "_blank", children: [{ kind: "text", text: "go" }] },
    ]);
    expect(parseRichText('<a href="javascript:alert(1)">go <b>on</b></a>')).toEqual([
      { kind: "text", text: "go " },
      { kind: "strong", children: [{ kind: "text", text: "on" }] },
    ]);
  });

  it("takes an image's size from its attributes, else its style", () => {
    expect(
      parseRichText(
        '<img style="background-color: #e6e6e6; max-width:260px; display: block;" src="https://x.test/card.png" alt="The back of a licence card">',
      ),
    ).toEqual([
      { kind: "image", src: "https://x.test/card.png", alt: "The back of a licence card", width: 260, height: undefined },
    ]);
  });

  it("keeps the text of a tag outside the subset, warning once per tag; ignores stray closes and comments", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      richTextWords(parseRichText("<p>One</p><!-- note --></b><p>Two <span class='x'>three</span></p><b>open")),
    ).toBe("OneTwo threeopen");
    expect(warn.mock.calls.map((c) => String(c[0]).match(/draws <(\w+)>/)?.[1])).toEqual(["p", "span"]);
    warn.mockRestore();
  });

  it("escapes what the html template interpolates, so data never becomes markup", () => {
    const name = `<b>Bad</b> & "co"`;
    const nodes = parseRichText(html`Is <b>${name}</b>?`);
    expect(nodes).toEqual([
      { kind: "text", text: "Is " },
      { kind: "strong", children: [{ kind: "text", text: `<b>Bad</b> & "co"` }] },
      { kind: "text", text: "?" },
    ]);
  });

  it("draws through the implementation's slot inside a label, and as its words outside any form", () => {
    dom.mount(
      <FormProvider renderers={testRenderers}>
        <TextField field={dom.ctx.newControl("")} id="f" label={<RichText html="Fire over 1m<sup>3</sup>" />} />
      </FormProvider>,
    );
    expect(dom.container.querySelector("[data-rich]")?.innerHTML).toBe("Fire over 1m<sup>3</sup>");
    dom.mount(<RichText html="<b>Bare</b> words" />);
    expect(dom.container.innerHTML).toBe("Bare words");
  });
});
