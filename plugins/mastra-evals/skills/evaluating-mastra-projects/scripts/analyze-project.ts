#!/usr/bin/env bun
/**
 * analyze-project.ts — Profile a Mastra project to drive tailored eval generation.
 *
 * Scans TypeScript/JavaScript sources for Mastra agents, tools, and workflows and
 * emits a project_profile.json describing what to evaluate. Heuristic inference
 * (not a parser) — meant to seed scorer/dataset choices a human/Claude confirms.
 * Read-only: never modifies the target project.
 *
 * Run with a TS runtime (Mastra projects already have one):
 *   bun run scripts/analyze-project.ts <project-root> [-o evals/project_profile.json]
 *   npx tsx  scripts/analyze-project.ts <project-root> [-o evals/project_profile.json]
 *
 * Uses only node: built-ins — no dependencies to install.
 */
import { readFileSync, writeFileSync, mkdirSync, statSync, readdirSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";

const SOURCE_EXTS = [".ts", ".tsx", ".js", ".mjs"];
// node_modules/dist/build/.git would pollute results and slow the scan.
const IGNORE_DIRS = new Set(["node_modules", "dist", "build", ".git", ".next", ".output", "coverage"]);
// A small judge model is almost always enough for grading.
const DEFAULT_JUDGE_MODEL = "openai/gpt-4o-mini";

interface Tool { name: string; id: string; description: string; source: string }
interface Agent { id: string | null; name: string | null; instructions: string | null; model: string | null; tools: string[]; source: string }
interface ScorerSuggestion { type: string; factory?: string; id: string; config?: Record<string, unknown>; rationale: string; source_tool?: string; source_agent?: string; criterion?: string }

function walk(root: string): string[] {
  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length) {
    const cur = stack.pop()!;
    let entries: string[];
    try { entries = readdirSync(cur); } catch { continue; }
    for (const name of entries) {
      if (IGNORE_DIRS.has(name)) continue;
      const full = join(cur, name);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) stack.push(full);
      else if (st.isFile() && SOURCE_EXTS.some((e) => name.endsWith(e))) out.push(full);
    }
  }
  return out;
}

function extractBalanced(text: string, openIdx: number): string {
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return text.slice(openIdx, i + 1); }
  }
  return text.slice(openIdx); // unbalanced — return the tail rather than crash
}

