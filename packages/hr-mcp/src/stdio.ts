#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { repoRoot, sourceFromEnv } from "@hsp/hr-data";
import { loadSkill, skillDirs, type Role } from "@hsp/skill-kit";

import { createHrMcpServer } from "./server.js";

/**
 * The MCP server over stdio, for Claude Code (.mcp.json) and other local clients.
 * HSP_ROLE sets whose rules apply (default people_analytics); HR_DATA sets the data source.
 * Audit lines go to stderr as JSON, so stdout stays the protocol.
 */
const role = (process.env.HSP_ROLE ?? "people_analytics") as Role;
const { source } = sourceFromEnv();
const skills = skillDirs(repoRoot()).map(loadSkill);
const server = createHrMcpServer({ source, role, skills, audit: (e) => process.stderr.write(`${JSON.stringify({ audit: e })}\n`) });
await server.connect(new StdioServerTransport());
