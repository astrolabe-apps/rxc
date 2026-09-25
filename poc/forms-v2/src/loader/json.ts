/**
 * The JSON format — a small, faithful subset of `ControlDefinition` and
 * `SchemaField`.
 *
 * These types live *here*, in the loader, and nowhere else. That is the whole
 * claim of the design: no renderer, no boundary and no binding mentions them.
 */

export type FieldType =
  | "String"
  | "Int"
  | "Double"
  | "Bool"
  | "Date"
  | "DateTime"
  | "Time"
  | "Compound";

export interface SchemaField {
  /**
   * UI state, not data: legacy binds a `meta` field to a side control on the
   * parent (`metaFields`), never to the value that is submitted. 75 in the
   * corpus — `showPostalAddressDetails`, `cardDetails`, `errorText` (README
   * finding 66).
   */
  meta?: boolean | null;
  field: string;
  type: FieldType;
  displayName?: string;
  collection?: boolean;
  options?: { name: string; value: string | number }[];
  children?: SchemaField[];
}

export type EntityExpression =
  | { type: "Data"; field: string }
  | { type: "NotEmpty"; field: string; empty?: boolean }
  | { type: "DataMatch"; field: string; value: unknown }
  /** `DataMatch` as the C# server actually serialises it — 296 of the corpus's expressions. */
  | { type: "FieldValue"; field: string; value: unknown }
  /** Anything else — `UserMatch`, `Not`, or an entry with no type — is reported, not guessed at. */
  | { type: string; [k: string]: unknown }
  | { type: "Jsonata"; expression: string };

export type DynamicPropertyType =
  | "Visible"
  | "Disabled"
  | "Label"
  | "ActionData"
  | "Display"
  | "AllowedOptions"
  | "DefaultValue";

export interface DynamicProperty {
  type: DynamicPropertyType;
  expr: EntityExpression;
}

export type ValidatorDef =
  | {
      type: "Length";
      min?: number;
      max?: number;
    }
  | { type: "Jsonata"; expression: string }
  | {
      type: "Date";
      comparison?: string;
      fixedDate?: string;
      daysFromCurrent?: number;
    };

/**
 * Deliberately open: the real format has six adornment types and hosts add
 * their own, so a loader meets ones it has never heard of. Nothing here
 * translates any of them — which is what the warning is for.
 */
export interface ControlAdornment {
  type: string;
  [k: string]: unknown;
}

export interface ControlDefinition {
  type: "Data" | "Group" | "Action" | "Display";
  title?: string;
  /** Data controls only. */
  field?: string;
  required?: boolean;
  requiredErrorText?: string;
  /** Do not render the control's label (a group's title lives in `groupOptions.hideTitle`). */
  hideTitle?: boolean;
  hidden?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  dontClearHidden?: boolean;
  /** Written while shown and undefined — legacy's default-value cycle. */
  defaultValue?: unknown;
  /** The four class slots — see goals decision 4. `"@ "` prefix = replace. */
  styleClass?: string | null;
  textClass?: string | null;
  layoutClass?: string | null;
  labelClass?: string | null;
  labelTextClass?: string | null;
  renderOptions?: { type: string; [k: string]: unknown };
  /** Not selectable — a top-level flag in the corpus, mostly on displays. */
  noSelection?: boolean | null;
  /** Display controls only. */
  displayData?: {
    type: string;
    text?: string;
    html?: string;
    icon?: { library?: string; name: string };
    /** `Custom`: the id a host's `displays` map answers to. */
    customId?: string;
  };
  groupOptions?: { type: string; [k: string]: unknown };
  validators?: ValidatorDef[];
  dynamic?: DynamicProperty[];
  adornments?: ControlAdornment[];
  children?: ControlDefinition[];
  /** Action controls only. */
  actionId?: string;
  actionText?: string;
  actionData?: string | null;
  actionStyle?: "Button" | "Secondary" | "Link" | "Group" | null;
  icon?: { library?: string; name: string } | null;
  iconPlacement?: "BeforeText" | "AfterText" | "ReplaceText" | null;
  disableType?: "None" | "Self" | "Global" | null;
  /** Children of a Dialog group: `"trigger"` renders outside the dialog. */
  placement?: string | null;
}

export function findField(
  fields: SchemaField[],
  name: string,
): SchemaField | undefined {
  return fields.find((f) => f.field === name);
}
