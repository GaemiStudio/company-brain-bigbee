# Company Brain

**Organic problems, solved organically, checked against the laws in stone.**

Every company runs on two kinds of knowledge. The **official kind** —
policies, inventories, business data — is verified, like laws carved in stone.
The **organic kind** is what employees actually say in chat every day. It's
sporadic and chaotic, but it's where problems show up first, and often where
their solutions are hiding.

Company Brain watches workplace chat, detects recurring problems, finds the
solution hidden in the same conversation, and checks it against company policy
before recommending what to do.

Everything runs locally and offline on one laptop, with no paid API keys.

## The demo: Big Bee's IT team

1. **🔴 Problem detected.** More than 5 employees in `#it-help` report that the
   **Next** button on the Hive expense form does nothing. Triggerware fires,
   and the IT manager (Priya) gets an in-app alert and an email.
2. **🟢 Solution emerges.** A few employees say it works fine for them. Nobody
   mentions a browser, but the brain joins the chat authors to the **verified
   IT laptop inventory** and finds the pattern: every stuck employee is on a
   MacBook with Safari, and everyone who got through is on Windows.
3. **💎 Match.** The problem and solution groups match on meaning (similarity
   about 0.91), and the brain writes a report.
4. **Checked against policy.** The obvious workaround, "just use Chrome,"
   breaks Big Bee's software policy on Macs. The report flags that risk,
   estimates about 143 affected employees ahead of Friday's expense deadline,
   and recommends the policy-approved path: a Sev-2 fix, a temporary
   IT-managed workaround, and a status update.

## How it works

```
#it-help message
   │  classify (problem / success / neither, keyword rules)
   │  embed (all-MiniLM-L6-v2, 384 numbers, local)
   ▼
brain_messages ──► brain_clusters (pgvector, nearest centroid)
   │
   ▼  SQL views join clusters to the laptop inventory
brain_cluster_sizes, brain_cluster_pairs
   │
   ▼  custom Triggerware tables (Node runtime) read the views
Triggerware: 3 triggers, polled every 3 seconds
   │
   ▼  BrainWatcherService receives only new rows
🔴 / 🟢 alerts and 💎 report ──► notification bell + email
```

- **[Digo app-starter](https://github.com/digohq/app-starter)** (NestJS,
  Next.js, Postgres) provides login, organizations, the notification bell and
  email.
- **Embeddings** come from transformers.js with `Xenova/all-MiniLM-L6-v2`. Each
  message becomes a vector of its meaning; similar messages share a cluster.
- **Vectors capture topic, not yes or no**: "it works" and "it doesn't work"
  look nearly identical. So a separate keyword classifier decides problem vs.
  success, and vectors are used only for grouping and matching.
- **pgvector** handles similarity search. The `brain_cluster_pairs` view joins
  chat authors to the laptop inventory to find the browser contrast.
- **Triggerware** runs three SQL triggers:
  - `brain_problem_threshold`: a problem group passes `PROBLEM_THRESHOLD` people.
  - `brain_solution_signal`: a success group reaches `SOLUTION_THRESHOLD`
    people, and none of them use the stuck group's browser.
  - `brain_problem_solution_match`: both of the above, with meaning similarity
    of at least `MATCH_SIMILARITY`.

  Triggerware reports only *new* rows, so each alert fires exactly once.
- **The report** is a template filled from the clusters, the inventory and the
  most relevant policy facts. No AI service is needed.

### Where to look in the code

| What | Where |
| --- | --- |
| Triggers, their SQL, and the watch callback | `apps/api/src/brain/brain-watcher.service.ts` |
| Views joining messages to the inventory | `apps/api/prisma/migrations/0002_company_brain/migration.sql` |
| Custom Triggerware tables | `triggerware/tables/` |
| Classify, embed and cluster | `apps/api/src/brain/messages.service.ts` |
| Report builder | `apps/api/src/brain/report.service.ts` |
| Big Bee seed data | `apps/api/prisma/seed.ts` |
| Brain page and report page | `apps/web/src/app/organizations/[organizationId]/brain/` |

## Running it

### Requirements

- Node 22+ and pnpm 8+
- Docker (Postgres with pgvector, Redis and Mailpit run in containers)
- Triggerware installed locally (see the Mac fixes below)

