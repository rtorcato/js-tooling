---
title: AI Setup
description: Scaffold AI agent rules — AGENTS.md, CLAUDE.md, Cursor, Copilot, the Claude skill, and an MCP template — from one source of truth, in one command.
---

`js-tooling` can scaffold the instruction files that AI coding tools read, so
every agent (Claude Code, Cursor, GitHub Copilot, or anything that reads
`AGENTS.md`) gets the same guidance for driving this project's tooling.

All of it derives from **one source of truth** — the shipped Claude skill
(`tooling/claude/js-tooling.md`) — so the rules never drift between tools.

## What gets written

| File | For | How it's written |
| --- | --- | --- |
| `AGENTS.md` | The cross-tool standard | Merge-safe delimited block |
| `CLAUDE.md` | Claude Code | Pointer: `@AGENTS.md` (no duplication) |
| `.cursor/rules/js-tooling.mdc` | Cursor | Generated rule file |
| `.github/copilot-instructions.md` | GitHub Copilot | Merge-safe delimited block |
| `.claude/skills/js-tooling.md` | Claude Code skill | Copied verbatim |
| `.mcp.json.example` | Model Context Protocol | Commented template (see below) |
| `README.md` | Your repo's own skills | Merge-safe block, only if this repo ships `skills/<name>/SKILL.md` |

Every file is either a merge-safe **delimited block** (`<!-- js-tooling:start -->`
… `<!-- js-tooling:end -->`) or a `.example`, so re-running never clobbers your
own content and is fully idempotent.

## Install it

During scaffolding, `setup` asks:

```
🤖 Add AI agent rules (AGENTS.md, CLAUDE.md, Cursor, Copilot, Claude skill)?
```

Or install / repair them any time on an existing repo:

```bash
npx @rtorcato/js-tooling fix ai
```

`doctor` reports whether they're present (`AI setup` → `ok` /
`optional-missing`), and the choice is recorded in `.js-tooling.json`, so
`doctor` won't nag if you intentionally opt out.

## Install a skill in one command

The skills ship in this repo under `skills/<name>/SKILL.md`, the standard layout
the [`skills`](https://www.npmjs.com/package/skills) CLI reads. So any agent that
supports it can install them straight from GitHub — no clone, no `js-tooling`
install needed:

```bash
# The tooling skill (audit / fix / scaffold via the CLI)
npx skills add https://github.com/rtorcato/js-tooling --skill js-tooling

# The npm-publish skill
npx skills add https://github.com/rtorcato/js-tooling --skill npm-publish
```

This drops the skill into your agent's skills directory (e.g.
`.claude/skills/`). Use this when you want the skill on its own; use
`fix ai` (above) when you want the full set of agent rule files scaffolded
together.

If **your own** repo ships skills under `skills/<name>/SKILL.md`, `fix ai`
auto-writes this same install section into your `README.md` — one
`npx skills add` command per skill, with the GitHub URL derived from
`package.json`'s `repository`. It's a merge-safe delimited block, so your own
README content is never touched, and repos without a `skills/` dir get nothing.

## CLAUDE.md is a pointer, not a copy

`CLAUDE.md` contains a single `@AGENTS.md` import rather than a second copy of
the guidance. Claude Code reads both files, and the import keeps `AGENTS.md` as
the one place the rules live — no two files to keep in sync.

## MCP: a template, not an active config

`.mcp.json` (the file Claude Code actually loads) is **strict JSON** — it can't
hold comments, and an unconfigured server entry can fail `pnpm install` or add a
redundant server. So the feature ships a commented **`.mcp.json.example`**
instead. It's never loaded, so it's a safe place to document servers.

To activate MCP, copy it and remove the comments:

```bash
cp .mcp.json.example .mcp.json
```

Then add only the servers you actually need — most GitHub work is already
covered by the `gh` CLI, so a GitHub MCP server is usually redundant.
