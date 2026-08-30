import { beforeEach, describe, expect, test } from "vitest";
import { canFormat, formatSource, NO_FORMATTER_HINT } from "@/lib/code-format";
import {
  isConventionalSecretKey,
  isValidSecretKey,
  parseEnv,
  toEnvText,
} from "@/lib/env-file";
import { CONFIG_FORMATS, formatFromName, isConfigFormat, tokenize } from "@/lib/syntax";
import { devtoolsService } from "@/services/devtools-service";
import { resetSimulation, setSimulation } from "@/services/simulation";
import { doc, hydrate, project, type NodeSpec } from "@/mock/factory";
import { MEMBERS } from "@/mock/users";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { DriveNode, WorkspaceRole } from "@/types";

import { testWorkspace } from "./helpers";
import { devtoolsFake } from "./msw/fake/devtools.fake";

const WORKSPACE_ID = "ws_sec";

function buildTree(): readonly DriveNode[] {
  const specs: readonly NodeSpec[] = [
    project({
      name: "Platform",
      color: "var(--kind-code)",
      updatedHoursAgo: 1,
      children: [
        doc({ name: "Service config", documentKind: "config", icon: "⚙️", blockCount: 0, excerpt: "", updatedHoursAgo: 2 }),
        doc({ name: "Service secrets", documentKind: "secret", icon: "🔐", blockCount: 0, excerpt: "", updatedHoursAgo: 3 }),
      ],
    }),
  ];

  return hydrate(specs, { workspaceId: WORKSPACE_ID, parentId: null, idPrefix: "s" });
}

const ID = {
  config: "s_platform_service_config",
  secret: "s_platform_service_secrets",
} as const;

/** Re-seat the signed-in user at a different role, to prove a refusal. */
function signedInAs(role: WorkspaceRole) {
  const workspace = testWorkspace(WORKSPACE_ID);

  useWorkspaceStore.setState({
    workspaces: [
      {
        ...workspace,
        members: MEMBERS.map((member, index) => (index === 0 ? { ...member, role } : member)),
      },
    ],
  });
}

beforeEach(() => {
  resetSimulation();
  setSimulation({ latency: "fast" });

  useWorkspaceStore.setState({
    workspaces: [testWorkspace(WORKSPACE_ID)],
    activeWorkspaceId: WORKSPACE_ID,
    treeByWorkspace: { [WORKSPACE_ID]: buildTree() },
    selectedIds: [],
    feedback: null,
    seed: 0,
  });
});

/* ------------------------------------------------------------ env parsing */

