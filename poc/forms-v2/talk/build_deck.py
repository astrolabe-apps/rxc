#!/usr/bin/env python3
"""Builds the Forms v2 deck as a single HTML file. Code snippets are passed raw and escaped here."""
import html, json, pathlib

OUT = pathlib.Path(__file__).parent / "forms-v2-deck.html"

def esc(s): return html.escape(s, quote=False)

def code(lang, src, cls=""):
    return f'<pre class="code {cls}" data-lang="{lang}"><code>{esc(src.strip("\n"))}</code></pre>'

def pair(json_src, jsx_src, json_cap="JSON · today", jsx_cap="JSX · v2"):
    return f'''<div class="pair">
  <figure class="frame json"><figcaption>{json_cap}</figcaption>{code("json", json_src)}</figure>
  <figure class="frame jsx"><figcaption>{jsx_cap}</figcaption>{code("tsx", jsx_src)}</figure>
</div>'''

slides = []
def slide(eyebrow, body, notes, cls=""):
    slides.append((eyebrow, body, notes, cls))

# ───────────────────────── 1 title
slide("", '''
<div class="title">
  <p class="kicker">rx-controls · forms</p>
  <h1>Forms v2<br><span class="alt">code first,</span><br>JSON when it earns it</h1>
  <p class="sub">What changes for the people who build forms here, what doesn't, and one thing we're promising.</p>
</div>''', """
Thirty minutes. Two demos. One argument.

The argument: a form should be React first, and the JSON format we've all been writing should
become something we load onto that, not the thing we build in. I'll show you why, show you the
code, and then spend real time on what happens to the editor and the forms already in production,
because I know that's the question in the room.
""", "title-slide")

# ───────────────────────── 2 today
slide("Where we are", '''
<h2>How a form gets built today</h2>
<div class="flow">
  <div class="node ochre"><b>Form editor</b><span>drag, drop, set properties</span></div>
  <div class="arrow"></div>
  <div class="node ochre"><b>ControlDefinition JSON</b><span>+ schema generated from C#</span></div>
  <div class="arrow"></div>
  <div class="node ochre"><b>dynamic / jsonata</b><span>the escape hatch</span></div>
  <div class="arrow"></div>
  <div class="node"><b>Renderer set</b><span>@react-typed-forms/schemas-html</span></div>
</div>
<div class="cols two">
  <div><h3 class="good">What it does well</h3><ul>
    <li>Someone who isn't a developer can build a form</li>
    <li>One format, server schema and client form agree</li>
    <li>The same definition targets web and native (<code>native:flex-1</code> is in 67 controls)</li>
  </ul></div>
  <div><h3 class="bad">Where it hurts</h3><ul>
    <li>Developers writing JSON they'd rather write in code</li>
    <li>The only way to say "this thing, again" is copy and paste</li>
    <li>The only way to make it clever is a string in a text box</li>
  </ul></div>
</div>''', """
Be fair to it. This stack has shipped ServiceTas. The editor is a real product, and "a non-developer
can build a form" is a genuine capability we're keeping.

But most of the people in this room are developers who have used the editor to build forms. And
when a developer uses a tool meant for non-developers, two things happen. You lose your tools:
no types, no refactoring, no components, no tests. And you reach for the escape hatch a lot.
The next two slides put numbers on both.
""")

# ───────────────────────── 3 copy paste
slide("Where it hurts · 1", '''
<h2>The editor can't make a component</h2>
<p class="lede">Every ServiceTas form, every control carrying a class. Same signature means same type, same render options, same classes, same adornments.</p>
<div class="stats">
  <div class="stat"><b>3,139</b><span>controls carry a class</span></div>
  <div class="stat"><b>130</b><span>signatures repeated five or more times</span></div>
  <div class="stat"><b>2,248</b><span>of those controls are one of the 130</span></div>
</div>
<table class="rep">
<thead><tr><th>What it is</th><th>Times</th><th>Forms</th><th>What it wanted to be</th></tr></thead>
<tbody>
<tr><td><code>Display</code> · <code>textClass: body</code></td><td>454</td><td>41</td><td><code>&lt;Body&gt;</code></td></tr>
<tr><td><code>Display</code> · <code>textClass: body-bold</code></td><td>135</td><td>15</td><td><code>&lt;Body bold&gt;</code></td></tr>
<tr><td><code>Group</code> · <code>@ flex flex-col gap-[16px]</code></td><td>69</td><td>26</td><td><code>&lt;Stack gap={16}&gt;</code></td></tr>
<tr><td><code>Action</code> · <code>p-0 !text-accent underline body-bold</code></td><td>41</td><td>3</td><td><code>&lt;LinkButton&gt;</code></td></tr>
<tr><td><code>Group</code> · <code>border border-accent p-[16px] flex flex-col gap-[12px]</code></td><td>32</td><td>3</td><td><code>&lt;Callout&gt;</code></td></tr>
</tbody></table>''', """
I counted this yesterday from the extracted corpus. Seventy-one ServiceTas forms.

Three thousand controls carry a class. Seventy percent of them are one of a hundred and thirty
repeated shapes. A Display with textClass "body" appears four hundred and fifty four times across
forty one forms. That's a component. It was always a component. The editor just has no way to say so,
so every one of those is a copy, and when the design system changes "body" to something else,
that's four hundred and fifty four edits, or a regex over JSON.

The right-hand column is the point. Each of these is one line of React.
""")

