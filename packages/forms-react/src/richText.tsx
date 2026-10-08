import { Fragment, useMemo, type ReactNode } from "react";
import { useRenderersIfAny } from "./registry.js";

/**
 * One piece of rich text, parsed from {@link RichText}'s markup: the inline
 * subset every implementation draws the same way.
 *
 * @group Implementations
 */
export type RichNode =
  | {
      /** Plain words. Whitespace already collapsed as html would. */
      kind: "text";
      /** The words. */
      text: string;
    }
  | {
      /** Emphasis: `strong` (`<b>`, `<strong>`), `em` (`<i>`, `<em>`), or a raised or lowered run. */
      kind: "strong" | "em" | "sup" | "sub";
      /** What it wraps. */
      children: RichNode[];
    }
  | {
      /** A link. */
      kind: "link";
      /** Where it goes: `http(s):`, `mailto:`, `tel:` or relative — never a script. */
      href: string;
      /** `_blank` opens elsewhere, on a platform that can. */
      target?: string;
      /** Its words. */
      children: RichNode[];
    }
  | {
      /** A line break. */
      kind: "break";
    }
  | {
      /** An image. */
      kind: "image";
      /** A URL. */
      src: string;
      /** Its text alternative; empty for decoration. */
      alt: string;
      /** In pixels, from the attribute or the inline style's `width` / `max-width`. */
      width?: number;
      /** In pixels, from the attribute or the inline style. */
      height?: number;
    };

/**
 * The tags {@link RichText} draws, by the node each becomes. Anything else
 * keeps its text and loses its tag — reported in development.
 */
const TAGS: Record<string, "strong" | "em" | "sup" | "sub" | "link" | "break" | "image"> = {
  b: "strong",
  strong: "strong",
  i: "em",
  em: "em",
  sup: "sup",
  sub: "sub",
  a: "link",
  br: "break",
  img: "image",
};

/** Entities html writes most; `&amp` and friends tolerate a missing `;`, as browsers do. */
const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  copy: "©",
  reg: "®",
  trade: "™",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  bull: "•",
  middot: "·",
  deg: "°",
  sup2: "²",
  sup3: "³",
};

function decode(s: string): string {
  return s.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);?/gi,
    (m, e: string) => {
      if (e[0] === "#") {
        const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1));
        return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    },
  );
}

function attributes(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of source.matchAll(/([^\s=/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g))
    out[m[1]!.toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? "");
  return out;
}

/** A link's target, kept only when it cannot run script. */
function safeHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  const scheme = /^\s*([a-z][a-z0-9+.-]*):/i.exec(href)?.[1]?.toLowerCase();
  return scheme === undefined || ["http", "https", "mailto", "tel"].includes(scheme)
    ? href.trim()
    : undefined;
}

/** Pixels from an attribute or a style declaration: `260`, `260px`. */
function pixels(v: string | undefined): number | undefined {
  const m = v && /^\s*(\d+(?:\.\d+)?)(px)?\s*$/i.exec(v);
  return m ? Number(m[1]) : undefined;
}

function styleOf(style: string | undefined, ...names: string[]): string | undefined {
  for (const name of names) {
    const m = style && new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, "i").exec(style);
    if (m) return m[1];
  }
  return undefined;
}

declare const process: { env: { NODE_ENV?: string } } | undefined;
// The literal `process.env.NODE_ENV`, so bundlers fold it (see CLAUDE.md).
const IS_DEV: boolean =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";
const reported = new Set<string>();

/**
 * Parse markup into {@link RichNode}s: the inline subset {@link RichText}
 * draws, never anything else. Tags outside it keep their text; a stray close
 * is ignored and an unclosed open ends with the markup; whitespace collapses
 * as html's does; comments go. Pure — the same markup, the same nodes.
 *
 * @group Implementations
 */
export function parseRichText(markup: string): RichNode[] {
  const root: RichNode[] = [];
  // The open elements, innermost last; each with the list its children go in.
  const stack: { tag: string; children: RichNode[] }[] = [{ tag: "", children: root }];
  const top = () => stack[stack.length - 1]!.children;
  const text = (raw: string) => {
    const t = decode(raw.replace(/[ \t\r\n\f]+/g, " "));
    if (!t) return;
    const into = top();
    const last = into[into.length - 1];
    if (last?.kind === "text") last.text += t;
    else into.push({ kind: "text", text: t });
  };
  const tagRe = /<!--[\s\S]*?(?:-->|$)|<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let at = 0;
  for (const m of markup.matchAll(tagRe)) {
    text(markup.slice(at, m.index));
    at = m.index! + m[0].length;
    const name = m[1]?.toLowerCase();
    if (!name) continue; // a comment
    const kind = TAGS[name];
    if (m[0][1] === "/") {
      // Close the nearest open element of this tag, and anything left open
      // inside it; a close nothing opened is ignored.
      for (let i = stack.length - 1; i > 0; i--)
        if (stack[i]!.tag === name) {
          stack.length = i;
          break;
        }
      continue;
    }
    if (!kind) {
      if (IS_DEV && !reported.has(name)) {
        reported.add(name);
        console.warn(
          `Forms v2: <RichText> draws <${name}> as its text alone; it draws b, strong, i, em, sup, sub, a, br and img.`,
        );
      }
      continue;
    }
    const attrs = attributes(m[2] ?? "");
    if (kind === "break") top().push({ kind: "break" });
    else if (kind === "image") {
      const src = attrs.src;
      if (src && safeHref(src))
        top().push({
          kind: "image",
          src,
          alt: attrs.alt ?? "",
          width: pixels(attrs.width) ?? pixels(styleOf(attrs.style, "width", "max-width")),
          height: pixels(attrs.height) ?? pixels(styleOf(attrs.style, "height", "max-height")),
        });
    } else {
      const children: RichNode[] = [];
      const href = kind === "link" ? safeHref(attrs.href) : undefined;
      // A link that cannot go anywhere safe keeps its words, as plain text.
      if (kind === "link" && !href) {
        stack.push({ tag: name, children: top() });
        continue;
      }
      top().push(
        kind === "link"
          ? { kind, href: href!, target: attrs.target || undefined, children }
          : { kind, children },
      );
      // A self-closing `<b/>` holds nothing.
      if (!/\/\s*$/.test(m[2] ?? "")) stack.push({ tag: name, children });
    }
  }
  text(markup.slice(at));
  return root;
}