describe("reading a .env file", () => {
  /**
   * The bug this parser exists to not have. Connection strings, base64 and
   * JWTs all contain "=", and splitting on every one truncates exactly the
   * credentials that matter most.
   */
  test("a value keeps every equals sign after the first", () => {
    const { entries } = parseEnv("DATABASE_URL=postgres://u:p@h/db?ssl=true&x=1");

    expect(entries).toEqual([
      { key: "DATABASE_URL", value: "postgres://u:p@h/db?ssl=true&x=1" },
    ]);
  });

  test("blank lines and comments are skipped, and counted", () => {
    const result = parseEnv("# payment production\n\nPORT=6868\n\n# trailing note\n");

    expect(result.entries).toEqual([{ key: "PORT", value: "6868" }]);
    expect(result.droppedComments).toBe(2);
    expect(result.invalid).toHaveLength(0);
  });

  test("quotes are stripped, and double quotes honour their escapes", () => {
    const { entries } = parseEnv(
      ['JWT_SECRET="abc123"', "LITERAL='a\\nb'", 'KEY="-----BEGIN-----\\nline two"'].join("\n"),
    );

    expect(entries[0]).toEqual({ key: "JWT_SECRET", value: "abc123" });
    // Single quotes are literal in every dialect worth matching.
    expect(entries[1]).toEqual({ key: "LITERAL", value: "a\\nb" });
    expect(entries[2]?.value).toBe("-----BEGIN-----\nline two");
  });

  test("`export` is tolerated, and surrounding space is trimmed", () => {
    const { entries } = parseEnv("  export API_KEY = xyz  ");
    expect(entries).toEqual([{ key: "API_KEY", value: "xyz" }]);
  });

  /**
   * A repeat is reported and kept. Which of the two the author meant is not
   * something a parser can know, and picking one is how a credential file
   * quietly boots with the wrong password.
   */
  test("a duplicate key is reported rather than silently overwritten", () => {
    const result = parseEnv("API_KEY=abc\nAPI_KEY=xyz");

    expect(result.duplicates).toEqual(["API_KEY"]);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[1]?.value).toBe("xyz");
  });

  test("a line that is not an assignment is reported with its number", () => {
    const result = parseEnv("PORT=1\nthis is prose\nHOST=x");

    expect(result.entries).toHaveLength(2);
    expect(result.invalid).toEqual([{ line: 2, text: "this is prose" }]);
  });

  test("an empty document parses to nothing at all", () => {
    expect(parseEnv("")).toMatchObject({ entries: [], duplicates: [], invalid: [] });
  });

  test("values that need quoting get them back on the way out", () => {
    const text = toEnvText([
      { key: "PLAIN", value: "abc" },
      { key: "MULTILINE", value: "a\nb" },
      { key: "SPACED", value: " padded " },
      { key: "EMPTY", value: "" },
    ]);

    expect(text).toBe('PLAIN=abc\nMULTILINE="a\\nb"\nSPACED=" padded "\nEMPTY=""\n');
  });

  test("printing and parsing are inverses for anything printable", () => {
    const entries = [
      { key: "A", value: "plain" },
      { key: "B", value: "with = signs" },
      { key: "C", value: "line\nbreak" },
      { key: "D", value: 'quote"inside' },
    ];

    expect(parseEnv(toEnvText(entries)).entries).toEqual(entries);
  });

  test("a name is rejected only where the store genuinely cannot hold it", () => {
    expect(isValidSecretKey("DATABASE_URL")).toBe(true);
    expect(isValidSecretKey("app.database.url")).toBe(true);
    expect(isValidSecretKey("")).toBe(false);
    expect(isValidSecretKey("two words")).toBe(false);
    expect(isValidSecretKey("has=equals")).toBe(false);

    // Unconventional is a warning, not a refusal.
    expect(isConventionalSecretKey("DATABASE_URL")).toBe(true);
    expect(isConventionalSecretKey("app.database.url")).toBe(false);
  });
});

/* --------------------------------------------------------------- formatter */

describe("formatting a config document", () => {
  test("the languages with a real parser offer it, and the rest say so", async () => {
    for (const format of ["json", "env", "javascript", "typescript", "tsx", "css", "yaml"] as const) {
      expect(canFormat(format), format).toBe(true);
    }

    for (const format of ["sql", "shell", "dockerfile", "nginx", "xml", "text"] as const) {
      expect(canFormat(format), format).toBe(false);
      await expect(formatSource("anything", format)).resolves.toEqual({
        ok: false,
        message: NO_FORMATTER_HINT,
      });
    }
  });

  test("JSON is reprinted from its own parser", async () => {
    await expect(
      formatSource('{"provider":"stripe","timeout":30000,"retry":3}', "json"),
    ).resolves.toEqual({
      ok: true,
      text: '{\n  "provider": "stripe",\n  "timeout": 30000,\n  "retry": 3\n}\n',
    });
  });

  /** A formatter that half-rewrites an unparseable file is data loss. */
  test("invalid JSON is refused, and no replacement text comes back", async () => {
    const result = await formatSource('{\n  "port": 6868,\n}', "json");

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a refusal");
    expect(result.message).toMatch(/^Unable to format/);
    expect(result).not.toHaveProperty("text");
  });

  test("ENV tidies spacing without reordering, dropping or renaming anything", async () => {
    const source = "# payment\nZEBRA = 1\n\nALPHA=2\nexport GAMMA  =  3   \n";

    await expect(formatSource(source, "env")).resolves.toEqual({
      ok: true,
      text: "# payment\nZEBRA=1\n\nALPHA=2\nexport GAMMA  =  3\n",
    });
  });

  test("formatting ENV twice changes nothing the second time", async () => {
    const once = await formatSource("A = 1\nB=2\n", "env");
    if (!once.ok) throw new Error("expected a format");

    await expect(formatSource(once.text, "env")).resolves.toEqual(once);
  });

  /** The case that started this: a badly indented TSX file, straightened. */
  test("TypeScript and TSX go through Prettier", async () => {
    const messy = 'const a = cva("x", {\n  variants: {\nsize: { xs: "y" },\n  },\n});\n';
    const result = await formatSource(messy, "tsx");

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.text).toBe(
      'const a = cva("x", {\n  variants: {\n    size: { xs: "y" },\n  },\n});\n',
    );
  });

  test("a language keeps its own parser — JSX is not read as TypeScript", async () => {
    const jsx = "const el = <div className={x}>{y}</div>;\n";

    await expect(formatSource(jsx, "jsx")).resolves.toMatchObject({ ok: true });
    await expect(formatSource("a { color : red }", "css")).resolves.toEqual({
      ok: true,
      text: "a {\n  color: red;\n}\n",
    });
  });

  test("code Prettier cannot parse is refused with its own reason, not a stack", async () => {
    const result = await formatSource("const a = (((;", "typescript");

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a refusal");
    expect(result.message).toMatch(/^Unable to format/);
    // One line: the code frame Prettier appends is noise in a toast.
    expect(result.message).not.toContain("\n");
    expect(result).not.toHaveProperty("text");
  });
});