# ───────────────────────── 4 jsonata
slide("Where it hurts · 2", '''
<h2>The only escape hatch is a string</h2>
<p class="lede">Real <code>Visible</code> expressions from the corpus. No types, no completion, no refactor, no test, no stack trace.</p>
<div class="quotes">
  <code>$boolean(registrationStatus.renewalAvailable) and $boolean($meta.regoRenewalAvailable)</code>
  <code>detailsMatch and $exists($meta.hasMastAccount) and $meta.hasMastAccount</code>
  <code>errorCode in ["1099", "1199", "1599"] ? false : true</code>
  <code>initialType='Permit' and $toMillis(details.registration.startDate,"[Y0001]-[M01]-[D01]")&lt;=$millis()+259200000</code>
</div>
<div class="stats small">
  <div class="stat"><b>418</b><span>jsonata uses across 40 of 80 forms</span></div>
  <div class="stat"><b>599</b><span><code>Visible</code> dynamic properties in 43 forms</span></div>
  <div class="stat"><b>259200000</b><span>is three days, in one of them</span></div>
</div>''', """
These are verbatim. The last one hides a control unless the permit started within three days,
and the three days is a millisecond literal because there's nowhere to put a constant.

I want to be careful here: jsonata isn't the villain. It's load-bearing. Four hundred and eighteen
uses in half the forms. Any plan that treats it as optional is wrong, and v2 keeps it for the JSON
path. The point is different: when a developer is writing the form, this is a worse version of the
language they already have open in the next tab.
""")

# ───────────────────────── 5 inversion
slide("The idea", '''
<h2>The inversion</h2>
<div class="thesis">
  <p><b>A form is React.</b></p>
  <p><b>JSON is an input format</b> that loads onto the same surface.</p>
  <p><b>No renderer knows JSON exists.</b></p>
</div>
<div class="flow inv">
  <div class="lane">
    <div class="node teal"><b>You write JSX</b><span>typed, reactive, componentised</span></div>
  </div>
  <div class="lane">
    <div class="node ochre"><b>Editor writes JSON</b><span>same format as today</span></div>
    <div class="arrow"></div>
    <div class="node ochre"><b>Loader</b><span>the only code that reads a ControlDefinition</span></div>
  </div>
  <div class="join"></div>
  <div class="node wide"><b>Boundaries</b><span>validators · presence · locks · class slots · design mode</span></div>
  <div class="arrow down"></div>
  <div class="node wide"><b>Implementation</b><span>HTML · MUI · Ant · Mantine · React Native · yours</span></div>
</div>''', """
This is the whole talk on one slide.

Today the JSON is the centre and JSX is something you sneak in around the edges with a custom
renderer. Flip it. The JSX component surface is the design. The loader is a translator that reads
the JSON and produces exactly what you would have typed by hand: the same components, the same
props. Everything below the line, the boundaries and the implementations, is shared and has no idea
which path the form came from.

Two consequences. Anything you can do in JSON, you can do in JSX, because JSON compiles to JSX.
And anything we make better below the line, both paths get.
""")

# ───────────────────────── 6 bound field
slide("Code first · a field", '''
<h2>A bound field</h2>
''' + pair('''
{
  "type": "Data",
  "field": "firstName",
  "title": "First name",
  "required": true,
  "renderOptions": { "type": "Standard" },
  "placeholder": "Ada"
}
''', '''
<TextField
  field={f.firstName}
  label="First name"
  required
  placeholder="Ada"
/>
''') + '''
<ul class="notes-inline">
  <li><code>f.firstName</code> is a typed <code>Control&lt;string&gt;</code>. Rename the field in the type and this fails to compile.</li>
  <li>The label is a prop. There is no schema on this side, and nothing reads one.</li>
</ul>''', """
The plainest possible field, side by side. Same information, but on the right the compiler knows
firstName exists and is a string. That's not a nicety, that's the difference between finding a
broken binding at build time and finding it when a tester notices a field is blank.

Note what's not there: no schema. On the JSX path there's nothing to look a label up from, so
the label is a prop you write. The type of the data is where TypeScript was getting your field
names from all along.
""")

