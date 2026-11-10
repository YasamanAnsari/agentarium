# Agentarium

A CSV catalog of AI agents and the tasks their own documentation says they perform. Every factual claim carries a source URL, and every task link carries a quote copied verbatim from that source.

Explore the catalog online: [agentarium.yasamanansari.com](https://agentarium.yasamanansari.com). The site in `site/` reads the three tables in `data/core/` and rebuilds on every daily update.

## What is in it

Three tables in `data/core/`, described field by field in [docs/schema.md](docs/schema.md):

| Table | One row per |
|---|---|
| `agents.csv` | agent |
| `tasks.csv` | task in the controlled vocabulary |
| `agent_tasks.csv` | documented claim that an agent performs a task |

`data/agent_declined.csv` counts, for each day, what the inclusion rules refused and why. `data/raw/` holds a manifest of the URL, time and SHA-256 of every page the catalog was built from.

## What counts as an agent

A project or product is included when its text shows all three of:

1. **Autonomy:** a language model decides what to do next, with little human oversight.
2. **Environmental interaction:** it acts through tools, with write access or a choice of tools.
3. **Goal complexity:** it pursues a goal over several steps, by planning or by making three or more tool calls on its own.

Frameworks for building agents, tools that agents use (such as MCP servers), chatbots with no tool calls, fixed workflows, tutorials, curated lists, benchmarks and models are not included.

## How rows are added

A maintenance agent runs daily from a separate repository, which holds the model credentials and the drafts it does not publish. It collects candidates with the commands below, asks a language model whether each new or changed record is an agent and which listed tasks its text claims, and merges only rows that pass the rules. No person reviews its rows before they are published. Code enforces the rules:

- Every quote must appear verbatim in the saved source text.
- Every task must already exist in `tasks.csv`, which is maintained by hand.
- Every row must pass the schema checks in `src/agentarium/schema.py`.

Every row in `agents.csv` and `agent_tasks.csv` was written this way.

## Limits

- **Claims, not performance.** A task link records that a source *says* the agent can do the task. It does not show that the agent does it well, or at all. The quote shows exactly what was claimed.
- **Automated judgment.** Beyond the rules above, the model's decisions are not checked.
- **Coverage.** Agents are found through GitHub search, curated awesome lists, the repositories that depend on agent frameworks (via ecosyste.ms), Show HN stories on Hacker News, and product websites linked from those. Agents that appear in none of them are missing.
- **Identity.** A GitHub agent keeps its ID through renames and transfers. An agent known only from its website keeps its ID only while its URL stays the same. An agent with both a repository and a product site may appear as two rows.

## Collecting

Requires [uv](https://docs.astral.sh/uv/). Collection needs a GitHub token: copy `.env.example` to `.env` and fill it in.

```sh
uv sync
uv run --env-file .env agentarium collect github --query "topic:ai-agents" --min-stars 1000
uv run --env-file .env agentarium collect awesome-list --repo e2b-dev/awesome-ai-agents
uv run --env-file .env agentarium collect dependents --ecosystem pypi --package crewai --min-stars 1000
uv run --env-file .env agentarium collect hackernews --query agent --since 2026-10-01 --min-points 100
uv run --env-file .env agentarium collect web --url https://example.com
uv run pytest
```

`collect` saves each fetched record under `data/raw/<source>/<date>/` and updates that folder's manifest; it never touches the catalog. Git tracks only the manifests, because the pages themselves belong to their owners.

`uv run pytest` also checks the real CSVs, so run it after editing one by hand.

## Versions

Git history records every change to the catalog, and tags mark published versions.