/* ------------------------------------------------------------ highlighting */

describe("syntax colour across the language list", () => {
  test("every language in the picker is a language the tokeniser accepts", () => {
    for (const format of CONFIG_FORMATS) {
      expect(isConfigFormat(format), format).toBe(true);
      // Never throws, and never loses a character.
      const lines = tokenize("const a = 1;\n// note\n", format);
      expect(lines).toHaveLength(3);
      for (const [index, line] of lines.entries()) {
        const rebuilt = line.map((token) => token.text).join("");
        expect(rebuilt, `${format} line ${index}`).toBe(["const a = 1;", "// note", ""][index]);
      }
    }
  });

  test("TypeScript keywords, types and calls are told apart", () => {
    const [line = []] = tokenize("export const read = (raw: string) => decode(raw);", "typescript");
    const kindOf = (text: string) => line.find((token) => token.text === text)?.kind;

    expect(kindOf("export")).toBe("keyword");
    expect(kindOf("const")).toBe("keyword");
    expect(kindOf("string")).toBe("type");
    // Followed by "(", so it is being called. The binding on the left is not.
    expect(kindOf("decode")).toBe("function");
    expect(kindOf("read")).toBe("text");
  });

  /** A line-at-a-time lexer gets this wrong; the state has to be threaded. */
  test("a block comment keeps its colour across lines", () => {
    const lines = tokenize("/* one\n two\n three */ const x = 1;", "typescript");

    expect(lines[0]?.[0]).toMatchObject({ kind: "comment" });
    expect(lines[1]?.[0]).toMatchObject({ kind: "comment", text: " two" });
    expect(lines[2]?.[0]).toMatchObject({ kind: "comment", text: " three */" });
    expect(lines[2]?.some((token) => token.kind === "keyword" && token.text === "const")).toBe(true);
  });

  test("SQL is case-insensitive about its keywords", () => {
    const [upper = []] = tokenize("SELECT id FROM users", "sql");
    const [lower = []] = tokenize("select id from users", "sql");

    expect(upper[0]).toMatchObject({ kind: "keyword", text: "SELECT" });
    expect(lower[0]).toMatchObject({ kind: "keyword", text: "select" });
  });

  test("markup separates the tag from its attributes and their values", () => {
    const [line = []] = tokenize('<a href="/x" class="y">go</a>', "html");
    const kinds = line.map((token) => token.kind);

    expect(kinds).toContain("tag");
    expect(kinds).toContain("attribute");
    expect(kinds).toContain("string");
  });

  test("plain text is never coloured, whatever it happens to contain", () => {
    const [line = []] = tokenize("const SELECT = /* not code */ 42;", "text");

    expect(line).toEqual([{ kind: "text", text: "const SELECT = /* not code */ 42;" }]);
  });

  test("a language is guessed from the name, and falls back rather than failing", () => {
    expect(formatFromName("schema.sql")).toBe("sql");
    expect(formatFromName("main.tsx")).toBe("tsx");
    expect(formatFromName("Dockerfile")).toBe("dockerfile");
    expect(formatFromName(".env.production")).toBe("env");
    expect(formatFromName("Payment Service Config")).toBe("env");
  });
});

/* ------------------------------------------------------- config autosave */