# ───────────────────────── 7 dynamic
slide("Code first · a dynamic prop", '''
<h2>Making one prop dynamic</h2>
''' + pair('''
{
  "type": "Data",
  "field": "vetName",
  "title": "Vet's name",
  "required": true,
  "dynamic": [{
    "type": "Visible",
    "expr": { "type": "Jsonata",
              "expression": "hasPets" }
  }]
}
''', '''
<TextField
  field={f.vetName}
  label="Vet's name"
  required
  hidden={(rc) => !rc.getValue(f.hasPets)}
/>

<TextField
  field={f.notes}
  multiline
  label={(rc) =>
    `Notes (${rc.getValue(f.notes).length} chars)`}
/>
''') + '''
<p class="rule"><b>Every prop is a <code>FormProp&lt;T&gt;</code></b> = <code>T</code> | <code>(rc) =&gt; T</code> | <code>Control&lt;T&gt;</code>. A literal, a derivation, or a control to follow. Same mechanism for <code>label</code>, <code>disabled</code>, <code>options</code>, <code>className</code>.</p>''', """
This is the replacement for dynamic properties, and it's the same thing you already know from
rx-controls: a function of the read context. Whatever you read inside it, the prop tracks. Nothing
else re-renders. And hidden is a prop on the field itself, the same as disabled and readOnly, so
hiding one field is one line on that field. Hiding a region is the same prop on a group, which is
slide nine.

The rule at the bottom matters more than the example. Every prop, not some props. So making a
label dynamic doesn't mean restructuring the tree or finding a different component. You replace
a string with a function. The third arm, a Control, is how the JSON path expresses jsonata:
an async expression evaluates into a control and the prop simply is that control.
""")

# ───────────────────────── 8 validators
slide("Code first · validation", '''
<h2>Validators are declared where the field is used</h2>
''' + pair('''
{
  "type": "Data",
  "field": "email",
  "required": true,
  "validators": [{
    "type": "Jsonata",
    "expression":
      "$contains(email, '@') ? null
        : 'That does not look like an email'"
  }]
}
''', '''
<TextField
  field={f.email}
  label="Email"
  inputType="email"
  validate={{
    shape: (v) => !v || v.includes("@")
      ? null : "That does not look like an email",
    length: (v) => !v || v.length < 60
      ? null : "Too long",
  }}
/>

<Stars field={f.rating} required
       requiredMessage="Please rate us" />
''') + '''
<ul class="notes-inline">
  <li><b>On the usage, as today.</b> <code>required</code> and <code>validators</code> already live on the control definition, not the <code>SchemaField</code>, and the client never read the schema's. v2 keeps that and writes it down as a rule.</li>
  <li><b>What's new:</b> registered <em>above</em> the renderer. An implementation never receives a validator, so it cannot drop one. A third-party widget gets them right by construction.</li>
</ul>''', """
Two things here, and only one of them is new. Validators live on the usage, not the schema. That
is how it already works: the legacy client never read required or validators off the SchemaField,
and two controls on the same field can differ today. v2 keeps that and writes it down as a rule,
so a label default from the schema is fine and a validator default never is.

The new part, and the one to remember for the demo: the validator is registered by the wrapper
around the renderer, before the renderer runs. The thing that draws the input never sees it. That
is what makes the Stars widget later validate correctly without its author knowing validation exists,
and it's a property we could never guarantee in the current renderer set, where every custom
renderer had to remember to wire it up.
""")

# ───────────────────────── 9 collections + presence
slide("Code first · regions and rows", '''
<h2>Regions and collections are components too</h2>
<div class="pair">
<figure class="frame jsx wide"><figcaption>JSX · v2</figcaption>''' + code("tsx", '''
<Elements field={f.pets} label="Pets"
          minLength={1} maxLength={3}
          empty={<p>No pets yet.</p>}>
  {(pet, i, row) => (
    <div className="row">
      <TextField field={pet.fields.name} required
                 label={`Pet ${i + 1}`} />
      <Action actionId={StandardActionIds.remove}
              text="Remove" disabled={!row.canRemove}
              onClick={() => row.remove(i)} />
    </div>
  )}
</Elements>
<Action actionId={StandardActionIds.add} text="Add pet"
        disabled={!pets.canAdd}
        onClick={() => pets.add({ name: "" })} />
''') + '''</figure>
<div class="presence">
  <h3>Three presence states, not a boolean</h3>
  <table>
    <thead><tr><th>state</th><th>renders</th><th>validates</th><th>clearHidden</th></tr></thead>
    <tbody>
      <tr><td><code>rendered</code></td><td>yes</td><td>yes</td><td>no</td></tr>
      <tr><td><code>silent</code></td><td>no</td><td><b>yes</b></td><td>no</td></tr>
      <tr><td><code>hidden</code></td><td>no</td><td>no</td><td>yes</td></tr>
    </tbody>
  </table>
  <p><code>silent</code> exists because unmounted is not hidden. A tab you're not looking at still validates, and switching tabs must not wipe what you typed.</p>
</div>
</div>''', """
A repeated row is a render prop: you get the element control, the index, and a row handle with
canRemove and remove. The array-level length rule is on the array. The buttons are the same Action
component you'd write yourself, so a host can override the Add button by id and every collection in
the app picks it up.

The table on the right is a semantic we got wrong before and fixed in the design. Legacy had visible
or not. But a wizard page you're not on, or a tab you've left, is not "hidden": it still has to
validate, and it must not clear its data. That's "silent", and it's produced by the containers,
never by a renderer.
""")

