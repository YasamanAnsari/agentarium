# Catalog schema

The catalog is three CSV files in `data/core/`. `src/agentarium/schema.py` defines them and is the only code that writes them.

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

### How an agent ID is made

The ID is a hash of the key the agent was first found under:

- GitHub: `github:<numeric repository id>`. GitHub keeps this number through renames and transfers, so the ID does too.
- Website: `web:<host><path>`, lowercased, without `www.`, the query string, the fragment or a trailing slash. A changed URL produces a new ID.

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

## How rows change

- A link whose quote is not found verbatim in the saved text, or whose task is not in `tasks.csv`, is never written.
- When an agent is rechecked and both the fetch and the classification succeed, its links become exactly those the recheck found. If either step fails, its rows are left as they were.
- An agent the recheck no longer judges to be an agent is kept and reported, not deleted.

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
| `recheck_not_an_agent` | An agent already in the catalog was judged not to be one. Its rows are kept. |
| `quote_not_in_text` | A task claim's quote is not in the saved text. |
| `unknown_task` | A task claim names a task that is not in `tasks.csv`. |
| `duplicate_task` | A second claim for a task the record already supports. |
| `validation_failed` | The row breaks a schema rule, such as an invalid URL. |

## Raw evidence

`data/raw/<source>/<date>/<record id>-<timestamp>.json` holds each fetched record exactly as received, with its `source_url`, its `retrieved_at` time and the text the classifier read. Files are created once and never overwritten.

Git tracks only `data/raw/<source>/<date>/manifest.json`, which lists every raw file in that folder with its `url`, `fetched_at` time, size in `bytes` and `sha256`. The hash identifies exactly which version of a page a row was built from.
