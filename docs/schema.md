# Catalog schema

The catalog is eight CSV files in `data/core/`. `src/agentarium/schema.py` defines them and is the only code that writes them. `data/derived/` holds tables computed from them, and `data/reference/` holds outside reference files, copied as published.

## File conventions

- UTF-8 without a byte-order mark, LF line endings.
- A header row with exactly the columns below, in that order.
- Fields are quoted only when needed (a comma, quote or line break), and quotes inside a field are doubled.
- Rows are sorted by primary key.
- Every write is validated first and replaces the files through temporary files, so a failed write leaves the previous files intact.

## agents.csv

Primary key: `agent_id`.

| Column | Required | Content |
|---|---|---|
| `agent_id` | yes | `ag_` followed by 10 lowercase hex characters. Assigned once and never changed or reused. |
| `name` | yes | Display name, copied from the source: the repository name, or the site name or page title. |
| `url` | yes | Homepage, or the repository URL when the repository declares no homepage. |
| `description` | yes | Short description, copied from the source: the repository description or the page's meta description. |
| `organization` | no | The owning GitHub organization, when the owner is an organization. |
| `source_url` | yes | Where the row's facts come from: the repository or the page. |
| `first_seen` | yes | Date the agent was first fetched, `YYYY-MM-DD`. |
| `created_on` | no | Date the GitHub repository was created, `YYYY-MM-DD`. Empty for website records. |
| `stars` | no | The repository's GitHub star count when it was last fetched. Empty for website records. Stars measure attention, not users. |
| `main_task` | no | The one task, among the agent's linked tasks, that the classifier judged best describes what the agent is mainly for. Required when the agent has tasks, empty when it has none. A model judgment, not a quote. |
| `license` | no | GitHub's SPDX identifier for the repository's license, such as `MIT`. `NOASSERTION` is GitHub's value for a license file it cannot identify. Empty when the repository has no license file, and for records not from GitHub. |
| `pricing_model` | no | For AWS Marketplace listings, the listing's pricing model types, lowercased and joined by `;`: any of `byol`, `contract`, `free`, `usage`. Empty for other records. |

### How an agent ID is made

The ID is a hash of the key the agent was first found under:

- GitHub: `github:<numeric repository id>`. GitHub keeps this number through renames and transfers, so the ID does too.
- AWS Marketplace: `aws:<listing id>`, such as `aws:prodview-qizrc6sk6fb7a`.
- Website: `web:<host><path>`, lowercased, without `www.`, the query string, the fragment or a trailing slash. A changed URL produces a new ID.

For AWS Marketplace listings, `name`, `description` and `organization` are the listing's name, short description and seller; `url` and `source_url` are the listing page. The classifier reads the listing's descriptions, highlights and use cases, which are the seller's own words.

## tasks.csv

Primary key: `task_id`. Maintained by hand; the classifier can only use tasks already listed here.

| Column | Required | Content |
|---|---|---|
| `task_id` | yes | Lowercase snake case, e.g. `write_code`. |
| `name` | yes | Readable name. |
| `definition` | yes | What doing the task means, precise enough to tell it apart from the other tasks. |

## agent_tasks.csv

Primary key: `agent_id` and `task_id` together. Each row is one documented claim that an agent performs a task.

| Column | Required | Content |
|---|---|---|
| `agent_id` | yes | Must exist in `agents.csv`. |
| `task_id` | yes | Must exist in `tasks.csv`. |
| `source_url` | yes | The source the quote comes from. |
| `evidence_quote` | yes | A passage copied verbatim from the saved source text. It does not need to name the agent. |

A row records a claim made by the source, not demonstrated performance.

## agent_activities.csv

Primary key: `agent_id` and `dwa_id` together. Each row is one documented claim that an agent performs an O*NET Detailed Work Activity.

| Column | Required | Content |
|---|---|---|
| `agent_id` | yes | Must exist in `agents.csv`. |
| `dwa_id` | yes | A DWA ID from O*NET 29.2, such as `4.A.3.b.1.I01.D03` (Write computer programming code). Must exist in `data/reference/onet/29.2/DWA Reference.txt`. |
| `source_url` | yes | The source the quote comes from. |
| `evidence_quote` | yes | A passage copied verbatim from the saved source text. |

The model judges only which of O*NET's 2,087 activities the text claims. The step from an activity to the tasks and occupations it belongs to is O*NET's own `Tasks to DWAs` file, not a model judgment.

## attributes.csv

Primary key: `attribute` and `value` together. Maintained by hand; the classifier can only use values listed here.