### 1. Set up the app

```bash
git clone https://github.com/GaemiStudio/company-brain-bigbee.git
cd company-brain-bigbee
pnpm bootstrap   # env files, dependencies, containers, migrations, seed
```

### 2. Set up Triggerware and its tables

Start Triggerware, apply the Mac fixes below, then register the two Brain
tables. See [`triggerware/README.md`](triggerware/README.md) for the full
commands; for each of `brain_cluster_sizes` and `brain_cluster_pairs`:

```bash
cd triggerware/tables/brain_cluster_pairs
triggerware tables create --name brain_cluster_pairs --runtime node \
  --code "$(cat table.js)" --meta "$(cat table.yaml)"
triggerware tables configure --name brain_cluster_pairs \
  --config '{"connection_url":"postgresql://app_starter:app_starter@localhost:5432/app_starter"}'
```

The API installs the three triggers itself when it starts.

### 3. Run the demo

```bash
pnpm dev
```

1. Open http://localhost:3000 and sign in as the Big Bee IT manager:
   `priya@bigbee.example.com` / `Password123!` (local demo account).
2. Open the **Big Bee** organization and click **Company Brain**.
3. Press **Reset**, then **Simulate a workday**.
4. When the simulation pauses, post the live message as **Jane Doe**, for
   example: *"hive isn't working for me either."*
5. Watch the bell: 🔴 arrives within a few seconds, then 🟢 and 💎. Open the
   report from the bell or the Reports card. Emails land in Mailpit at
   http://localhost:8025.

### Settings

Optional, in `apps/api/.env` (defaults shown):

```
TRIGGERWARE_ADDRESS=127.0.0.1:5221
CLUSTER_SIMILARITY=0.55
MATCH_SIMILARITY=0.50
PROBLEM_THRESHOLD=5     # fires when distinct authors > 5
SOLUTION_THRESHOLD=3    # fires when distinct authors >= 3
```

Set `TRIGGERWARE_ENABLED=false` to run the app without Triggerware.

## Triggerware fixes on a Mac

The local Triggerware installer had two problems on macOS:

1. **The Python runtime calls `python`**, but a Mac only has `python3`. That
   blocks the catalog's `postgres` connector. Instead, this project writes its
   own Postgres tables in JavaScript and runs them on the Node runtime
   (`triggerware/tables/`).
2. **The Node runtime was missing its `tw2-jsonrpc` dependency and wasn't
   compiled**, so tables failed with "Broken pipe". The fix:

```bash
triggerware start
triggerware runtimes install --name node

# Add the missing tw2-jsonrpc package where the runtime expects it.
mkdir -p ~/.triggerware/tw2-jsonrpc && cd ~/.triggerware/tw2-jsonrpc
npm pack tw2-jsonrpc@1.0.4 && tar xzf tw2-jsonrpc-1.0.4.tgz && mv package npm
(cd npm && npm install --omit=dev --ignore-scripts)

# Add the Postgres client and compile the runtime. tsc reports missing Node
# type definitions, but still produces dist/index.js.
cd ~/.triggerware/runtimes/node
npm install --no-save pg@8.13.1
npm run build

triggerware stop && triggerware start
```

Two more things to know: table metadata (`table.yaml`) must include a
`config_schema`, and `triggerware tables configure` prints an
"AuthorizationResult" error even though the config is saved.

## Known limitations

- **The problem classifier is keyword-based.** It covers common phrasings
  ("isn't working", "won't let me click", "same here", "no problem"), but
  unusual wording can still be missed. Next step: an AI classifier that
  understands any phrasing.
- The `#it-help` channel is simulated rather than connected to real Slack.

## What's next

- An AI classifier for problem vs. success.
- Real Slack integration.
- One-click manager approval that promotes a solution into the company's
  verified knowledge.
- Beyond IT: HR questions, policy confusion and customer support trends.

## Credits

Built on the [Digo app-starter](https://github.com/digohq/app-starter). Its
original documentation lives in [`docs/`](docs/), and the conventions in
[`AGENTS.md`](AGENTS.md). Built in about two hours, pair-programming with
Claude Code.