# ───────────────────────── 10 components
slide("Code first · reuse", '''
<h2>Reuse is a function</h2>
''' + pair('''
{ "type": "Display",
  "textClass": "body",
  "displayData": { "type": "Text",
    "text": "Changes to your address…" } }

… 453 more times, in 41 forms
''', '''
export function Body({ bold, children }: BodyProps) {
  return (
    <TextDisplay text={children}
                 textClassName={bold ? "body-bold" : "body"} />
  );
}

export const LinkButton = (p: LinkProps) => (
  <Action {...p} style="link" className="p-0"
          textClassName="text-accent underline body-bold" />
);

// The 69 gap-16 groups need no component at all:
<Stack gap={16}>…</Stack>   // the framework's layout box
''', json_cap="JSON · today, ×454", jsx_cap="JSX · once").replace('<div class="pair">', '<div class="pair tight">', 1) + '''
<p class="rule">Nothing new to learn. A form component is a React component. The 130 repeated shapes from slide 3 are a shared package of small functions, some of them already built in, and a design-system change is one edit.</p>''', """
Back to the copy-paste slide. This is what those four hundred and fifty four Displays become:
a function called Body. The link-styled action becomes LinkButton. And the gap-16 group doesn't
even need a component, because the framework ships a layout box called Stack. You've written
components like this a thousand times, and that's the point. There is no form-specific component model to learn, because
the form components are React components and compose the way React components do.

And when a shared component changes, every form that uses it changes. Today that's a search and
replace across JSON files that no tool understands.
""")

# ───────────────────────── 11 demo 1
slide("Demo · 1", '''
<h2 class="demo-h">Same source, four libraries</h2>
<div class="demo-card">
  <p class="what">What you're about to see</p>
  <ol>
    <li><code>PersonForm.tsx</code> names no UI library. The switcher swaps HTML, MUI, Ant and Mantine at runtime.</li>
    <li>Presence: move the email field to <code>silent</code>. It leaves the screen and its error stays in the state table.</li>
    <li>Lock the pets region. Edit and Remove grey out; the dialog can't open locked.</li>
    <li><b>Stars.</b> A widget that imports nothing from MUI, and gets MUI's label, required marker, help text and error chrome.</li>
  </ol>
</div>''', """
Switch to the browser. Details tab first, HTML implementation. Type nothing, hit "Touch all and
validate" so the errors show. Then change the implementation dropdown: MUI, Ant, Mantine. Point out
the errors are identical and the state table didn't change. Same form, same data, same validation.

Then the email presence dropdown to "silent": the field disappears, the email row in the table still
has its error. That's the tab-you're-not-on case.

Then the Pets tab, tick "Lock the pets region", show the buttons grey out.

Finish on Stars, in Details near the bottom, under MUI. Ask: who wrote MUI code for this? Nobody.
Next slide explains how.
""", "demo")

