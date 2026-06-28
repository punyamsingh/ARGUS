import type { GatherTool } from "./types";
import { wikipediaTool } from "./wikipedia";
import { websiteTool } from "./website";
import { jobBoardTool } from "./jobboards";
import { gdeltTool } from "./gdelt";
import { edgarTool } from "./edgar";
import { financialsTool } from "./financials";
import { githubTool } from "./github";

/**
 * The gather tool belt. Tools register here as they land:
 *   #24 Wikipedia/Wikidata · #25 website fetch · #26 job boards ·
 *   #27 SEC EDGAR · #28 GDELT · #29 financial markets ·
 *   #30 OpenCorporates · #31 GitHub
 *
 * Each tool owns its own routing via `appliesTo`, so adding one is a single
 * import + array entry — no orchestrator changes.
 */
export const gatherTools: GatherTool[] = [
  wikipediaTool,
  websiteTool,
  jobBoardTool,
  gdeltTool,
  edgarTool,
  financialsTool,
  githubTool,
];
