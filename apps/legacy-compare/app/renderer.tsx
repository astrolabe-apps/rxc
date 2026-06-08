import {
  AdornmentPlacement,
  appendMarkupAt,
  ControlAdornment,
  ControlAdornmentType,
  createAdornmentRenderer,
  createDataRenderer,
  createDisplayRenderer,
  createFormRenderer,
  createGroupRenderer,
  createLabelRenderer,
  deepMerge,
  DisplayDataType,
  FormRenderer,
  GroupRendererProps,
  HelpTextAdornment,
  HtmlDisplay,
  LabelType,
  rendererClass,
  RendererRegistration,
  useUpdatedRef,
} from "@react-typed-forms/schemas";
import clsx from "clsx";
import { ErrorMessage } from "./components/ErrorMessage";
import { AllErrors } from "./components/AllErrors";
import * as Popover from "@radix-ui/react-popover";
import {
  CSSProperties,
  ReactNode,
  useContext,
  useMemo,
} from "react";
import { Control } from "@react-typed-forms/core";
import parse, {
  DOMNode,
  domToReact,
  Element,
  HTMLReactParserOptions,
} from "html-react-parser";
import { DialogContext } from "./DialogContext";
import { FormDefinitions } from "./formDefs";
import {
  createDefaultRenderers,
  DefaultRendererOptions,
  defaultTailwindTheme,
} from "@react-typed-forms/schemas-html";
import { DataGridRenderer } from "@astroapps/schemas-datagrid";
import {
  ExtendedHelpText,
  HtmlDataRendererOptions,
  TopLevelGroupOption,
} from "./formExtensions";

export type FormType = keyof typeof FormDefinitions;

export function createHtmlRenderer(
  makeOnClick: (actionId: string, data: any) => () => void,
) {
  return createDisplayRenderer(
    (props) => (
      <HtmlDisplayRenderer
        {...props}
        html={(props.data as HtmlDisplay).html ?? ""}
        makeOnClick={makeOnClick}
      />
    ),
    { renderType: DisplayDataType.Html },
  );
}

function createHtmlDataRenderer() {
  return createDataRenderer(
    (props) => (
      <HtmlDisplayRenderer
        {...props}
        html={props.control.value ?? ""}
        makeOnClick={() => () => {}}
      />
    ),
    { renderType: HtmlDataRendererOptions.value },
  );
}

const HtmlLabelRenderer = createLabelRenderer(
  (p) => <HtmlLabel label={p.label} />,
  { labelType: LabelType.Text },
);

function HtmlLabel({ label }: { label: ReactNode }) {
  const labelText = useMemo(() => {
    if (typeof label === "string") return parse(label);
    return label;
  }, [label]);
  return labelText;
}

const topLevelGroupRenderer = createGroupRenderer(
  (p, renderers) => <TopLevelGroup groupProps={p} renderers={renderers} />,
  { renderType: TopLevelGroupOption.value },
);

function TopLevelGroup({
  groupProps: {
    className,
    style,
    definition,
    dataContext,
    renderChild,
    formNode,
  },
  renderers,
}: {
  groupProps: GroupRendererProps;
  renderers: FormRenderer;
}) {
  return (
    <div
      className={rendererClass(
        className,
        DefaultRenderOptions.group?.standardClassName,
      )}
      style={style}
    >
      <AllErrors
        definition={definition}
        dataNode={dataContext.parentNode}
        labelRenderer={renderers.renderLabelText}
      />
      {formNode.children.map((c) => renderChild(c))}
    </div>
  );
}

function createHelpTextRenderer(container: HTMLElement | null) {
  return createAdornmentRenderer(
    (p, renderers) => {
      const label = (p.adornment as ExtendedHelpText & ControlAdornment)
        .helpLabel;
      const helpText = (p.adornment as HelpTextAdornment).helpText;
      const Div = renderers.html.Div;
      return {
        apply: appendMarkupAt(
          (p.adornment as HelpTextAdornment).placement ??
            AdornmentPlacement.LabelEnd,
          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                className={clsx(
                  "font-bold text-sm whitespace-nowrap",
                  label && "bg-surface-100 px-1 rounded-md",
                )}
              >
                <i className="fa fa-info-circle mr-2" />
                {renderers.renderLabelText(label)}
              </button>
            </Popover.Trigger>
            <Popover.Portal container={container}>
              <Popover.Content
                className="bg-neutral-900 text-sm text-center font-semibold leading-none text-white min-w-56 max-w-72 rounded-md px-4 py-2 [&_a]:underline"
                side="top"
              >
                <Div
                  className={"body !text-[16px] !text-white"}
                  html={helpText}
                />
                <Popover.Arrow height={7} width={15} />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>,
        ),
        priority: 0,
        adornment: p.adornment,
      };
    },
    { adornmentType: ControlAdornmentType.HelpText },
  );
}

