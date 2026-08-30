import type { ConfigFormat } from "@/types";

export interface Grammar {
  readonly lineComment: readonly string[];
  readonly blockComment: readonly [string, string] | null;
  readonly quotes: readonly string[];
  readonly keywords: ReadonlySet<string>;
  readonly types: ReadonlySet<string>;
  readonly constants: ReadonlySet<string>;
  readonly ignoreCase: boolean;
}

const words = (list: string): ReadonlySet<string> => new Set(list.split(/\s+/).filter(Boolean));

const NONE: ReadonlySet<string> = new Set();

function grammar(patch: Partial<Grammar>): Grammar {
  return {
    lineComment: [],
    blockComment: null,
    quotes: ['"', "'"],
    keywords: NONE,
    types: NONE,
    constants: NONE,
    ignoreCase: false,
    ...patch,
  };
}

const JS_KEYWORDS = words(`
  as async await break case catch class const continue debugger default delete do else export
  extends finally for from function get if import in instanceof let new of return set static
  super switch this throw try typeof var void while with yield
`);

const TS_KEYWORDS = words(`
  abstract declare enum implements infer interface is keyof namespace never override private
  protected public readonly satisfies type unique unknown
`);

const TS_TYPES = words(`
  any bigint boolean number object string symbol undefined void Array Promise Record Partial
  Readonly Pick Omit Map Set Date RegExp Error
`);

const JS_CONSTANTS = words("true false null undefined NaN Infinity");

const SQL_KEYWORDS = words(`
  add all alter and as asc begin between by cascade case cast column commit constraint create
  cross default delete desc distinct drop else end exists foreign from full group having if in
  index inner insert into is join key left like limit not null offset on or order outer primary
  references rename replace returning right rollback select set table then transaction union
  unique update using values view when where with
`);

const SQL_TYPES = words(`
  bigint boolean bytea char date decimal double float int integer json jsonb numeric real serial
  smallint text time timestamp timestamptz uuid varchar
`);

const SHELL_KEYWORDS = words(`
  case do done elif else esac exit export fi for function if in local readonly return set shift
  source then unset until while
`);

const CSS_KEYWORDS = words(`
  and charset container font-face import important keyframes layer media not only supports
`);

const DOCKER_KEYWORDS = words(`
  ADD ARG CMD COPY ENTRYPOINT ENV EXPOSE FROM HEALTHCHECK LABEL ONBUILD RUN SHELL STOPSIGNAL
  USER VOLUME WORKDIR
`);

const NGINX_KEYWORDS = words(`
  access_log add_header client_max_body_size error_log events expires gzip http include index
  keepalive_timeout listen location proxy_pass proxy_set_header return root server server_name
  ssl_certificate ssl_certificate_key try_files upstream worker_connections worker_processes
`);

const C_LINE = ["//"] as const;
const C_BLOCK = ["/*", "*/"] as const;
const JS_QUOTES = ['"', "'", "`"] as const;

export const GRAMMARS: Readonly<Record<ConfigFormat, Grammar | null>> = {
  json: null,
  env: null,
  yaml: null,
  html: null,
  xml: null,
  text: null,

  javascript: grammar({
    lineComment: C_LINE,
    blockComment: C_BLOCK,
    quotes: JS_QUOTES,
    keywords: JS_KEYWORDS,
    constants: JS_CONSTANTS,
  }),
  typescript: grammar({
    lineComment: C_LINE,
    blockComment: C_BLOCK,
    quotes: JS_QUOTES,
    keywords: new Set([...JS_KEYWORDS, ...TS_KEYWORDS]),
    types: TS_TYPES,
    constants: JS_CONSTANTS,
  }),
  jsx: grammar({
    lineComment: C_LINE,
    blockComment: C_BLOCK,
    quotes: JS_QUOTES,
    keywords: JS_KEYWORDS,
    constants: JS_CONSTANTS,
  }),
  tsx: grammar({
    lineComment: C_LINE,
    blockComment: C_BLOCK,
    quotes: JS_QUOTES,
    keywords: new Set([...JS_KEYWORDS, ...TS_KEYWORDS]),
    types: TS_TYPES,
    constants: JS_CONSTANTS,
  }),
  css: grammar({ blockComment: C_BLOCK, keywords: CSS_KEYWORDS }),
  sql: grammar({
    lineComment: ["--"],
    blockComment: C_BLOCK,
    quotes: ["'", '"'],
    keywords: SQL_KEYWORDS,
    types: SQL_TYPES,
    constants: words("true false null"),
    ignoreCase: true,
  }),
  shell: grammar({
    lineComment: ["#"],
    quotes: JS_QUOTES,
    keywords: SHELL_KEYWORDS,
    constants: words("true false"),
  }),
  dockerfile: grammar({ lineComment: ["#"], keywords: DOCKER_KEYWORDS, ignoreCase: true }),
  nginx: grammar({ lineComment: ["#"], keywords: NGINX_KEYWORDS }),
};

export const CONFIG_FORMAT_LABELS: Readonly<Record<ConfigFormat, string>> = {
  json: "JSON",
  env: "ENV",
  yaml: "YAML",
  javascript: "JavaScript",
  typescript: "TypeScript",
  jsx: "JSX",
  tsx: "TSX",
  html: "HTML",
  xml: "XML",
  css: "CSS",
  sql: "SQL",
  shell: "Shell",
  dockerfile: "Dockerfile",
  nginx: "Nginx",
  text: "Plain Text",
};

export const CONFIG_FORMATS = Object.keys(CONFIG_FORMAT_LABELS) as readonly ConfigFormat[];

export function isConfigFormat(value: unknown): value is ConfigFormat {
  return typeof value === "string" && Object.hasOwn(CONFIG_FORMAT_LABELS, value);
}
