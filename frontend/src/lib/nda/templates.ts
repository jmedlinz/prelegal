import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseStandardTerms } from "./markdown";
import type { Block } from "./types";

/** The repo-level templates directory (sibling of frontend/). */
const TEMPLATES_DIR = path.join(process.cwd(), "..", "templates");

/** Reads and parses the Mutual NDA Standard Terms. Server-only (uses the filesystem). */
export async function loadStandardTerms(): Promise<Block[]> {
  const markdown = await readFile(path.join(TEMPLATES_DIR, "Mutual-NDA.md"), "utf-8");
  return parseStandardTerms(markdown);
}