# ───────────────────────── 12 what every UI lib has
slide("The abstraction layer", '''
<h2>What every UI library has</h2>
<div class="cols two">
  <div>
    <div class="shell-diagram">
      <div class="lbl">Label <span class="req">*</span></div>
      <div class="frame-diagram"><span class="slot">start</span><span class="ctl">the editable surface</span><span class="slot">end</span></div>
      <div class="help">Help text</div>
      <div class="err">Error</div>
    </div>
    <p class="cap">Surveyed eight libraries: MUI, Ant, Mantine, Chakra, shadcn, Base UI, RN Paper, Bootstrap. Every one draws this. They only differ in <em>who</em> renders the input.</p>
  </div>
  <div>
    <h3>Two primitives, resolved from the active implementation</h3>
    <dl class="prims">
      <dt><code>FieldShell</code></dt><dd>label · required · help · error · disabled. A widget that draws its own surface (stars, a map, a signature pad) uses this and nothing else.</dd>
      <dt><code>InputFrame</code></dt><dd>the bordered editable surface with start and end slots <em>inside</em> the border. The control reaches it through a render prop, never as children.</dd>
    </dl>
    <h3>Three families</h3>
    <ul>
      <li><b>Children-hosting</b>, class-driven: Bootstrap, shadcn, our HTML</li>
      <li><b>Self-rendering</b> input, private state: MUI, Ant, Mantine. MUI's notched outline is the hardest case</li>
      <li><b>Headless, render props</b>: Base UI. The generalisation of the other two, and the shape the primitives copy</li>
    </ul>
  </div>
</div>''', """
Here's the abstraction, and it's deliberately small. Every UI library in the survey draws a label
with a required marker, help text, an error, and a framed editable surface with optional icons at
either end. They disagree wildly on how, but not on what.

So the contract has two composable primitives: the shell and the frame. An implementation, meaning
MUI or Ant or our own HTML, provides both. A third-party widget asks for the shell from whichever
implementation is active and draws its own surface inside it. That's how Stars got MUI chrome
without importing MUI.

The frame was the hard one. MUI's floating label that notches the border needs to know if the
field is filled, and the frame never sees the value. We tell it. That's finding three in the POC
readme if anyone wants the gore.
""")

# ───────────────────────── 13 boundary
slide("The abstraction layer", '''
<h2>Everything the framework guarantees happens in the boundary</h2>
<div class="boundary">
  <div class="b-author"><code>&lt;TextField field={f.name} required label="Name" /&gt;</code><span>what the author writes</span></div>
  <div class="b-box">
    <div class="b-title">the boundary <span>generated by <code>fieldRenderer(…)</code></span></div>
    <ul>
      <li>resolve every <code>FormProp</code> in its own tracking window</li>
      <li>register validators, <code>required</code>, defaults</li>
      <li>attach to the nearest validation scope</li>
      <li>apply presence · narrow the disabled / readOnly scope</li>
      <li>route the five class slots · wrap design-mode chrome</li>
      <li>resolve the implementation from the registry</li>
    </ul>
  </div>
  <div class="b-impl"><code>&lt;TextFieldImpl {...resolved} /&gt;</code><span>what actually draws · html / mui / native / yours</span></div>
</div>
<p class="rule">A custom renderer is not a special case. <code>fieldRenderer(MyImpl)</code> produces the same wrapper as the built-in, differing only in how the implementation is found.</p>''', """
This is the mechanism behind the last two slides. The component you write in a form is a boundary,
a generated wrapper. It does everything the framework promises: resolves the reactive props,
registers validators, joins the validation scope, applies presence and the lock cascade, routes
the class slots, wraps design mode chrome. Then it dispatches to an implementation that just draws.

Because all of that happens before dispatch, an implementation can't drop any of it. And because
a custom renderer goes through the same generator, yours can't either. In the current renderer set,
every one of those was something a custom renderer author had to remember. Here they can't forget.
""")

# ───────────────────────── 14 stars code
slide("The abstraction layer", '''
<h2>The third-party widget, in full</h2>
<div class="pair">
<figure class="frame jsx wide"><figcaption>Stars.tsx · imports nothing from MUI, Ant or Mantine</figcaption>''' + code("tsx", '''
function StarsImpl(p: FieldRenderProps<number | undefined>) {
  const Shell = useFieldShell();        // the active implementation's
  const ctl = useNumberInput(p.field);  // value · setValue · state · onBlur
  const max = getProp(ctl.rc, p.maxStars) ?? 5;
  return ctl.rendered(
    <Shell id={p.id} label={p.label} labelAs="legend" surface="custom"
           required={p.required} disabled={ctl.state.disabled}
           helpText={p.helpText} error={p.error}>
      <div className="stars" onBlur={ctl.onBlur}>
        {range(max).map((n) => (
          <button key={n} aria-pressed={n <= (ctl.value ?? 0)}
                  onClick={() => ctl.setValue(n)}>
            {n <= (ctl.value ?? 0) ? "★" : "☆"}
          </button>
        ))}
      </div>
    </Shell>,
  );
}
export const Stars = fieldRenderer(StarsImpl);
''') + '''</figure>
<div class="side">
  <h3>What it got for free</h3>
  <ul>
    <li>MUI's, Ant's and Mantine's label, marker, help and error chrome</li>
    <li><code>required</code> and its message, validated before it ever ran</li>
    <li>the lock cascade: <code>disabled</code> and <code>readOnly</code> from any ancestor</li>
    <li>presence, <code>clearHidden</code>, design-mode chrome</li>
    <li>a reactive <code>maxStars</code> prop, because every prop is a <code>FormProp</code></li>
  </ul>
</div>
</div>''', """
Here's the whole widget, lightly trimmed. One hook for the shell, one controller hook for a number
input, and the last line turns the implementation into a boundary.

The right column is what it didn't have to write. Every item there is something that in the
current renderer set a custom renderer author had to know about and wire up, and usually missed one.
That is the concrete payoff of the "guarantees live in the boundary" rule, and it's also what makes
it safe for a team to write their own widgets: the framework can't be bypassed by accident.
""")

