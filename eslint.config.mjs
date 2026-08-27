import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescriptConfig from "eslint-config-next/typescript";

/**
 * Flat config — eslint-config-next 16 ships flat presets directly.
 *
 * The blocks below are the design system's enforcement. A component library
 * nobody is obliged to use is a component library nobody uses: the audit found
 * a complete, correct cmdk wrapper with one consumer sitting beside four
 * surfaces that hand-rolled the same search-and-pick interaction. So the old
 * spelling fails the build rather than merely being discouraged.
 *
 * Every rule names the token or component to use instead. A lint error that
 * says "don't" without saying "do this" just gets suppressed.
 */

/** Files that legitimately own raw values: the primitives themselves. */
const DESIGN_SYSTEM_SOURCES = [
  "src/components/ui/**",
  "src/app/globals.css",
  // The document type ramp is a content scale, not a UI scale — a page's
  // headings are the document's own typography and do not belong to the app
  // chrome's four steps.
  "src/lib/block-visuals.ts",
];

const bannedClassName = (pattern, message) => ({
  selector: `JSXAttribute[name.name='className'] Literal[value=/${pattern}/]`,
  message,
});

const config = [
  ...coreWebVitals,
  ...typescriptConfig,
  { ignores: [".next/**", "coverage/**", "node_modules/**", "next-env.d.ts"] },

  {
    files: ["src/**/*.tsx"],
    ignores: DESIGN_SYSTEM_SOURCES,
    rules: {
      "no-restricted-syntax": [
        "error",
        bannedClassName(
          "\\btext-\\[\\d",
          "Use a typography token — text-micro (10) / text-body (11) / text-ui (12) / text-lead (13) / text-title (15) / text-display (18) / text-code. An arbitrary pixel size is how 568 of them ended up on screen with no rule behind any of them.",
        ),
        bannedClassName(
          "\\bz-\\[?\\d",
          "Use a layer token — z-raised / z-sticky / z-overlay / z-dropdown / z-modal / z-toast / z-tooltip. Eleven surfaces used to claim z-50 and settle their order by DOM accident.",
        ),
        bannedClassName(
          "shadow-(2xl|xl|lg|md|sm)\\b",
          "Use shadow-raise / shadow-pop / shadow-float. Tailwind's stock shadows are black, which reads as dirt on this app's navy dark theme rather than as lift.",
        ),
        bannedClassName(
          "disabled:opacity-\\d",
          "Disabled is one value: disabled:opacity-[var(--disabled-opacity)] — or the is-disabled utility when the state is not the DOM `disabled` attribute. It was five different values, so nothing disabled looked the same as anything else disabled.",
        ),
        bannedClassName(
          "\\bopacity-(30|55|70)\\b",
          "Off the state scale. Use is-disabled / is-dragging / is-pending / is-frozen, which name what is true rather than how faded it happens to be.",
        ),
        {
          selector: "JSXOpeningElement[name.name='select']",
          message:
            "Use <SelectField> (native, for plain option lists) or <Select> (popover, when an option needs an icon, colour, avatar or description) from @/components/ui.",
        },
        {
          selector: "JSXOpeningElement[name.name='textarea']",
          message:
            "Use <Textarea> from @/components/ui/textarea. The exceptions — the code editor's transparent caret layer — live in src/components/devtools and are opted out below.",
        },
        {
          selector:
            "JSXOpeningElement[name.name='input'] > JSXAttribute[name.name='type'][value.value='checkbox']",
          message: "Use <Checkbox> from @/components/ui/checkbox.",
        },
        {
          selector:
            "JSXOpeningElement[name.name='input'] > JSXAttribute[name.name='type'][value.value='radio']",
          message: "Use <RadioGroup> / <RadioCard> from @/components/ui/radio-group.",
        },
        {
          /**
           * Four surfaces reached for the browser's own date field, and it is
           * a different control in every browser — Chrome draws a dropdown
           * calendar, Safari draws a stepper, Firefox draws neither at the
           * size the rest of the row is. None of them can be themed, so a
           * date field was the one control in a form that did not belong to
           * this app. The type is matched by value and by expression, because
           * three of the four wrote `type={isDate ? "date" : "text"}`.
           */
          selector:
            "JSXAttribute[name.name='type'] :matches(Literal[value='date'], Literal[value='datetime-local'])",
          message:
            "Use <DatePicker> from @/components/ui/date-picker — one day, one click, and a value that is a day key rather than a timestamp. A native date input cannot be themed and is a different control in every browser.",
        },
      ],
    },
  },

  {
    /**
     * The code editor stacks a transparent textarea over a highlighted <pre>
     * and syncs their scroll. That is a mechanism, not a style: wrapping it in
     * a design-system component would obscure it, and its exact type metrics
     * have to stay byte-identical or the caret drifts out of the glyphs.
     */
    files: [
      "src/components/devtools/code-editor.tsx",
      "src/components/document/blocks/code-block.tsx",
      "src/components/files/preview/text-preview.tsx",
      "src/components/comments/mention-textarea.tsx",
    ],
    rules: { "no-restricted-syntax": "off" },
  },
];

export default config;