describe("config versions under autosave", () => {
  /**
   * A history of four hundred entries a second apart is not a history anybody
   * can restore from, so the debounce's saves fold into one.
   */
  test("consecutive autosaves fold into a single version", async () => {
    const before = await devtoolsService.listConfigVersions(ID.config);

    await devtoolsService.saveConfig({ nodeId: ID.config, content: "PORT=1\n", isAutosave: true });
    await devtoolsService.saveConfig({ nodeId: ID.config, content: "PORT=12\n", isAutosave: true });
    const third = await devtoolsService.saveConfig({
      nodeId: ID.config,
      content: "PORT=123\n",
      isAutosave: true,
    });

    const after = await devtoolsService.listConfigVersions(ID.config);
    // A read of the history is a snapshot: `before` must not have grown.
    expect(before).toHaveLength(1);
    expect(after).toHaveLength(2);
    expect(after[0]?.content).toBe("PORT=123\n");
    expect(third.version).toBe(2);
  });

  test("pressing Save cuts a version of its own, and the next autosave starts another", async () => {
    await devtoolsService.saveConfig({ nodeId: ID.config, content: "A=1\n", isAutosave: true });
    await devtoolsService.saveConfig({ nodeId: ID.config, content: "A=2\n" });
    await devtoolsService.saveConfig({ nodeId: ID.config, content: "A=3\n", isAutosave: true });

    const versions = await devtoolsService.listConfigVersions(ID.config);
    // seed, folded autosave, manual, new autosave.
    expect(versions).toHaveLength(4);
    expect(versions.map((version) => version.isAutosave ?? false)).toEqual([true, false, true, false]);
  });

  test("a config is created in the language its author chose", async () => {
    const created = await devtoolsService.createConfig({ nodeId: ID.config, format: "typescript" });

    expect(created.format).toBe("typescript");
    expect((await devtoolsService.getConfig(ID.config)).format).toBe("typescript");
  });

  test("a member cannot write a config document", async () => {
    signedInAs("member");

    await expect(
      devtoolsService.saveConfig({ nodeId: ID.config, content: "PORT=1\n" }),
    ).rejects.toThrow(/permission/i);
  });
});

/* ------------------------------------------------------- copy all/selected */

describe("copying secrets in bulk", () => {
  test("copy selected returns those keys and no others", async () => {
    const document = await devtoolsService.getSecrets(ID.secret);
    const [first, , third] = document.entries;

    const result = await devtoolsFake.copySecrets({
      nodeId: ID.secret,
      secretIds: [first!.id, third!.id],
      role: "admin",
    });

    expect(result.keys).toEqual([first!.key, third!.key]);
    expect(parseEnv(result.text).entries.map((entry) => entry.key)).toEqual([
      first!.key,
      third!.key,
    ]);
    expect(result.text).not.toContain(document.entries[1]!.key);
  });

  test("copy all takes every secret in the document", async () => {
    const document = await devtoolsService.getSecrets(ID.secret);

    const result = await devtoolsFake.copySecrets({
      nodeId: ID.secret,
      secretIds: [],
      role: "admin",
    });

    expect(result.keys).toEqual(document.entries.map((entry) => entry.key));
  });

  test("every key copied is audited, and no value reaches the trail", async () => {
    const document = await devtoolsService.getSecrets(ID.secret);
    const chosen = document.entries.slice(0, 2);

    const { text } = await devtoolsFake.copySecrets({
      nodeId: ID.secret,
      secretIds: chosen.map((entry) => entry.id),
      role: "admin",
    });

    const audit = await devtoolsService.listSecretAudit(ID.secret);
    expect(audit).toHaveLength(2);
    expect(audit.every((entry) => entry.action === "copy")).toBe(true);

    const values = parseEnv(text).entries.map((entry) => entry.value);
    const serialised = JSON.stringify(audit);
    for (const value of values) expect(serialised).not.toContain(value);
  });

  /** The client's role can only ever narrow; it can never widen. */
  test("a previewed member is refused even while signed in as an admin", async () => {
    const document = await devtoolsService.getSecrets(ID.secret);

    await expect(
      devtoolsFake.copySecrets({
        nodeId: ID.secret,
        secretIds: [document.entries[0]!.id],
        role: "member",
      }),
    ).rejects.toThrow(/Admin/);

    const audit = await devtoolsService.listSecretAudit(ID.secret);
    expect(audit[0]?.ip).toContain("denied");
  });

  test("an admin claim from a member is refused by the resolved role", async () => {
    const document = await devtoolsService.getSecrets(ID.secret);
    signedInAs("member");

    await expect(
      devtoolsFake.copySecrets({
        nodeId: ID.secret,
        secretIds: [document.entries[0]!.id],
        role: "admin",
      }),
    ).rejects.toThrow(/Admin/);
  });
});

/* ------------------------------------------------------------ secret editor */

