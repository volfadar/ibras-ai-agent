#!/usr/bin/env bun
/**
 * validate-artifacts.ts — Validate a generated Mastra eval artifact set.
 *
 * Structural checks on scorers, datasets, experiments, online-scoring, and tests
 * so obvious mistakes (bad imports, missing fields, unbalanced braces, bad
 * sampling rates) are caught before running anything. Prints specific, fixable
 * errors and exits non-zero if any are found. Does not execute TS or call models.
 *
 *   bun run scripts/validate-artifacts.ts <evals-dir>
 *   npx tsx  scripts/validate-artifacts.ts <evals-dir>
 *
 * Uses only node: built-ins.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const MASTRA_EVAL_PKGS = ["@mastra/core/evals", "@mastra/evals/scorers/prebuilt"];
const SCORER_FACTORIES = [
  "createScorer", "createToolCallAccuracyScorerCode", "createToolCallAccuracyScorerLLM",
  "createToxicityScorer", "createRubricScorer",
];

class Report {
  errors: string[] = [];
  warnings: string[] = [];
  ok: string[] = [];
  fail(file: string, msg: string) { this.errors.push(`${file}: ${msg}`); }
  warn(file: string, msg: string) { this.warnings.push(`${file}: ${msg}`); }
  good(msg: string) { this.ok.push(msg); }
}

function bracesBalanced(text: string): boolean {
  let depth = 0;
  let inStr: string | null = null;
  let lineC = false;
  let blockC = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const nxt = text[i + 1] ?? "";
    if (lineC) { if (c === "\n") lineC = false; continue; }
    if (blockC) { if (c === "*" && nxt === "/") blockC = false; continue; }
    if (inStr) { if (c === "\\") { i++; continue; } if (c === inStr) inStr = null; continue; }
    if (c === "'" || c === '"' || c === "`") { inStr = c; continue; }
    if (c === "/" && nxt === "/") { lineC = true; continue; }
    if (c === "/" && nxt === "*") { blockC = true; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth < 0) return false; }
  }
  return depth === 0;
}

function validateScorer(rel: string, text: string, rep: Report) {
  if (!bracesBalanced(text)) rep.fail(rel, "unbalanced braces — likely a truncated template fill");
  if (!MASTRA_EVAL_PKGS.some((p) => text.includes(p))) rep.fail(rel, `no Mastra eval import (expected one of ${MASTRA_EVAL_PKGS.join(", ")})`);
  if (!SCORER_FACTORIES.some((f) => text.includes(f + "("))) rep.fail(rel, `no scorer factory call (expected one of ${SCORER_FACTORIES.join(", ")})`);
  if ((text.includes("judge") || text.includes("LLMScorer")) && !text.includes("model")) rep.warn(rel, "LLM-judge scorer has no `model` configured");
}

function validateDataset(path: string, rel: string, rep: Report) {
  let data: any;
  try { data = JSON.parse(readFileSync(path, "utf8")); }
  catch (e) { rep.fail(rel, `invalid JSON: ${(e as Error).message}`); return; }
  const rows = Array.isArray(data?.records) ? data.records : data;
  if (!Array.isArray(rows) || rows.length === 0) { rep.fail(rel, "dataset must be a non-empty array (or {records: [...]})"); return; }
  rows.forEach((row: any, i: number) => {
    const hasInput = ["input", "messages", "inputMessages", "prompt"].some((k) => k in row);
    const hasExpect = ["groundTruth", "expectedTool", "expected", "rubric", "expectedOutput", "shouldPass"].some((k) => k in row);
    if (!hasInput) rep.fail(rel, `row ${i} missing an input field (input|messages|prompt)`);
    if (!hasExpect) rep.warn(rel, `row ${i} has no expectation field (groundTruth|expectedTool|expected|rubric|shouldPass)`);
  });
  rep.good(`${rows.length} dataset rows checked in ${rel.split("/").pop()}`);
}

function validateOnline(rel: string, text: string, rep: Report) {
  // Current Mastra API: sampling: { type: 'ratio', rate: N }
  const currentRates: number[] = [];
  for (const block of [...text.matchAll(/sampling\s*:\s*\{([\s\S]*?)\}/g)].map((m) => m[1])) {
    if (/type\s*:\s*['"]ratio['"]/.test(block)) {
      const rm = block.match(/\brate\s*:\s*([0-9]*\.?[0-9]+)/);
      if (rm) currentRates.push(parseFloat(rm[1]));
    }
  }
  // Legacy forms (older video API / drafts) — still range-checked, but flagged.
  const legacyRates = [...text.matchAll(/\b(?:sampleRate|samplingRate)\s*:\s*([0-9]*\.?[0-9]+)/g)].map((m) => parseFloat(m[1]));
  const rates = [...currentRates, ...legacyRates];
  if (rates.length === 0) rep.warn(rel, "no sampling rates found — online scoring without sampling can get expensive (current API: sampling: { type: 'ratio', rate })");
  if (currentRates.length === 0 && legacyRates.length > 0) rep.warn(rel, "uses legacy sampleRate/samplingRate — current Mastra API is sampling: { type: 'ratio', rate }");
  for (const r of rates) if (!(r > 0 && r <= 1)) rep.fail(rel, `sampling rate out of range (0,1]: ${r}`);
  if (!text.includes("new Agent") && !text.includes("Agent(")) rep.warn(rel, "no Agent definition found — is this wiring scorers to an agent?");
}

function validateExperiment(rel: string, text: string, rep: Report) {
  for (const tok of ["dataset", "scorer"]) if (!text.toLowerCase().includes(tok)) rep.warn(rel, `no reference to '${tok}' — an experiment should wire dataset + scorers`);
}

function validateTest(rel: string, text: string, rep: Report) {
  if (!text.includes("vitest") && !text.includes("@vitest") && !text.includes('"test"')) rep.warn(rel, "no vitest import detected — eval tests usually import from 'vitest'");
}

function walkFiles(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop()!;
    let entries: string[];
    try { entries = readdirSync(cur); } catch { continue; }
    for (const name of entries) {
      const full = join(cur, name);
      let st; try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) stack.push(full); else out.push(full);
    }
  }
  return out;
}

function main(): number {
  const dir = process.argv[2];
  if (!dir) { console.error("Usage: validate-artifacts.ts <evals-dir>"); return 2; }
  const root = resolve(dir);
  try { statSync(root); } catch { console.error(`ERROR: not a directory: ${root}`); return 2; }

  const rep = new Report();
  let checked = 0;
  for (const p of walkFiles(root).sort()) {
    const rel = relative(root, p).split("\\").join("/");
    const name = p.toLowerCase();
    let text: string;
    try { text = readFileSync(p, "utf8"); } catch (e) { rep.fail(rel, `unreadable: ${(e as Error).message}`); continue; }
    checked++;
    if (name.endsWith(".ts") && rel.toLowerCase().includes("scorer")) validateScorer(rel, text, rep);
    else if (name.endsWith(".dataset.json") || (name.endsWith(".json") && name.includes("dataset"))) validateDataset(p, rel, rep);
    else if (name.endsWith(".ts") && rel.toLowerCase().includes("online")) validateOnline(rel, text, rep);
    else if (name.endsWith(".ts") && (rel.toLowerCase().includes("experiment") || name.includes(".eval."))) validateExperiment(rel, text, rep);
    else if (name.endsWith(".test.ts") || name.endsWith(".test.js") || name.includes(".eval.test")) validateTest(rel, text, rep);
  }

  for (const g of rep.ok) console.log(`  ok   ${g}`);
  for (const w of rep.warnings) console.log(`  WARN ${w}`);
  for (const e of rep.errors) console.log(`  FAIL ${e}`);
  console.log(`\nChecked ${checked} file(s): ${rep.errors.length} error(s), ${rep.warnings.length} warning(s)`);
  return rep.errors.length ? 1 : 0;
}

process.exit(main());