| Column | Required | Content |
|---|---|---|
| `attribute` | yes | `autonomy`, `tool_class` or `audience`. |
| `value` | yes | Lowercase snake case, e.g. `code_execution`. |
| `definition` | yes | What the value means. |

- `autonomy` is the user's role while the agent works, in the five levels of Feng, McDonald and Zhang, *Levels of Autonomy for AI Agents* (2025): `operator`, `collaborator`, `consultant`, `approver`, `observer`.
- `tool_class` is what the agent acts through, in nine classes: `browser`, `code_execution`, `file_system`, `email_calendar`, `business_systems`, `payments`, `voice`, `search_retrieval`, `custom_apis`.
- `audience` is who the agent is for: `practitioner` (people who already do the work), `non_expert` (people without training in it) or `organization` (an organization deploying it for a business function).

## agent_attributes.csv

Primary key: `agent_id`, `attribute` and `value` together. Each row is one documented claim about how an agent works.

| Column | Required | Content |
|---|---|---|
| `agent_id` | yes | Must exist in `agents.csv`. |
| `attribute`, `value` | yes | Must exist together in `attributes.csv`. An agent has at most one `autonomy` and at most one `audience`; it can have any number of `tool_class` values. |
| `source_url` | yes | The source the quote comes from. |
| `evidence_quote` | yes | A passage copied verbatim from the saved source text. |

Nothing is filled in by default: an agent whose text does not state its autonomy level has no `autonomy` row.

## agent_packages.csv

Primary key: `agent_id`, `ecosystem` and `package` together. One row per registry package whose metadata names the agent's GitHub repository, from the [ecosyste.ms](https://packages.ecosyste.ms) lookup by repository address.

| Column | Required | Content |
|---|---|---|
| `agent_id` | yes | Must exist in `agents.csv`. |
| `ecosystem` | yes | The registry, as ecosyste.ms names it: `pypi`, `npm`, `go`, `maven` and so on. |
| `package` | yes | The package name in that registry. |
| `downloads_last_month` | no | Downloads in the last month, as the registry reports them. Empty when the registry reports no monthly count. |
| `source_url` | yes | The lookup request the row comes from. |

Every package that names the repository is kept, because the lookup cannot tell the project's own package from third-party copies that republish it. A package the lookup lists once per registry of an ecosystem, such as each nixpkgs channel, is one row. The download counts show which is which: for browser-use the lookup returns 11 packages, of which the real one has about 8 million monthly downloads and the copies a few hundred at most. The daily run refreshes about 200 agents a day, so counts can be up to about five days old.

## agent_results.csv