describe("editing a secret document", () => {
  test("a value the editor never held survives a rename of its key", async () => {
    const document = await devtoolsService.getSecrets(ID.secret);
    const target = document.entries[0]!;

    const before = await devtoolsFake.revealSecret({
      nodeId: ID.secret,
      secretId: target.id,
      role: "admin",
      action: "reveal",
    });

    // No `value` on the draft: the editor is renaming, not rotating.
    const saved = await devtoolsFake.saveSecrets({
      nodeId: ID.secret,
      role: "admin",
      entries: document.entries.map((entry) =>
        entry.id === target.id ? { id: entry.id, key: "RENAMED_KEY" } : { id: entry.id, key: entry.key },
      ),
    });

    expect(saved.entries[0]?.key).toBe("RENAMED_KEY");

    const after = await devtoolsFake.revealSecret({
      nodeId: ID.secret,
      secretId: saved.entries[0]!.id,
      role: "admin",
      action: "reveal",
    });
    expect(after).toBe(before);
  });

  test("a new secret is added with the value it was given", async () => {
    const document = await devtoolsService.getSecrets(ID.secret);

    const saved = await devtoolsFake.saveSecrets({
      nodeId: ID.secret,
      role: "admin",
      entries: [
        ...document.entries.map((entry) => ({ id: entry.id, key: entry.key })),
        { id: null, key: "NEW_TOKEN", value: "tok_123" },
      ],
    });

    const added = saved.entries.find((entry) => entry.key === "NEW_TOKEN")!;
    expect(added.maskedValue).toMatch(/^•+$/);
    expect(JSON.stringify(saved)).not.toContain("tok_123");

    const value = await devtoolsFake.revealSecret({
      nodeId: ID.secret,
      secretId: added.id,
      role: "admin",
      action: "reveal",
    });
    expect(value).toBe("tok_123");
  });

  test("removing a row removes the stored value with it", async () => {
    const document = await devtoolsService.getSecrets(ID.secret);
    const [dropped, ...kept] = document.entries;

    const saved = await devtoolsFake.saveSecrets({
      nodeId: ID.secret,
      role: "admin",
      entries: kept.map((entry) => ({ id: entry.id, key: entry.key })),
    });

    expect(saved.entries).toHaveLength(kept.length);
    await expect(
      devtoolsFake.revealSecret({
        nodeId: ID.secret,
        secretId: dropped!.id,
        role: "admin",
        action: "reveal",
      }),
    ).rejects.toThrow();
  });

  test("a duplicate key is refused, and nothing is written", async () => {
    const document = await devtoolsService.getSecrets(ID.secret);

    await expect(
      devtoolsFake.saveSecrets({
        nodeId: ID.secret,
        role: "admin",
        entries: [
          { id: document.entries[0]!.id, key: "SAME" },
          { id: document.entries[1]!.id, key: "SAME" },
        ],
      }),
    ).rejects.toThrow(/twice/);

    const after = await devtoolsService.getSecrets(ID.secret);
    expect(after.entries).toHaveLength(document.entries.length);
  });

  test("a key the store cannot hold is refused", async () => {
    await expect(
      devtoolsFake.saveSecrets({
        nodeId: ID.secret,
        role: "admin",
        entries: [{ id: null, key: "two words", value: "x" }],
      }),
    ).rejects.toThrow(/usable name/);
  });

  test("every change is audited as a rotation, with no value in the trail", async () => {
    const document = await devtoolsService.getSecrets(ID.secret);

    await devtoolsFake.saveSecrets({
      nodeId: ID.secret,
      role: "admin",
      entries: [
        { id: document.entries[0]!.id, key: document.entries[0]!.key, value: "rotated-secret" },
        ...document.entries.slice(1).map((entry) => ({ id: entry.id, key: entry.key })),
      ],
    });

    const audit = await devtoolsService.listSecretAudit(ID.secret);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: "rotate", key: document.entries[0]!.key });
    expect(JSON.stringify(audit)).not.toContain("rotated-secret");
  });

  test("a manager cannot rotate a secret", async () => {
    const document = await devtoolsService.getSecrets(ID.secret);
    signedInAs("manager");

    await expect(
      devtoolsFake.saveSecrets({
        nodeId: ID.secret,
        role: "manager",
        entries: document.entries.map((entry) => ({ id: entry.id, key: entry.key })),
      }),
    ).rejects.toThrow(/Admin/);
  });
});