# ───────────────────────── 15 packages
slide("The shape", '''
<h2>Where things live</h2>
<div class="pkgs">
  <div class="pkg keep"><code>@rx-controls/core</code><span>unchanged, published</span></div>
  <div class="pkg keep"><code>@rx-controls/react</code><span>unchanged, published</span></div>
  <div class="pkg ochre"><code>@rx-controls/forms-schema</code><span>SchemaField + ControlDefinition JSON types. No React.</span></div>
  <div class="pkg"><code>@rx-controls/forms-state</code><span>fieldState, cascades, validators, expressions. No React.</span></div>
  <div class="pkg teal big"><code>@rx-controls/forms-react</code><span><b>the contract</b>: boundaries, primitives, controllers, prop types, the loader's registry. No DOM, no class strings.</span></div>
  <div class="pkg impl"><code>forms-html</code></div>
  <div class="pkg impl"><code>forms-native</code></div>
  <div class="pkg impl"><code>forms-mui</code></div>
</div>
<p class="rule">A form imports from <code>forms-react</code> and nothing else. An MUI implementation is the contract's real test, which is why the POC built one.</p>''', """
Quickly, the package shape, because people will ask what they'd import. Core and react you already
have and they don't change. The contract package is forms-react: every component a form author
writes comes from there, and it has no DOM in it, which is what keeps React Native honest.
Implementations are siblings. The JSON types sit in their own package that the loader and the
editor depend on and forms don't.

This is a proposal, from the goals doc. The layout could shift. The rule at the bottom won't.
""")

# ───────────────────────── 16 JSON rule
slide("JSON", '''
<h2>JSON is not going anywhere</h2>
<div class="thesis two-tone">
  <p><span class="teal-t">Developers write JSX.</span></p>
  <p><span class="ochre-t">The editor is for the people who use the systems we build</span>, and need to shape a form inside them.</p>
</div>
<div class="cols two">
  <div class="teal-col"><h3>Reach for JSX when</h3><ul>
    <li>we are the authors of the form</li>
    <li>it has logic, reuse, or a custom widget</li>
    <li>it lives in a codebase with tests and review</li>
  </ul></div>
  <div class="ochre-col"><h3>Reach for the editor when</h3><ul>
    <li>the author is an admin user, not us</li>
    <li>the form has to change without a deploy</li>
    <li>the form is data that the system stores and versions</li>
  </ul></div>
</div>
<p class="rule">The JSON path gets <b>better</b>, not smaller: every improvement below the boundary line reaches both.</p>''', """
Now the half of the talk for the people who've been living in the editor.

The rule is about who the author is, not about what the form is. If a developer is writing it,
it's code. If a customer's admin user is configuring a workflow form inside the product we shipped
them, that has to be data, and the editor is exactly the right tool. Nothing about that changes.

And I want to be precise about "second class". In the design docs it means architecturally
downstream: the JSON compiles to the JSX surface. It does not mean lower quality or best effort.
The loader has an acceptance test against every legacy form we could find. Next slide.
""")

# ───────────────────────── 17 loader
slide("JSON", '''
<h2>The loader</h2>
<div class="cols two">
  <div>
    <ul class="loader-pts">
      <li><b>The only code that reads a <code>ControlDefinition</code>.</b> What it produces is what a JSX author would have typed by hand.</li>
      <li><b>Expressions terminate here.</b> A literal becomes <code>T</code>. A synchronous expression becomes <code>(rc) =&gt; T</code>. Jsonata evaluates into a <code>Control&lt;T&gt;</code> and the prop is that control.</li>
      <li><b>Field references need a cursor, and it's the loader's.</b> <code>a/b</code>, <code>../x</code>, <code>$i</code>, <code>$$</code> resolve exactly as legacy did, on the JSON side only.</li>
      <li><b>It renders anyway, and returns what it couldn't translate.</b> A control no translator matched renders a visible placeholder. Every property nothing read, and every property read but never used, is reported.</li>
    </ul>
  </div>
  <figure class="frame ochre-frame"><figcaption>what a host does with the gaps is the host's choice</figcaption>''' + code("tsx", '''
const { tree, warnings } =
  translateForm(ctx, data, schema, controls);

// or, in a component:
<JsonForm controls={controls} schema={schema}
          data={data}
          renderWarnings={(ws) =>
            <WarningList warnings={ws} />} />

// warnings[i] = { path, kind, subject?, detail }
// kind: control | renderOptions | adornment
//   | dynamic | validator | expression
//   | schema | unread | action
''') + '''</figure>
</div>''', """
The loader is a translator table: one translator per shape in the format, each producing ordinary
components. Two design points worth saying out loud.

Expressions stop at the loader. A dynamic Visible becomes a hidden prop that's a function; a
jsonata expression becomes a control the prop follows. No component below knows jsonata exists,
which is why the same components serve both paths.

And the loader never silently drops anything. It renders what it can and hands back a list of what
it couldn't. Render them, log them, fail a build over them: that's the host's policy. It's also how
we measure progress, which is the next slide.
""")

