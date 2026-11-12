# Agentarium

A CSV catalog of AI agents, the tasks and O*NET work activities their own documentation says they perform, and how they work. Every factual claim carries a source URL, and every task, activity and profile link carries a quote copied verbatim from that source.

Explore the catalog online: [agentarium.yasamanansari.com](https://agentarium.yasamanansari.com). The site in `site/` reads the tables in `data/core/` and `data/derived/` and rebuilds on every daily update.

## What is in it

Eight tables in `data/core/`, described field by field in [docs/schema.md](docs/schema.md):

| Table | One row per |
|---|---|
| `agents.csv` | agent |
| `tasks.csv` | task in the controlled vocabulary |
| `agent_tasks.csv` | documented claim that an agent performs a task |
| `agent_activities.csv` | documented claim that an agent performs an O*NET 29.2 Detailed Work Activity |
| `attributes.csv` | value in the profile vocabulary: autonomy level, tool class, audience |
| `agent_attributes.csv` | documented claim about how an agent works |
| `agent_packages.csv` | registry package that names an agent's repository, with its monthly downloads |
| `agent_results.csv` | SWE-bench submission matched to an agent by its listed site |

`data/derived/occupation_coverage.csv` joins the activity links, through O*NET's own crosswalk, to the tasks of 798 occupations, with BLS wages and employment. `data/reference/` holds the O*NET 29.2 and BLS May 2025 files it is computed from. `data/agent_declined.csv` counts, for each day, what the inclusion rules refused and why. `data/raw/` holds a manifest of the URL, time and SHA-256 of every page the catalog was built from.

This catalog includes information from the O*NET 29.2 Database by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA), used under the CC BY 4.0 license. O*NET® is a trademark of USDOL/ETA. `agent_packages.csv` is derived from ecosyste.ms data and shared under CC BY-SA 4.0.

## What counts as an agent

A project or product is included when its text shows all three of:

1. **Autonomy:** a language model decides what to do next, with little human oversight.
2. **Environmental interaction:** it acts through tools, with write access or a choice of tools.
3. **Goal complexity:** it pursues a goal over several steps, by planning or by making three or more tool calls on its own.

Frameworks for building agents, tools that agents use (such as MCP servers), chatbots with no tool calls, fixed workflows, tutorials, curated lists, benchmarks and models are not included.

## How rows are added

A maintenance agent runs daily from a separate repository, which holds the model credentials and the drafts it does not publish. It collects candidates with the commands below, asks a language model whether each new or changed record is an agent, which listed tasks and profile values its text claims, and, in a second call, which O*NET work activities it claims. It merges only rows that pass the rules. No person reviews its rows before they are published. Code enforces the rules:

- Every quote must appear verbatim in the saved source text.
- Every task, profile value and activity must already exist in `tasks.csv`, `attributes.csv` or O*NET 29.2.
- An agent has at most one autonomy level and one audience.
- Every row must pass the schema checks in `src/agentarium/schema.py`.

Every row in `agents.csv`, `agent_tasks.csv`, `agent_activities.csv` and `agent_attributes.csv` was written this way. Downloads and SWE-bench results are copied from their sources by code, with no model involved.

## Limits

- **Claims, not performance.** A task link records that a source *says* the agent can do the task. It does not show that the agent does it well, or at all. The quote shows exactly what was claimed.
- **Automated judgment.** Beyond the rules above, the model's decisions are not checked. The share of activity links a person judges correct will be published in [docs/schema.md](docs/schema.md) once a random sample of 100 is reviewed.
- **Refusals.** The model declines to classify some offensive-security projects, such as penetration-testing agents and command-and-control frameworks. They are counted under `model_refused`; one already in the catalog keeps its earlier rows, and a new one is not added.
- **Occupations.** A claimed O*NET task means the text of at least five agents says they perform the same one of the task's work activities, not that they do the task, or that anyone uses them to. 301 of O*NET's 18,796 tasks have no activity link and can never be claimed.
- **Coverage.** Agents are found through GitHub search (two general searches at 500 stars, and 30 searches for agents in fields such as finance, trading, legal, medical, sales, marketing, customer support, recruiting, insurance, real estate and education at 100 stars), curated awesome lists, the repositories that depend on agent frameworks (via ecosyste.ms), Show HN stories on Hacker News, the AWS Marketplace "AI Agents & Tools" category when AWS credentials are configured, and product websites linked from those. Agents that appear in none of them are missing; most agents in the catalog are still developer tools. Because the field searches take a lower star bar, counts of agents in those fields are not comparable with counts of coding agents.
- **Identity.** A GitHub agent keeps its ID through renames and transfers. An agent known only from its website keeps its ID only while its URL stays the same. An agent with both a repository and a product site, or a repository and a marketplace listing, may appear as two rows.
- **Adoption.** Stars measure attention, and downloads count installs of packages that name the repository, including third-party copies. Neither counts users.

## Collecting

Requires [uv](https://docs.astral.sh/uv/). Collection needs a GitHub token: copy `.env.example` to `.env` and fill it in.

```sh
uv sync
uv run --env-file .env agentarium collect github --query "topic:ai-agents" --min-stars 1000
uv run --env-file .env agentarium collect awesome-list --repo e2b-dev/awesome-ai-agents
uv run --env-file .env agentarium collect dependents --ecosystem pypi --package crewai --min-stars 1000
uv run --env-file .env agentarium collect hackernews --query agent --since 2026-10-01 --min-points 100
uv run --env-file .env agentarium collect web --url https://example.com
uv run --extra pulls --env-file .env agentarium collect aws-marketplace --category "AI Agents & Tools"
uv run python -m agentarium.derived
uv run pytest
```

The AWS Marketplace source needs the optional `pulls` extra and AWS credentials for a user with the `AWSMarketplaceRead-only` policy (`AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`). It uses the official Marketplace Discovery API, because the marketplace's search pages are closed to crawlers.

`collect` saves each fetched record under `data/raw/<source>/<date>/` and updates that folder's manifest; it never touches the catalog. Git tracks only the manifests, because the pages themselves belong to their owners.

`uv run pytest` also checks the real CSVs, so run it after editing one by hand.

## Versions

Git history records every change to the catalog, and tags mark published versions.
