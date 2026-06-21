# Publishing & maintaining this marketplace

This repo (`volfadar/ibras-ai-agent`) is a Claude Code **marketplace** hosting one or more **plugins**. Verified against the official Claude Code plugin docs (June 2026).

## Layout
```
ibras-ai-agent/                       <- the public GitHub repo
├── .claude-plugin/marketplace.json   # marketplace catalog (name: ibras-ai-agent)
├── plugins/
│   └── <plugin-name>/                # one directory per plugin
│       ├── .claude-plugin/plugin.json
│       └── skills/<skill-name>/SKILL.md
├── README.md  LICENSE  CHANGELOG.md  PUBLISHING.md
```

## Users install
```
/plugin marketplace add volfadar/ibras-ai-agent
/plugin install <plugin-name>@ibras-ai-agent
```
`marketplace add` accepts `owner/repo`, a full git URL, a local path, or a raw `marketplace.json` URL. User scope (default) = global; `--scope project` shares it via the consuming repo.

## Validate before pushing
```bash
claude plugin validate .                        # marketplace manifest
claude plugin validate ./plugins/<plugin-name>  # each plugin + skill discovery
```

## Release flow
1. Make changes.
2. `claude plugin validate .` (and per-plugin).
3. Bump `version` in the changed plugin's `plugin.json` (users only receive updates when you bump it). Or omit `version` for commit-SHA versioning.
4. Commit + push.
5. Users update with `/plugin update <plugin-name>@ibras-ai-agent`.

> Don't set `version` in both `plugin.json` and the marketplace entry — `plugin.json` wins silently and the other goes stale.

## Adding a plugin

To ship a NEW plugin alongside `mastra-evals`:

1. **Create the plugin dir:** `plugins/<new-plugin>/.claude-plugin/plugin.json`
   ```json
   {
     "name": "<new-plugin>",
     "displayName": "…",
     "description": "…",
     "version": "0.1.0",
     "author": { "name": "volfadar" },
     "license": "MIT",
     "keywords": ["…"]
   }
   ```
2. **Add the skill(s):** `plugins/<new-plugin>/skills/<skill-name>/SKILL.md` (frontmatter `description` drives auto-invocation).
3. **Register it** in `.claude-plugin/marketplace.json` under `plugins`:
   ```json
   { "name": "<new-plugin>", "source": "./plugins/<new-plugin>", "description": "…", "version": "0.1.0" }
   ```
4. `claude plugin validate .` → commit → push. Users install with `/plugin install <new-plugin>@ibras-ai-agent`.

Skill commands are namespaced per plugin: `/<plugin-name>:<skill-name>` — so multiple plugins can coexist without collisions.

## Submitting to the official community marketplace

For broad discovery, submit a plugin to `anthropics/claude-plugins-community` via <https://platform.claude.com/plugins/submit> after `claude plugin validate` passes. (There's no submission path for the Anthropic-curated `claude-plugins-official` — inclusion is at Anthropic's discretion.)

## Credential hygiene

This repo must stay secret-free. `.gitignore` blocks `.env*`, `*.pem`, `*.key`, `node_modules/`, and `.claude/` (local consumer state). Before every push, confirm:
```bash
git ls-files -z | xargs -0 grep -lE "sk-[A-Za-z0-9_-]{20,}|BEGIN [A-Z ]*PRIVATE KEY|AKIA[0-9A-Z]{16}|gh[opsu]_[A-Za-z0-9]{36}|github_pat_"
```
returns nothing.