function unquote(v: string): string {
  const s = v.trim();
  if ((s.startsWith("`") && s.endsWith("`")) || (s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  return s;
}

function field(config: string, key: string): string | null {
  // 1) quoted string value (handles commas/newlines inside the string) — works for single- and multi-line configs
  let m = config.match(new RegExp(`\\b${key}\\s*:\\s*(['"\`])([\\s\\S]*?)\\1`));
  if (m) return m[2];
  // 2) unquoted value up to the next comma or newline
  m = config.match(new RegExp(`\\b${key}\\s*:\\s*([^,\\n]+?)\\s*,`));
  if (m) return unquote(m[1].split(/\s\/\//)[0].trim());
  return null;
}

function findTools(root: string): Tool[] {
  const tools: Tool[] = [];
  const pat = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*createTool\s*\(/g;
  for (const src of walk(root)) {
    let text: string;
    try { text = readFileSync(src, "utf8"); } catch { continue; }
  let m: RegExpExecArray | null;
  const re = new RegExp(pat);
  while ((m = re.exec(text))) {
    const brace = text.indexOf("{", m.index + m[0].length);
    if (brace === -1) continue;
    const body = extractBalanced(text, brace);
    tools.push({
      name: m[1],
      id: field(body, "id") ?? m[1],
      description: field(body, "description") ?? "",
      source: relative(root, src).split("\\").join("/"),
    });
  }
  }
  return tools;
}

function findAgents(root: string, toolNames: Set<string>): Agent[] {
  const agents: Agent[] = [];
  const re = /new\s+Agent\s*\(/g;
  for (const src of walk(root)) {
    let text: string;
    try { text = readFileSync(src, "utf8"); } catch { continue; }
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const brace = text.indexOf("{", m.index + m[0].length);
      if (brace === -1) continue;
      const body = extractBalanced(text, brace);
      const referenced = [...toolNames].filter((t) => new RegExp(`\\b${t}\\b`).test(body));
      agents.push({
        id: field(body, "id"),
        name: field(body, "name"),
        instructions: field(body, "instructions"),
        model: field(body, "model"),
        tools: referenced,
        source: relative(root, src).split("\\").join("/"),
      });
    }
  }
  return agents;
}

function inferScorers(tools: Tool[], agents: Agent[]): ScorerSuggestion[] {
  const out: ScorerSuggestion[] = [];
  for (const t of tools) {
    out.push({
      type: "code",
      factory: "createToolCallAccuracyScorerCode",
      id: `${t.id || t.name}-tool-call-accuracy`,
      config: { expectedTool: t.id || t.name, strictMode: false },
      rationale: `Guards that the agent calls ${t.id || t.name} when expected.`,
      source_tool: t.name,
    });
  }
  // Subjective scorers inferred from instruction keywords — keep the list short/obvious.
  const kw: [string, ScorerSuggestion][] = [
    ["tone", { type: "llm-judge", id: "tone-scorer", criterion: "tone of voice", rationale: "", source_agent: "" }],
    ["formal", { type: "llm-judge", id: "tone-scorer", criterion: "formal tone", rationale: "", source_agent: "" }],
    ["concise", { type: "llm-judge", id: "conciseness-scorer", criterion: "conciseness", rationale: "", source_agent: "" }],
    ["safe", { type: "llm-judge", id: "safety-scorer", criterion: "safety", rationale: "", source_agent: "" }],
    ["toxic", { type: "llm-judge", id: "toxicity-scorer", criterion: "non-toxicity", rationale: "", source_agent: "" }],
  ];
  const seen = new Set<string>();
  for (const a of agents) {
    const instr = (a.instructions ?? "").toLowerCase();
    for (const [k, spec] of kw) {
      if (instr.includes(k) && !seen.has(spec.id)) {
        seen.add(spec.id);
        out.push({ ...spec, rationale: `Inferred from agent instruction keyword '${k}'.`, source_agent: a.id ?? a.name ?? "" });
      }
    }
  }
  return out;
}

function parseArgs(argv: string[]): { root: string; out: string | null; judgeModel: string } {
  const opts: { root: string; out: string | null; judgeModel: string } = { root: "", out: null, judgeModel: DEFAULT_JUDGE_MODEL };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-o" || a === "--out") opts.out = argv[++i];
    else if (a === "--judge-model") opts.judgeModel = argv[++i];
    else if (!a.startsWith("-")) opts.root = a;
  }
  return opts;
}

function main(): number {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.root) {
    console.error("Usage: analyze-project.ts <project-root> [-o out.json] [--judge-model m]");
    return 2;
  }
  const root = resolve(opts.root);
  try { statSync(root); } catch { console.error(`ERROR: project root not found: ${root}`); return 2; }

  const tools = findTools(root);
  const toolNames = new Set(tools.map((t) => t.name));
  const agents = findAgents(root, toolNames);
  const scorerSuggestions = inferScorers(tools, agents);
  const evaluable = agents.length > 0 || tools.length > 0;

  const profile = {
    project_root: root.split("\\").join("/"),
    default_judge_model: opts.judgeModel,
    summary: { agents: agents.length, tools: tools.length, evaluable },
    tools,
    agents,
    scorer_suggestions: scorerSuggestions,
  };

  // explicit -o is relative to cwd (standard CLI); default lands inside the project root
  const out = opts.out ? resolve(opts.out) : join(root, "evals", "project_profile.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(profile, null, 2), "utf8");

  console.log(`Profile written: ${out}`);
  console.log(`  agents=${agents.length} tools=${tools.length} evaluable=${evaluable}`);
  console.log(`  scorer_suggestions=${scorerSuggestions.length}`);
  if (!evaluable) {
    console.error("WARNING: no Mastra agents or tools detected. Check the project root, or that the project uses @mastra/core (new Agent / createTool).");
    return 1;
  }
  return 0;
}

process.exit(main());