# ───────────────────────── 18 promises
slide("JSON", '''
<h2>Promises, and one aspiration</h2>
<div class="promises">
  <div class="promise"><span class="tag">promise</span><h3>The editor is reimplemented against the v2 renderers.</h3><p>Not dropped, not frozen. It keeps producing the same JSON, previews against any web implementation, and needs only two things from the forms library: an editing mode and a preview.</p></div>
  <div class="promise"><span class="tag">promise</span><h3>Forms in production keep running.</h3><p>The legacy <code>@react-typed-forms/schemas</code> stack runs unchanged on the compat engine (<code>@react-typed-forms/core@5</code>) today. Nothing shipped has to move to move forward.</p></div>
  <div class="promise asp"><span class="tag">aspiration · goal 6</span><h3>Existing JSON loads with identical semantics.</h3><p>Measured two ways over the corpus, <b>83 forms, 4,283 controls</b>. The loader's own work list: <b>777</b> warnings, almost none a missing translator. And a parity run, every form through legacy and through v2 over the same data, diffing values and errors at every path: <b>140 of 144 runs identical</b>, 19 differences, all classified.</p></div>
</div>
<p class="rule">No timeline. When there is one, it will be because the work list says so.</p>''', """
Read the labels. Two promises, one aspiration, and I'm choosing the words deliberately.

The editor gets reimplemented against the new renderers. It's in the goals as goal seven and it's
scoped: the editor needs an editing mode and a preview from the forms library, and both exist in
the POC already. Your existing skill with the editor carries over because the format it produces
doesn't change.

Production forms keep running. That's not future tense. The legacy schemas stack already runs on
the new engine via the compat package, in a real app, in production.

The aspiration is that every existing JSON form loads and behaves identically. Two instruments.
The first counts what the loader couldn't translate: seven hundred and seventy seven, mostly
decisions about host extensions and designer flags rather than missing translators. The second is
the one that matters: every corpus form run through the legacy stack itself and through v2, over
the same data, and a diff of every value and every error at every path. A hundred and forty of a
hundred and forty four runs identical. Nineteen differences, and we know what each one is.

Worth saying: the first time that parity run executed it found a real v2 bug the work list could
never have seen. A visibility expression that hadn't answered yet was treated as hidden for one
tick, and clearHidden wiped the field at mount. That's exactly the class of bug this is for. It's
still labelled aspiration because nineteen is not zero. No timeline, and if anyone asks me for one
I'll say exactly that.
""")

# ───────────────────────── 19 demo 2
slide("Demo · 2", '''
<h2 class="demo-h">A real form, through the loader</h2>
<div class="demo-card">
  <p class="what">What you're about to see</p>
  <ol>
    <li>The <b>Legacy form</b> tab loads <code>formDefs/Address.json</code> from ServiceTas, unchanged, through <code>&lt;JsonForm&gt;</code>.</li>
    <li>Switch the implementation to MUI. The same JSON, MUI chrome. Nobody wrote an MUI renderer for it.</li>
    <li>Tick <b>show what the loader could not translate</b>. This is the burndown list for one form: rendered anyway, reported honestly.</li>
    <li>The ServiceTas class names come through untouched; the POC just has no CSS for them.</li>
  </ol>
</div>''', """
Back to the browser. Legacy form tab. Address is selected: thirty-eight controls, a form you
recognise. Switch to MUI, then Ant.

Then tick the warnings box. Six items for this form. Read one or two aloud: they're specific,
they name the path and the property. This is what "returns what it couldn't translate" looks like,
and multiplied over eighty-three forms it's the number on the previous slide.

If time allows, pick ContactUs or Fire from the dropdown. If a form looks rough, say why: the classes
are ServiceTas's Tailwind, and the demo has no stylesheet for them. The structure and the bindings
are what to look at.
""", "demo")

