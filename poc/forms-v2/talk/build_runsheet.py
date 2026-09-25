#!/usr/bin/env python3
"""Run-sheet + compiled speaker notes for the Forms v2 talk. Reads the slide list from build_deck.py."""
import html, pathlib, importlib.util

here = pathlib.Path(__file__).parent
spec = importlib.util.spec_from_file_location("build_deck", here / "build_deck.py")
deck = importlib.util.module_from_spec(spec); spec.loader.exec_module(deck)
OUT = here / "forms-v2-runsheet.html"
esc = lambda s: html.escape(s, quote=False)

def title_of(body):
    import re
    m = re.search(r"<h[12][^>]*>(.*?)</h[12]>", body, re.S)
    return re.sub(r"<[^>]+>", " ", m.group(1)).replace("  ", " ").strip() if m else ""

notes_html = ""
for i, (eyebrow, body, notes, cls) in enumerate(deck.slides, 1):
    paras = "".join(f"<p>{esc(p.strip())}</p>" for p in notes.strip().split("\n\n"))
    notes_html += f'''<article class="note">
<header><span class="n">{i}</span><div><span class="eb">{esc(eyebrow) or "&nbsp;"}</span><h3>{esc(title_of(body))}</h3></div></header>
{paras}
</article>'''

doc = f'''<title>Forms v2 Run Sheet</title>
<meta name="description" content="Pre-flight, timings, demo clicks, fallbacks and speaker notes for the Forms v2 talk.">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root {{
  --bg:#f5f7fa; --surface:#fff; --surface-2:#eaeef3; --ink:#161b22; --ink-2:#3d4652; --muted:#6b7482; --rule:#d6dce4;
  --teal:#0f7b6c; --teal-soft:#e0f2ee; --teal-ink:#0a5a4f; --ochre:#b8741a; --ochre-soft:#fbf0dc; --ochre-ink:#7d4d0e; --bad:#b3261e;
  color-scheme: light;
}}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{
  --bg:#0f1419; --surface:#171d25; --surface-2:#1f2730; --ink:#e6eaf0; --ink-2:#c3cad3; --muted:#8f9aa7; --rule:#2b3440;
  --teal:#3fbfa8; --teal-soft:#14302c; --teal-ink:#8fe0d1; --ochre:#e0a04a; --ochre-soft:#332715; --ochre-ink:#f0c98a; --bad:#f28b82; color-scheme: dark;
}} }}
:root[data-theme="dark"] {{
  --bg:#0f1419; --surface:#171d25; --surface-2:#1f2730; --ink:#e6eaf0; --ink-2:#c3cad3; --muted:#8f9aa7; --rule:#2b3440;
  --teal:#3fbfa8; --teal-soft:#14302c; --teal-ink:#8fe0d1; --ochre:#e0a04a; --ochre-soft:#332715; --ochre-ink:#f0c98a; --bad:#f28b82; color-scheme: dark;
}}
* {{ box-sizing: border-box; }}
body {{ margin:0; background:var(--bg); color:var(--ink); font: 16px/1.55 "IBM Plex Sans", system-ui, sans-serif; }}
code {{ font-family:"IBM Plex Mono", ui-monospace, monospace; font-size:.88em; background:var(--surface-2); padding:.05em .35em; border-radius:4px; }}
pre {{ font-family:"IBM Plex Mono", monospace; font-size:14px; background:var(--surface); border:1px solid var(--rule); border-radius:6px; padding:12px 14px; overflow-x:auto; margin:8px 0; }}
pre code {{ background:none; padding:0; font-size:inherit; }}
h1,h2,h3 {{ font-family:"Bricolage Grotesque", sans-serif; font-optical-sizing:auto; margin:0; text-wrap:balance; letter-spacing:-.01em; }}
h1 {{ font-size:44px; font-weight:800; line-height:1; }}
h2 {{ font-size:26px; font-weight:700; margin:44px 0 14px; padding-top:18px; border-top:1px solid var(--rule); }}
h3 {{ font-size:18px; font-weight:600; margin:0 0 6px; }}
p, li {{ max-width:72ch; }}
.wrap {{ max-width:900px; margin:0 auto; padding:48px 28px 96px; }}
.kicker {{ font:13px "IBM Plex Mono", monospace; letter-spacing:.14em; text-transform:uppercase; color:var(--ochre); margin-bottom:14px; }}
.sub {{ color:var(--ink-2); margin-top:12px; font-size:18px; }}
table {{ border-collapse:collapse; width:100%; font-size:15px; margin:10px 0 6px; }}
th {{ text-align:left; font:600 12px "IBM Plex Mono", monospace; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); padding:6px 10px; border-bottom:1px solid var(--rule); }}
td {{ padding:8px 10px; border-bottom:1px solid var(--rule); vertical-align:top; font-variant-numeric:tabular-nums; }}
td.t {{ white-space:nowrap; color:var(--muted); font-family:"IBM Plex Mono", monospace; font-size:13px; }}
.check {{ list-style:none; padding:0; }}
.check li {{ padding:6px 0 6px 30px; position:relative; }}
.check li::before {{ content:""; position:absolute; left:0; top:10px; width:16px; height:16px; border:1.5px solid var(--muted); border-radius:3px; }}
.steps li {{ margin:6px 0; }}
.steps b {{ color:var(--teal-ink); }}
.say {{ border-left:3px solid var(--teal); padding:8px 14px; margin:10px 0; background:var(--surface); color:var(--ink-2); font-style:italic; }}
.warn {{ border-left:3px solid var(--ochre); padding:8px 14px; margin:10px 0; background:var(--ochre-soft); color:var(--ochre-ink); }}
.qa dt {{ font-weight:600; margin-top:14px; }}
.qa dd {{ margin:4px 0 0; color:var(--ink-2); }}
.note {{ padding:18px 0; border-bottom:1px solid var(--rule); }}
.note header {{ display:flex; gap:14px; align-items:flex-start; margin-bottom:8px; }}
.note .n {{ flex:none; width:34px; height:34px; border-radius:6px; background:var(--teal-soft); color:var(--teal-ink); font:600 15px "IBM Plex Mono", monospace; display:grid; place-items:center; }}
.note .eb {{ display:block; font:12px "IBM Plex Mono", monospace; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); }}
.note p {{ margin:6px 0; color:var(--ink-2); }}
@media print {{ body {{ background:#fff; color:#000; }} .wrap {{ padding:0; max-width:none; }} h2 {{ break-before:page; }} h2:first-of-type {{ break-before:auto; }} .note {{ break-inside:avoid; }} }}
</style>
<div class="wrap">
<p class="kicker">Forms v2, code first · presenter copy</p>
<h1>Run sheet</h1>
<p class="sub">Thirty minutes: 19 talking, 8 demo, 3 buffer. Deck is the artifact <em>Forms v2, Code First</em>. Press <code>N</code> in the deck for the same notes as below; <code>#/12</code> in the URL jumps to slide 12.</p>

<h2>Pre-flight (15 minutes before)</h2>
<ul class="check">
<li>Terminal in <code>poc/forms-v2</code>. Packages built: <code>rush build --to @react-typed-forms/core</code> passes (core, react and the compat package, which the parity run needs). Then <code>rushx dev</code>. App at <code>http://localhost:5183</code>.</li>
<li>Optional, for demo 2: in a second terminal run <code>rushx parity</code> before the talk and leave the summary on screen. It takes a minute or two. The headline line should read "140 of 144 runs identical, 19 differences".</li>
<li><code>corpus/servicetas/</code> exists (71 forms). If not: <code>rushx extract-corpus servicetas ~/astrolabe/ServiceTas/ServiceTasAPI/NewClientApp/client-common</code>.</li>
<li>Open the app, click the <b>Legacy form</b> tab once. MastSummary should render with "5 things the loader could not translate". Then back to <b>Details</b>, implementation <b>html</b>, click <b>Reset</b>.</li>
<li>Browser zoom for the room: 125% to 150%. The state table on the left must be readable from the back.</li>
<li>Deck open in its own window, <code>F</code> for fullscreen. Presenter laptop has notes: second window on the same artifact with <code>N</code> pressed, or this page.</li>
<li>Deck and app in two windows you can alt-tab between. Practice the switch once.</li>
<li>Second screen / projector set to mirror or extend; check slide 3's table and slide 14's code are legible.</li>
</ul>

<h2>Timings</h2>
<table>
<thead><tr><th>Clock</th><th>Slides</th><th>Segment</th><th>The one line</th></tr></thead>
<tbody>
<tr><td class="t">0:00</td><td>1</td><td>Title</td><td>Two demos, one argument.</td></tr>
<tr><td class="t">0:30</td><td>2–4</td><td>Where we are, where it hurts</td><td>The editor can't make a component; the only escape hatch is a string.</td></tr>
<tr><td class="t">4:30</td><td>5</td><td>The inversion</td><td>A form is React. JSON loads onto it. No renderer knows.</td></tr>
<tr><td class="t">6:00</td><td>6–10</td><td>Code first, in code</td><td>Every prop reactive; validators at the usage; reuse is a function.</td></tr>
<tr><td class="t">11:30</td><td>11</td><td><b>Demo 1</b></td><td>Same source, four libraries. Stars.</td></tr>
<tr><td class="t">16:30</td><td>12–15</td><td>The abstraction layer</td><td>Shell + frame; guarantees live in the boundary.</td></tr>
<tr><td class="t">20:30</td><td>16–18</td><td>JSON is not going anywhere</td><td>Two promises, one aspiration, no timeline.</td></tr>
<tr><td class="t">24:30</td><td>19</td><td><b>Demo 2</b></td><td>A real ServiceTas form through the loader.</td></tr>
<tr><td class="t">27:30</td><td>20–22</td><td>What it means, what's open, questions</td><td>New forms in JSX once it ships.</td></tr>
</tbody></table>
<p>If you're behind at 16:30, drop slide 14 (the Stars source): slide 12 already made the claim and the demo already showed it. If you're behind at 24:30, do Demo 2 as MastSummary only, skip the warnings box.</p>

<h2>Demo 1 · same source, four libraries (5 min)</h2>
<p>Start state: <b>Details</b> tab, implementation <b>html</b>, freshly <b>Reset</b>.</p>
<ol class="steps">
<li>Click <b>Touch all + validate</b>. Errors appear on First name, Email is clean (empty is allowed), Status, Stars, Pets. Point at the state table: same errors listed there, that's the data, not the DOM.</li>
<li><b>Implementation → MUI.</b> Note it drops you back to the Details tab. Same errors, same table. Then <b>Ant</b>, then <b>Mantine</b>. Don't linger on Mantine; it's the least familiar.</li>
<div class="say">"PersonForm.tsx hasn't changed. It doesn't import any of these. The form is the same; what changed is who draws it."</div>
<li>Back to <b>MUI</b>. <b>Email presence → silent</b>. The email field leaves the screen. In the table, <code>email</code> keeps its row. Type into another field if you want to show nothing else moved.</li>
<div class="say">"This is a tab you're not looking at. Unmounted isn't hidden. It still validates and it doesn't clear."</div>
<li><b>Email presence → hidden.</b> The row's error clears; with clearHidden ticked the value would too.</li>
<li>Set presence back to <b>rendered</b>. Click the <b>Pets</b> tab. Tick <b>Lock the pets region (readOnly)</b>. Edit, Remove and Add grey out. Untick.</li>
<li>Click <b>Details</b>, scroll to the bottom: <b>How did we do?</b> with the stars. Click a star, then click away, then clear it and click away to show "Please rate us" in MUI's helper-text style.</li>
<div class="say">"Who wrote MUI code for this widget? Nobody. It asked the active implementation for a field shell and drew stars inside it."</div>
<li>Optional, if ahead: tick <b>Override the "add" action by id</b>, go to Pets, the Add button becomes the sparkle button. One id, every collection.</li>
</ol>
<div class="warn">If a switch looks wrong: click <b>Reset</b>, set implementation to <b>html</b>, and carry on. The state table is the truth; if it agrees with itself the demo has made its point.</div>

<h2>Demo 2 · a real form through the loader (3 min)</h2>
<p>Start state: implementation <b>MUI</b> already selected (switching resets the tab, so do it first).</p>
<ol class="steps">
<li>Click the <b>Legacy form</b> tab. <b>MastSummary · 63</b> is selected. Read the grey line: <code>formDefs/MastSummary.json</code>, "5 things the loader could not translate". Scroll once: Licences with its text fields and checkboxes, the nested Pending Renewals group, then the three arrays with their Add buttons.</li>
<div class="say">"This is the ServiceTas MastSummary form, byte for byte what's in the repo. It went through the loader and came out as the same components you saw on the other tabs. Under MUI, because that's what's selected."</div>
<li><b>Implementation → Ant</b>, then back to the <b>Legacy form</b> tab (the switch returns you to Details). Same form, Ant chrome. Back to <b>MUI</b>, back to the tab.</li>
<li>Tick <b>Show what the loader could not translate</b>. Read two aloud. They name a path and a property. Untick.</li>
<div class="say">"Five for this form. Over the whole corpus, 777, and nineteen forms have none. That number is the work list, and it's the acceptance test for goal six."</div>
<li>If ahead: <b>Legacy form → Fire · 35</b>, the materials radio list with descriptions; the broken image icons are icon-display gaps, say so. Or <b>Address · 38</b>, small and familiar, 6 warnings.</li>
<li>If you ran <code>rushx parity</code> beforehand: alt-tab to that terminal. The summary is one screen: 72 forms, two fixtures each, 140 of 144 identical, and the worst run named. Sixteen of the nineteen differences are TUP.</li>
<div class="say">"That's the same forms, through the legacy stack and through v2, diffed at every path. This is the acceptance test for 'identical semantics', and it's not zero yet."</div>
</ol>
<div class="warn">Avoid <b>ContactUs</b> live: its icon-list actions render as large blue blocks (the icon names become button text). MastSummary, Fire and Address are the tested three. The summary forms (MastLicenceSummary, MrsSummary) are display-heavy and show almost nothing without data. The ServiceTas Tailwind classes (<code>body</code>, <code>title1</code>) come through on the elements but the POC ships no stylesheet for them, which is why spacing is plain. Say it before someone asks.</div>

<h2>Questions to expect</h2>
<dl class="qa">
<dt>When?</dt><dd>No timeline. Two instruments say how far off it is: the loader's work list and the parity run. When both are clean enough. Don't be drawn into a quarter.</dd>
<dt>How do you know the loader behaves the same as legacy?</dt><dd>We measure it. <code>rushx parity</code> runs every corpus form through the legacy stack itself, headless, and through v2, over the same fixture data, and diffs the values and errors at every path. 140 of 144 runs identical today; the 19 differences are classified, and 16 of them are one form and one deliberate rule. Its first run caught a real v2 bug the work list couldn't see.</dd>
<dt>So the editor is dead?</dt><dd>No. Goal 7: reimplemented against the v2 renderers, previewing against any web implementation. It produces the same JSON. What it needs from the library is an editing mode and a preview, both of which the POC already has.</dd>
<dt>Do I have to rewrite my existing forms?</dt><dd>No. Production forms stay on the legacy schemas stack, which already runs on the compat engine today. Migration onto the loader is per form and optional.</dd>
<dt>Does jsonata go away?</dt><dd>Not on the JSON path. It's 418 uses in half the forms. The loader evaluates it into a Control and the prop follows the control. On the JSX path you write a function instead.</dd>
<dt>Can a JSX form be opened in the editor?</dt><dd>No, and deliberately: there's no round-trip from JSX to JSON. If a form needs the editor, it's a JSON form. That's what the "who is the author" rule decides.</dd>
<dt>React Native?</dt><dd>Goal 4, for the built-in set: the contract package has no DOM in it, and text/container class slots are split for exactly this reason. Not built yet.</dd>
<dt>Why not fix the current @rx-controls/forms?</dt><dd>It was a proof of concept to find out what a renderer set needs, and it did its job. Several things it taught us (presence as three states, validators above the boundary, no schema on the binding) are structural, not patches.</dd>
<dt>Can I write my own widget without knowing all this?</dt><dd>Yes. One implementation function, <code>fieldRenderer(MyImpl)</code>, and <code>useFieldShell()</code> for the chrome. The boundary does the rest. Stars is 40 lines.</dd>
<dt>What about the classes we've put in every form?</dt><dd>They come through as the five class slots and the <code>@</code> replace prefix becomes <code>{{ replace }}</code>. On the JSX path they become components, which is the point of slide 3.</dd>
</dl>

<h2>Speaker notes, by slide</h2>
{notes_html}
</div>
'''
OUT.write_text(doc)
print(f"wrote {OUT} · {len(doc)//1024} KB")
