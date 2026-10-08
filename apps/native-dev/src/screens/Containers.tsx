import { useControl, useReactive, type Rendered } from "@rx-controls/react";
import {
  Action,
  Dialog,
  Disclosure,
  Tabs,
  TextDisplay,
  TextField,
  useWizard,
  Wizard,
} from "@rx-controls/forms-react";
import { Screen } from "./Screen";

/** A page's own action: check the page, then go wherever "the server" says. */
function Continue() {
  const wizard = useWizard();
  return (
    <Action
      actionId="continue"
      text="Continue"
      variant="primary"
      onClick={async () => {
        // Refused, it focuses the field in error and stays.
        if (!(await wizard.check())) return;
        await new Promise((r) => setTimeout(r, 400));
        wizard.goTo("done");
      }}
    />
  );
}

/**
 * Tabs whose second tab holds a required field — Submit switches to it
 * before focusing it — a host-driven wizard, a dialog, a disclosure.
 */
export function Containers(): Rendered {
  const { rendered, update } = useReactive();
  const data = useControl({ one: "x", two: "", who: "", phone: "", note: "" });
  const open = useControl(false);
  const f = data.fields;
  return rendered(
    <Screen title="Containers">
      <Tabs
        items={[
          { key: "one", title: "First", children: <TextField field={f.one} label="On the first tab" /> },
          {
            key: "two",
            title: "Second",
            children: <TextField field={f.two} label="Required, on the second tab" required />,
          },
        ]}
      />
      <Wizard
        navigation="none"
        items={[
          {
            key: "who",
            children: (
              <>
                <TextField field={f.who} label="Who are you?" required />
                <Continue />
              </>
            ),
          },
          { key: "done", children: <TextDisplay text="Thanks — that's everything." /> },
        ]}
      />
      <Disclosure title="Need a callback?">
        <TextField field={f.phone} label="Phone" inputMode="tel" />
      </Disclosure>
      <Action actionId="openNote" text="Add a note" onClick={() => update((wc) => wc.setValue(open, true))} />
      <Dialog open={open} onClose={() => update((wc) => wc.setValue(open, false))} title="A note">
        <TextField field={f.note} label="Note" multiline />
      </Dialog>
    </Screen>,
  );
}
