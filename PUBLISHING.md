# Publishing & distributing this skill

How to turn this folder into a public GitHub repo that any Claude Code user can install from. (Verified against the official Claude Code plugin docs, June 2026.)

## How it works (the model)

- A **skill** can't be installed on its own; it must be bundled in a **plugin**.
- A **marketplace** is a public repo with `.claude-plugin/marketplace.json` that catalogs one or more plugins.
- Users add your marketplace once, then install plugins from it. Plugin skills are namespaced (`/<plugin>:<skill>`).

This repo is already structured that way:

```
claude-code-marketplace/              <- push the CONTENTS of this dir to a new public repo
├── .claude-plugin/
│   └── marketplace.json              # marketplace catalog (name: mastra-eval-marketplace)
├── plugins/
│   └── mastra-evals/                 # the plugin (name: mastra-evals)
│       ├── .claude-plugin/
│       │   └── plugin.json           # plugin manifest
│       └── skills/
│           └── evaluating-mastra-projects/   # the skill (24 files: SKILL.md + refs/templates/scripts/example)
├── README.md  LICENSE  CHANGELOG.md  PUBLISHING.md
```

## Step 1 — Personalize the manifests

Replace placeholders in three files:

- `.claude-plugin/marketplace.json` → `owner.name`, `owner.email`
- `plugins/mastra-evals/.claude-plugin/plugin.json` → `author`, `homepage`, `repository`
- `LICENSE` → copyright holder
- `README.md` → replace `volfadar`

(Optionally rename the marketplace/plugin — just keep the names kebab-case and avoid reserved names like `claude-plugins-official`, `anthropic-marketplace`, `agent-skills`.)

## Step 2 — Validate locally

```bash
cd claude-code-marketplace
claude plugin validate .                        # validates the marketplace
claude plugin validate ./plugins/mastra-evals   # validates the plugin + skill discovery
```

Fix anything it reports before publishing.

## Step 3 — Push to a public GitHub repo

```bash
# from inside claude-code-marketplace/
git init && git add -A && git commit -m "feat: mastra-evals skill v0.1.0"
gh repo create mastra-evals --public --source=. --remote=origin --push
# add discoverability topics:
gh repo edit --add-topic claude-code-plugin --add-topic claude-code-skill --add-topic mastra --add-topic llm-evaluation
```

(You can use any host — `marketplace add` accepts a full git URL too.)

## Step 4 — Users install it

Share the one-liner:

```
/plugin marketplace add volfadar/mastra-evals
/plugin install mastra-evals@mastra-eval-marketplace
```

- `marketplace add` accepts `owner/repo`, a full `https://…git` URL, a local `./path`, or a remote `https://…/marketplace.json` URL.
- Install defaults to **user scope** (global — all your projects). CLI flags: `--scope project` (shared via the repo) or `--scope local` (gitignored).
- After installing: `/reload-plugins` to activate without restarting.
- Invoke: `/mastra-evals:evaluating-mastra-projects` (or just describe the eval goal and it auto-invokes).

## Step 5 — (Optional) get listed in the official community marketplace

For broad discoverability, submit to Anthropic's community catalog (`anthropics/claude-plugins-community`):

1. Re-run `claude plugin validate .` (required before submission).
2. Submit via the Console form: <https://platform.claude.com/plugins/submit> (individual authors), or the claude.ai directory submission (Team/Enterprise).
3. Approved plugins are pinned to a specific commit SHA; the catalog syncs nightly, so there's a short delay before appearing.

(There is no submission process for the Anthropic-curated `claude-plugins-official` marketplace — inclusion is at Anthropic's discretion.)

## Versioning & updates

Two strategies (pick one):

- **Explicit version** (recommended for releases): set `"version"` in `plugin.json`. Users only get updates when you **bump** it. Tag releases with `claude plugin tag --push` (creates `<plugin>--v<version>`).
- **Commit-SHA version**: omit `version` entirely — every new commit is a new version (good during active dev).

Users update with `/plugin update mastra-evals@mastra-eval-marketplace` (or toggle auto-update per-marketplace in the `/plugin` UI; official marketplaces auto-update, third-party ones don't).

> Don't set `version` in both `plugin.json` and the marketplace entry — `plugin.json` wins silently and the other goes stale.

## Verifying after publish (smoke test)

In a fresh project with no local copy:

```
/plugin marketplace add volfadar/mastra-evals
/plugin install mastra-evals@mastra-eval-marketplace
/reload-plugins
/mastra-evals:evaluating-mastra-projects
```

Then point it at a real Mastra project and confirm it profiles + recommends + generates. (The bundled `examples/weather-agent/` is a ready reference for "done".)