Primary key: `agent_id` and `source_url` together. One row per SWE-bench submission in the public [SWE-bench/experiments](https://github.com/SWE-bench/experiments) repository whose listed site equals the agent's `url` or `source_url`.

| Column | Required | Content |
|---|---|---|
| `agent_id` | yes | Must exist in `agents.csv`. |
| `benchmark` | yes | `swe-bench-` followed by the split folder: `lite`, `verified`, `test`, `multimodal` or `multilingual`. |
| `resolved_instances` | yes | How many instances the submission resolved: the length of the `resolved` list in its `results/results.json`. The split's size is not stored. |
| `date` | yes | The submission date, from the `YYYYMMDD` prefix of its folder name. |
| `source_url` | yes | The submission's folder in the experiments repository. |

Addresses are compared lowercased, with `http` as `https` and without `www.`, a trailing slash or `.git`. Submissions are skipped when their metadata has `mini-swe-agent_version`: those are the SWE-bench team's runs of a model inside their own minimal harness, and their site is the model maker's page, not an agent's. Unmatched submissions are counted in the run log, not published.

## How rows change

- A task, activity or profile claim whose quote is not found verbatim in the saved text, or whose id is not in the vocabulary, is never written.
- When an agent is rechecked and both the fetch and the classification succeed, its task, activity and profile rows become exactly those the recheck found. If either step fails, its rows are left as they were.
- An agent the recheck no longer judges to be an agent is removed with every row that names it, and counted under `recheck_not_an_agent`.
- `agent_results.csv` is rebuilt from the experiments repository on every run. A package lookup replaces that agent's packages only when it succeeds.

## agent_declined.csv

Primary key: `date` and `reason` together. One row per day and reason, counting what the maintenance agent saw and did not publish.

| Column | Content |
|---|---|
| `date` | Run date, `YYYY-MM-DD` (UTC). |
| `reason` | One of the codes below. |
| `count` | How many items were declined for that reason that day. |

| Reason | Meaning |
|---|---|
| `no_description` | The record has no description or no text, so no row can be filled. |
| `classification_failed` | The model call failed or its answer was malformed; the record is retried the next day. |
| `not_an_agent` | The model judged the record not to be an agent. |
| `recheck_not_an_agent` | An agent already in the catalog was judged not to be one. Its rows are removed. |
| `quote_not_in_text` | A task, activity or profile claim's quote is not in the saved text. |
| `unknown_task` | A task claim names a task that is not in `tasks.csv`. |
| `duplicate_task` | A second claim for a task the record already supports. |
| `unknown_activity` | An activity claim names a DWA ID that is not in O*NET 29.2. |
| `duplicate_activity` | A second claim for an activity the record already supports. |
| `unknown_attribute` | A profile claim names an attribute value that is not in `attributes.csv`. |
| `duplicate_attribute` | A repeated profile claim, or a second `autonomy` or `audience` value. |
| `validation_failed` | The row breaks a schema rule, such as an invalid URL. |

## Raw evidence

`data/raw/<source>/<date>/<record id>-<timestamp>.json` holds each fetched record exactly as received, with its `source_url`, its `retrieved_at` time and the text the classifier read. Files are created once and never overwritten.

Git tracks only `data/raw/<source>/<date>/manifest.json`, which lists every raw file in that folder with its `url`, `fetched_at` time, size in `bytes` and `sha256`. The hash identifies exactly which version of a page a row was built from. The sources are `github`, `aws`, `web`, `packages` and `swe-bench`.

## data/derived/occupation_coverage.csv

Computed by `src/agentarium/derived.py` after every daily run; never edited by hand. One row per 6-digit SOC occupation that has O*NET task statements (798 occupations).

| Column | Content |
|---|---|
| `soc_code` | The SOC code, e.g. `15-1252`. O*NET occupations under one SOC code, such as `15-1252.00` and `15-1252.01`, are pooled so they join to BLS wages. |
| `title` | O*NET's title for `<soc_code>.00`, or the BLS title when O*NET has no `.00` occupation. |
| `tasks` | The occupation's task statements in O*NET 29.2, of every task type (core, supplemental, and the 1,157 O*NET marks `n/a`). |
| `tasks_claimed` | Those tasks linked, through O*NET's `Tasks to DWAs` file, to at least one activity in `agent_activities.csv`. |
| `agents` | Agents with at least one such activity. |
| `annual_mean_wage` | BLS mean annual wage, May 2025. Empty where BLS publishes none (`*`) or has no row for the code. |
| `employment` | BLS employment, May 2025. Empty where BLS has no row for the code. |

A claimed task means an agent's text says it performs one of the task's work activities. It does not show that the agent does the task well, that anyone uses it for that task, or how much of the task it covers. 301 of O*NET's 18,796 task statements have no activity link and can never be claimed.

## Reference files

`data/reference/` holds outside files the catalog and the derived tables are checked or computed against.

- `onet/29.2/`: `DWA Reference.txt`, `Tasks to DWAs.txt`, `Task Statements.txt` and `Occupation Data.txt`, unmodified from the tab-separated O*NET 29.2 database (`db_29_2_text.zip`, SHA-256 `67c137c93d6663afcfbd97cc86ab1ff57b21bd6d7c65392462189df5b427823f`). This catalog includes information from the O*NET 29.2 Database by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA), used under the CC BY 4.0 license. O*NET® is a trademark of USDOL/ETA.
- `bls/oews_national_m2025.csv`: the `detailed` occupation rows of the BLS Occupational Employment and Wage Statistics national file for May 2025 (`oesm25nat.zip`, SHA-256 `b5855a37f3e03e779f6fbf173d3bbc94aeeff33426aef32fa95ce6d025bab1af`), with the columns `OCC_CODE`, `OCC_TITLE`, `TOT_EMP` and `A_MEAN` copied as published, including BLS's `*` for a wage it does not publish. BLS data is in the public domain.

## Licenses of outside data

- `agent_packages.csv` is derived from ecosyste.ms data, which is licensed CC BY-SA 4.0; that table is shared under the same license.
- `agent_results.csv` copies the resolved count and submission date from SWE-bench/experiments, which states no license, and links to each submission.

## Accuracy

Every quote is checked against the saved text by code, but whether a quote really supports the claim is the model's judgment. The share of agent-to-activity links that a person judges correct, measured on a fixed random sample of 100 links, will be published here once the sample is reviewed.