# ───────────────────────── 20 what it means
slide("What it means for you", '''
<h2>When it ships</h2>
<div class="cols three">
  <div><h3 class="teal-t">New forms</h3><p>Written in JSX, in the app's codebase, out of shared components. The 130 repeated shapes become a package.</p></div>
  <div><h3 class="ochre-t">Editor forms</h3><p>Still the editor, still the same JSON, loaded through the loader. Choose it because of who the author is.</p></div>
  <div><h3>Custom widgets</h3><p>One function and <code>fieldRenderer(…)</code>. The shell gives you the active library's chrome; the boundary gives you everything else.</p></div>
</div>
<h3>Where to read</h3>
<ul class="reading">
  <li><code>docs/FORMS-V2-GOALS.md</code> the seven goals, the open decisions, the settled structure</li>
  <li><code>docs/FORMS-V2-INTERFACES.md</code> the types a form is built from, with a <em>From JSON</em> note per section</li>
  <li><code>poc/forms-v2/</code> the build, four implementations, and a README of 57 numbered findings</li>
</ul>''', """
So, concretely. Nothing changes today; the current stack stays. When v2 ships, new forms we author go
in JSX. Editor forms stay editor forms. Custom widgets get a lot easier and a lot safer.

The docs are the real source. The goals doc is the one to read if you read one. The interfaces doc
is for when you want to argue with a type. The POC readme is fifty-seven findings, each one a place
the design bent when it met a real UI library, and it's honest about what it doesn't answer.
""")

# ───────────────────────── 21 open
slide("Still open", '''
<h2>What isn't decided</h2>
<ul class="open">
  <li><b>What's left of the renderer-facing API.</b> The level is settled, semantic not element-level. The remaining surface is being trimmed.</li>
  <li><b>Base UI.</b> The headless, render-prop library the shell and frame are shaped like. The POC validated them against MUI, Ant, Mantine and HTML, but never built a Base UI implementation.</li>
  <li><b>The 19 parity differences are decisions, not translators.</b> Sixteen are one form, where legacy expands a radio's per-option children over options an expression computed at runtime and v2 expands over the schema's. Matching it means allocating during render. Three are the <code>Date</code> validator, not yet built.</li>
  <li><b>Recorded divergences.</b> A hidden display-only value: legacy cleared it from the data, v2 never writes from a display. Chosen, and it shows up in the parity run as 37 lines classified "expected".</li>
  <li><b>Package layout</b> is proposed, not fixed.</li>
</ul>
<p class="rule">Questions on any of these are the useful ones.</p>''', """
And what's open, so the Q&A has somewhere to go. None of these are "should we do this". They're
"how does this bit work". The parity differences are the interesting ones: sixteen of the nineteen
are a single form doing something legacy allowed and v2 chose not to, expanding a radio's children
over options that only exist at runtime. Reproducing it costs a rule we'd rather keep. That's a
decision for this room, not a bug to fix quietly. The display-only one is the same shape: legacy
wrote data from a display, v2 won't, and we've said so.
""")

# ───────────────────────── 22 questions
slide("", '''
<div class="title end">
  <h1>Questions</h1>
  <p class="sub">A form is React. JSON loads onto it. No renderer knows the difference.</p>
</div>''', """
Leave the thesis on screen while taking questions.
""", "title-slide")

# ───────────────────────── render
def render():
    n = len(slides)
    sections = []
    for i, (eyebrow, body, notes, cls) in enumerate(slides, 1):
        eb = f'<p class="eyebrow">{esc(eyebrow)}</p>' if eyebrow else ''
        sections.append(f'''<section class="slide {cls}" data-n="{i}">
{eb}
{body}
<aside class="notes">{esc(notes.strip())}</aside>
</section>''')
    slides_html = "\n".join(sections)

    css = pathlib.Path(__file__).parent / "deck.css"
    js = pathlib.Path(__file__).parent / "deck.js"
    doc = f'''<title>Forms v2, Code First</title>
<meta name="description" content="A 30-minute talk: forms as React first, JSON loaded onto the same surface.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
{css.read_text()}
</style>
<div class="deck" id="deck">
<div class="stage" id="stage">
{slides_html}
</div>
<div class="hud">
  <span class="counter"><span id="cur">1</span> / {n}</span>
  <span class="hint">← → to move · N notes · F fullscreen · O overview</span>
</div>
<div class="drawer" id="drawer" hidden><div class="drawer-in"><p class="drawer-title">Speaker notes</p><div id="drawer-body"></div></div></div>
</div>
<script>
{js.read_text()}
</script>
'''
    OUT.write_text(doc)
    print(f"wrote {OUT} · {n} slides · {len(doc)//1024} KB")

if __name__ == "__main__":
    render()