/**
 * The words of rich text, for where only words go — an accessible name on a
 * platform whose names are strings. An image contributes its `alt`.
 *
 * @group Implementations
 */
export function richTextWords(nodes: RichNode[]): string {
  return nodes
    .map((n) =>
      n.kind === "text"
        ? n.text
        : n.kind === "break"
          ? " "
          : n.kind === "image"
            ? n.alt
            : richTextWords(n.children),
    )
    .join("")
    .replace(/[ \t\r\n\f]+/g, " ")
    .trim();
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Markup with data in it, the data escaped — so a name with a `<` in it
 * stays words and never becomes a tag:
 *
 * ```tsx
 * label={(rc) => <RichText html={html`Is <b>${rc.getValue(name)}</b> a commercial vessel?`} />}
 * ```
 *
 * @group Authoring
 */
export function html(strings: TemplateStringsArray, ...values: unknown[]): string {
  return strings.reduce(
    (out, s, i) =>
      out +
      s +
      (i < values.length ? String(values[i] ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]!) : ""),
    "",
  );
}

/**
 * The props of {@link RichText}.
 *
 * @group Authoring
 */
export interface RichTextProps {
  /**
   * Inline markup: `b` / `strong`, `i` / `em`, `sup` / `sub`, `a`, `br`,
   * `img` and entities. Parsed, never injected — anything else keeps its
   * text — so it is drawn the same on every platform. Build it from data
   * with {@link html}, which escapes what is interpolated.
   */
  html: string;
}

/**
 * Words with some emphasised, a link, a superscript — inside a label, a
 * help text, a display's text, anywhere a node goes:
 *
 * ```tsx
 * <TextDisplay text={<RichText html="Is your fire larger than 1m<sup>3</sup>?" />} />
 * ```
 *
 * The markup is parsed into a fixed inline subset ({@link RichNode}) and drawn
 * by the implementation's `richText` slot — html's elements on the web, nested
 * `Text` on React Native — so the same source looks the same everywhere. An
 * app that wants arbitrary html replaces the slot; block html is
 * {@link HtmlDisplay}'s.
 *
 * @group Authoring
 */
export function RichText({ html: markup }: RichTextProps): ReactNode {
  const renderers = useRenderersIfAny();
  const nodes = useMemo(() => parseRichText(markup), [markup]);
  const Impl = renderers?.richText;
  // Outside any form there is no implementation to draw with: the words.
  return Impl ? <Impl nodes={nodes} /> : richTextWords(nodes);
}

/**
 * What the `richText` slot receives.
 *
 * @group Implementations
 */
export interface RichTextRenderProps {
  /** The parsed markup. */
  nodes: RichNode[];
}

/**
 * How an implementation draws each kind of node, for {@link drawRichText}.
 * `children` is the node's own content, already drawn.
 *
 * @group Implementations
 */
export interface RichTextParts {
  /** Plain words. Default: the string. */
  text?: (text: string, key: number) => ReactNode;
  /** Emphasis, raised and lowered runs. */
  strong: (children: ReactNode, key: number) => ReactNode;
  /** Emphasis. */
  em: (children: ReactNode, key: number) => ReactNode;
  /** A superscript. */
  sup: (children: ReactNode, key: number) => ReactNode;
  /** A subscript. */
  sub: (children: ReactNode, key: number) => ReactNode;
  /** A link. */
  link: (node: Extract<RichNode, { kind: "link" }>, children: ReactNode, key: number) => ReactNode;
  /** A line break. */
  break: (key: number) => ReactNode;
  /** An image. */
  image: (node: Extract<RichNode, { kind: "image" }>, key: number) => ReactNode;
}

/**
 * Draw parsed rich text through an implementation's own parts — the walk
 * every `richText` slot shares.
 *
 * @group Implementations
 */
export function drawRichText(nodes: RichNode[], parts: RichTextParts): ReactNode {
  return nodes.map((n, key) => {
    switch (n.kind) {
      case "text":
        return parts.text ? parts.text(n.text, key) : <Fragment key={key}>{n.text}</Fragment>;
      case "break":
        return parts.break(key);
      case "image":
        return parts.image(n, key);
      case "link":
        return parts.link(n, drawRichText(n.children, parts), key);
      default:
        return parts[n.kind](drawRichText(n.children, parts), key);
    }
  });
}