export const DefaultRenderOptions = deepMerge(
  {
    label: {
      requiredElement: ({ Span }) => <Span className="text-red-500"></Span>,
      // Mirror the ServiceTas portal: `formStyles.defaults` blanks
      // `className` and `groupLabelClass`, so the only label class in
      // production is the form-definition's `labelClass` (e.g. "title1").
      className: "",
      controlLabelTextClass: "",
      groupLabelClass: "",
      labelContainer: (c) => (
        <div className="flex gap-4 items-baseline flex-wrap" children={c} />
      ),
    },
    layout: {
      renderError: (e, errorId) =>
        e && <ErrorMessage children={e} id={errorId} />,
    },
    data: {
      inputClass: "form-control",
      selectOptions: { className: "form-control" },
      radioOptions: {
        className: "flex flex-wrap flex-col lg:flex-row gap-4",
        entryClass: "flex items-center gap-2",
        entryWrapperClass: "w-fit",
        labelClass:
          "cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-80",
        checkClass: "peer disabled:opacity-80",
      },
      checkListOptions: {
        className: "flex flex-wrap gap-x-4",
        entryClass: "flex items-center gap-2",
      },
    },
    display: { htmlClassName: "html" },
    group: {
      // Mirror the ServiceTas portal: `formStyles.defaults` blanks
      // `standardClassName` so Standard groups inherit no opinionated
      // flex/gap chrome — only the form-definition's `styleClass`.
      standardClassName: "",
      grid: { defaultColumns: 1 },
      defaultFlexGap: "1em",
    },
    adornment: {
      accordion: {
        titleTextClass: "cursor-pointer",
        togglerClass: "text-accent !text-[20px]",
      },
    },
  } as DefaultRendererOptions,
  defaultTailwindTheme,
);

export interface StdRenderOptions {
  container: HTMLElement | null;
}

export function createStdRenderer(
  defaults: DefaultRendererOptions,
  options: StdRenderOptions,
  ...others: RendererRegistration[]
) {
  return createFormRenderer(
    [
      ...others,
      DataGridRenderer,
      HtmlLabelRenderer,
      createHelpTextRenderer(options.container),
      createHtmlDataRenderer(),
      topLevelGroupRenderer,
    ],
    createDefaultRenderers(defaults),
  );
}

const ActionUrlPrefix = "https://action/";

function HtmlDisplayRenderer({
  html,
  makeOnClick,
  display,
  className,
}: {
  style?: CSSProperties;
  display?: Control<string | undefined>;
  html: string;
  className?: string;
  makeOnClick: (actionId: string, data: any) => () => void;
}) {
  const onClickRef = useUpdatedRef(makeOnClick);
  const realHtml = (display && display.value) ?? html;
  const reactHtml = useMemo(() => {
    const parseOptions: HTMLReactParserOptions = {
      replace: (domNode) => {
        if (domNode instanceof Element && domNode.name === "a") {
          const { href, className, ...others } = domNode.attribs;
          if (href?.startsWith(ActionUrlPrefix)) {
            const actionId = href.substring(ActionUrlPrefix.length);
            return (
              <a
                {...others}
                className={clsx(className, "cursor-pointer")}
                onClick={() => onClickRef.current(actionId, undefined)()}
              >
                {domToReact(domNode.children as DOMNode[], parseOptions)}
              </a>
            );
          }
        }
        return;
      },
    };
    return parse(realHtml, parseOptions);
  }, [realHtml]);
  return <div className={rendererClass(className, "html")}>{reactHtml}</div>;
}

export function useFormTypeRenderer(
  formType: FormType,
  options?: Partial<StdRenderOptions>,
  ...renderers: RendererRegistration[]
) {
  const container = useContext(DialogContext);
  return useMemo(
    () =>
      createStdRenderer(
        DefaultRenderOptions,
        { container, ...options },
        ...renderers,
      ),
    [container, ...renderers],
  );
}
