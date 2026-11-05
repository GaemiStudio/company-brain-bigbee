# Company Brain

**Turning raw workplace chatter into verified knowledge, and organic problems into organic solutions.**

Built for the Company Brain hackathon with **Triggerware** and the **Digo app-starter**. Everything runs free and locally.

---

## The pitch

**Organic data is a rough stone.** What employees say every day in Slack, threads and tickets is sporadic,
random and chaotic. Most of it looks like plain rock, but real value is buried inside. A diamond is just a rock
until someone cuts and refines it. Then its true value shines.

**Organic problems can't be tracked by hand.** Problems appear organically, everywhere, all the time. Nobody
can track every one. Even dedicated researchers working full time would fall behind.

**So a problem that comes up organically has to be solved organically.** The same stream of chatter that
reveals a problem usually holds its solution too, if something is listening closely enough to connect them.

**A company brain marries two sources of truth:**

| | Bedrock | Rough stone |
|---|---|---|
| What | Proprietary company data: policies, IT asset inventory, business data | Organic data: what employees actually say in chat |
| Nature | Verified. Like laws carved in stone. | Unverified, messy, but fresh and full of real-world signal |
| Role | The standard every idea is measured against | Where problems, and their solutions, show up first |

**Company Brain is the cutter between them.** It refines each chat message into a clean statement and turns it
into a **vector**: a list of numbers that captures what the statement *means*. **Triggerware** watches those
statements and fires when:

1. 🔴 **An organic problem crosses a threshold:** more than 5 employees report the same problem.
2. 🟢 **An organic solution emerges:** employees who *don't* have the problem are doing something different.
3. 💎 **The two match:** their vectors line up, so the brain pairs the solution with the problem.

Then the brain writes a **report for the manager**. It checks the organic solution against the laws in stone,
meaning company policy and verified data, and either recommends a better course of action or warns of risks.

### Meaning as a vector (the 20-second explanation)

Every refined statement becomes a list of 384 numbers. Statements that mean similar things get similar numbers.
*"Next button on the expense form does nothing"* and *"Expense form went through fine for me"* use different
words but are about the same thing, so their vectors are close. That's how the brain knows the happy employees
are relevant to the stuck ones.

---

## The demo: zoomed in on Big Bee's IT team

**Setting:** **Big Bee** is a fictional company with 230 employees. Everyone files expenses through **The Hive**, the
internal employee portal. The `#it-help` channel is where employees ask IT for help. **Priya Patel** is the IT
manager. **Jane Doe** and **John Doe** are employees.

**The hidden truth the brain has to discover:** after last week's portal update, the **Next** button on The
Hive's expense form doesn't work in **Safari**. Big Bee's MacBooks use Safari as the IT-managed browser, so Mac users
are stuck and Windows users (Chrome or Edge) are fine. Nobody in chat knows this. They just know it's broken for
them.

| # | What you show | What the audience sees |
|---|---|---|
| 1 | Logged in as Priya, open the **Company Brain** page. | Left: a Slack-style `#it-help` channel. Right: the brain panel with the problem/solution counters at 0, and the bedrock (policies and the IT device inventory). |
| 2 | Click **▶ Simulate a workday**. | Messages stream in: noise ("printer on 3 is jammed again", "anyone have a spare HDMI?") mixed with *"Next on the Hive expense form does nothing??"* and *"stuck on step 2 of expenses."* The problem counter climbs: 3… 4… 5. |
| 3 | **Type live as Jane:** *"Hive won't let me click Next on my expense report, deadline is Friday 😩"* | The counter hits 6. 🔴 Bell notification and email (in Mailpit): **"Organic problem detected: 6 employees can't get past Next on The Hive expense form."** |
| 4 | The simulation continues. John replies: *"Weird, works fine for me. Submitted mine this morning."* A couple of others say the same. | 🟢 **"Organic solution signal: 3 employees submit expenses without trouble. Per the IT inventory, they're all on Windows laptops with Chrome or Edge, while the stuck employees are all on Safari."** |
| 5 | Seconds later. | 💎 **"Problem and solution matched (similarity 0.8). Report ready."** |
| 6 | Open the report. | Below. |
| 7 | Close. | "Organic problems, solved organically, checked against the laws in stone." |

**The report (the payoff):**

- **Problem:** 6 employees can't click **Next** on The Hive's expense form (step 2). The first report was 47 minutes ago.
- **Evidence:** the brain combined chat with the verified IT inventory:

  | | Stuck employees | Employees who succeeded |
  |---|---|---|
  | MacBook / Safari | 6 | 0 |
  | Windows / Chrome or Edge | 0 | 3 |

- **Organic solution:** employees on Chrome or Edge get through. Workaround: "use a different browser."
- **Checked against bedrock:**
  - ⚠️ *Policy IT-04:* "Only IT-approved software may be installed on company laptops. Chrome is approved for
    Windows only." Mac users downloading Chrome themselves would break security policy.
  - ⚠️ *Chat signal:* 1 employee already said *"I'll just download Chrome"*. That's a possible unapproved install to follow up on.
  - ⚠️ *Data:* 62% of Big Bee laptops are MacBooks, so about **143 employees** are likely affected, and expense
    reports are due **Friday**.
  - ✅ *Policy IT-11:* "An internal tool outage that blocks a business process is Sev-2: fix within 2 business days
    and post a status update in #it-announcements."
  - ✅ *Policy IT-12:* "The IT manager may approve a temporary workaround for up to 14 days."
- **Recommendation:**
  1. Open a **Sev-2** ticket with The Hive team: "Expense form Next button broken in Safari since last update." Due in 2 business days.
  2. **Approve a temporary workaround (IT-12):** push an IT-managed Chrome install to MacBooks for 14 days,
     instead of letting employees install it themselves.
  3. Post a status update in #it-announcements now, before Friday's deadline causes a flood.
  4. Follow up with the employee who mentioned installing Chrome.

---

## What's real vs. faked

| Faked (fine for the demo) | Real (actually works) |
|---|---|
| Slack: a Slack-style channel page inside the app, not real Slack | Turning each message into a vector (local AI model) |
| The Hive portal and its broken button. Not built; employees just talk about it. | Classifying messages as problem or success (keyword rules) |
| Employees and their messages (a seed script, streamed by the Simulate button) | Grouping similar messages into clusters by vector similarity |
| Big Bee's policies, IT inventory and numbers (seeded) | Joining chat authors to the IT inventory to find the browser contrast |
| "Real time" (the simulation speed) | Three Triggerware triggers firing on live data |
| | Matching problem and solution clusters by vector, policy lookup by vector, building the report |
| | Digo notifications (bell and email in Mailpit) |

## Free-tier stack

| Need | Choice | Cost |
|---|---|---|
| App framework, login, notifications | Digo app-starter, run locally with Docker | Free |
| Database and vector search | Postgres with `pgvector` (`pgvector/pgvector:pg16` Docker image) | Free |
| Triggers | Triggerware, local install | Free (local) |
| Embeddings (vectors) | transformers.js running `Xenova/all-MiniLM-L6-v2` inside the API. No key, works offline. | Free |
| Problem/success classification | Keyword rules (offline). *Optional:* Google Gemini API free tier. | Free |
| Report writing | A template filled with computed numbers and matched policies. *Optional:* Gemini free tier for nicer wording. | Free |
| Email | Mailpit (included in the starter, catches emails locally) | Free |
| Hosting | None. Demo runs on the laptop. | Free |

**Why keyword rules, not vectors, decide problem vs. success:** vectors are good at telling *what topic* a
sentence is about, but bad at telling "works" from "doesn't work," since the two sentences are nearly identical.
Simple rules on words like *can't, won't, stuck, nothing happens* versus *works, worked, fine, went through* are
reliable on our scripted messages and free.

---

## How it works

```
 Simulate button / typing as Jane ──▶ POST /messages (author, text)
                          │
                          ▼  REFINE (NestJS, apps/api/src/brain)
                     1. classify: problem | success | neither   (keyword rules)
                     2. embed the text → 384-number vector      (local model)
                     3. assign to the nearest cluster of the same kind, or start a new one
                     4. look up the author's laptop + browser in the IT inventory (bedrock)
                          │
                          ▼
                     Postgres + pgvector: facts, devices, messages, clusters, views
                          │   ▲
          Triggerware reads   │   │ creates notifications + Report
          the views on a      ▼   │
          schedule ──▶ 🔴 problem_threshold  🟢 solution_signal  💎 problem_solution_match
                          │
                          ▼
                     BrainWatcherService (NestJS) gets each new row via triggers.watch()
                     → Digo notification to Priya (in-app + email)
                     → on 💎: ReportService builds the report
```

**Division of labor:** *Digo refines and reports, Triggerware watches.*

### Data model (Prisma, everything has `organizationId`)

```prisma
model Fact {                 // BEDROCK: verified policies and business data
  id             String   @id @default(uuid())
  organizationId String
  code           String   // "IT-04"
  kind           String   // "policy" | "data"
  title          String
  body           String
  embedding      Unsupported("vector(384)")?
}

model Device {               // BEDROCK: verified IT asset inventory
  id             String   @id @default(uuid())
  organizationId String
  employeeName   String   // matches Message.authorName
  laptop         String   // "MacBook Pro 14" | "Dell Latitude 7440"
  os             String   // "macOS" | "Windows"
  browser        String   // IT-managed browser: "Safari" | "Chrome" | "Edge"
}

model Message {              // ROUGH STONE: one #it-help chat message
  id             String   @id @default(uuid())
  organizationId String
  authorName     String
  channel        String   @default("it-help")
  text           String
  kind           String   // "problem" | "success" | "neither"
  clusterId      String?
  embedding      Unsupported("vector(384)")?
  createdAt      DateTime @default(now())
}

model Cluster {              // CUT STONE: messages that mean the same thing
  id             String   @id @default(uuid())
  organizationId String
  kind           String   // "problem" | "success"
  label          String   // first message's text, as a readable name
  centroid       Unsupported("vector(384)")?   // average of member vectors, updated on each insert
  createdAt      DateTime @default(now())
}

model Report {               // the brain's write-up for the manager
  id               String   @id @default(uuid())
  organizationId   String
  problemClusterId String
  successClusterId String
  similarity       Float
  content          Json     // problem, evidence table, solution, policyChecks[], recommendation[]
  createdAt        DateTime @default(now())
}
```

**Clustering rule (simple on purpose):** for each problem or success message, find the closest cluster of the
same kind. If cosine similarity is ≥ `CLUSTER_SIMILARITY` (start at 0.55; chat is short and varied), join it and
update its centroid. Otherwise start a new cluster. Noise ("printer jammed") forms small clusters that never
cross a threshold.

### Triggerware triggers

Triggerware re-runs each SQL query on a schedule and reports rows that are **new since the last run**. Each
query selects **only IDs**, not counts, so a row appears once and the alert fires once, not again at 7, 8, 9…

| Trigger | Fires when | SQL (sketch, against views made in a raw migration) |
|---|---|---|
| 🔴 `problem_threshold` | A problem cluster has messages from **more than 5** different employees | `SELECT cluster_id FROM cluster_sizes WHERE kind='problem' AND authors > 5` |
| 🟢 `solution_signal` | A success cluster has **≥ 3** employees, **and** none of them use (per the `Device` inventory) the browser most stuck employees use | `SELECT cluster_id FROM success_signals` (the view joins Message → Device and compares browsers) |
| 💎 `problem_solution_match` | A triggered problem cluster and a triggered success cluster have centroid similarity ≥ `MATCH_SIMILARITY` (start at 0.5) | `SELECT p.cluster_id, s.cluster_id FROM … WHERE 1 - (p.centroid <=> s.centroid) >= 0.5` |

### The report (template, no AI required)

When 💎 fires, `ReportService` does the following:
1. **Evidence:** joins the members of both clusters to `Device` and counts by OS and browser.
2. **Solution statement:** "Employees on {success browsers} get through; stuck employees are all on {problem browser}."
3. **Chat risk scan:** searches the problem cluster's messages for "download/install" plus a browser name, and flags them.
4. **Policy check:** embeds the solution statement and pulls the nearest Facts by vector. Simple rules tag each one:
   - It mentions approved or installed software → ⚠️ the workaround conflicts with policy.
   - It's a fleet-share Fact → ⚠️ calculates the number of affected employees.
   - It mentions severity, SLA or temporary workarounds → ✅ gives the recommended path.
5. **Recommendation:** a fixed template filled with the values above. It saves the Report and notifies Priya with a link.

*Optional:* if `GEMINI_API_KEY` is set, Gemini rewrites the recommendation as natural prose. Without it, the template is used.

---

## Seed data (Big Bee)

**Login:** Priya Patel (Owner, IT manager). That's the only login needed.

**Facts (bedrock):**
- *IT-04 policy:* Only IT-approved software may be installed on company laptops. Chrome is approved for Windows only.
- *IT-07 policy:* Safari is the IT-managed browser on company MacBooks. Edge and Chrome are managed on Windows.
- *IT-11 policy:* An internal tool outage that blocks a business process is Sev-2: fix within 2 business days and post a status update in #it-announcements.
- *IT-12 policy:* The IT manager may approve a temporary workaround for up to 14 days.
- *FIN-02 policy:* Monthly expense reports are due Friday at 5pm.
- *DATA-01 data:* Big Bee has 230 employees. 62% of company laptops are MacBooks.
- *IT-02 policy:* Passwords must be rotated every 90 days. (A distractor, so policy matching has to be selective.)

**Devices:** about 15 employees. Every problem author is on a MacBook with Safari. John Doe and the other success
authors are on Windows with Chrome or Edge. Some noise authors are on each.

**Message script (about 30 messages, streamed by Simulate, with a pause before Jane's live message):**
- 5 × problem messages about the Hive expense Next button, worded differently each time, from 5 different Mac users.
  One of them says "ugh I'll just download Chrome."
- ⏸ *Pause.* The presenter types Jane's message live, which makes 6 and fires 🔴.
- 3 × success messages from Windows users (John first: "Weird, works fine for me. Submitted mine this morning.").
- About 20 noise messages: printer, Wi-Fi, HDMI adapters, a password reset, lunch plans.
- Interleaved so 🟢 fires about 10 seconds after 🔴.

---

## Build plan: 2 hours

| Time | Step | Done when |
|---|---|---|
| 0:00–0:15 | **Spike: Triggerware ↔ Postgres.** Install TW and check `connectors.catalog()` for Postgres. If there's no connector, write a TW table whose code queries Postgres. | A TW query returns rows from our DB |
| 0:15–0:35 | Swap in the pgvector image, add the 5 Prisma models and the views, and seed Facts and Devices | `pnpm bootstrap` runs and the Facts have embeddings |
| 0:35–0:55 | `POST /messages`: classify, embed, cluster. Add the Simulate endpoint that streams the script and pauses for the live message. | Simulating fills clusters correctly |
| 0:55–1:20 | `BrainWatcherService`: create the 3 triggers, watch them, send notifications | 🔴 🟢 💎 appear in the bell |
| 1:20–1:45 | `ReportService`, the **Company Brain** page (Slack-style channel with an input box, counters, bedrock list, Simulate and Reset buttons) and the **Report** page | The full demo runs end to end |
| 1:45–2:00 | Tune thresholds, then rehearse twice. **Reset** clears messages, clusters and reports. | Two clean runs |

**Not building:** real Slack, The Hive portal, approvals, multiple organizations, member roles, deployment.
**At home (optional):** Gemini-written report prose and classification, a cluster visual (vector map), real Slack via webhook.

---

## Instructions for Claude Code

- Read `AGENTS.md` and `docs/first-feature.md` first. Copy the patterns from `apps/api/src/projects`.
  Keep every query scoped by `organizationId`.
- **Build only what this demo needs.** No extra features, settings pages or generality.
- Put the backend in `apps/api/src/brain/`: `brain.module.ts`, `messages.service.ts` (classify, embed and cluster),
  `brain-watcher.service.ts` (Triggerware), `report.service.ts`, `simulate.service.ts`.
- Put the frontend at `apps/web/src/app/organizations/[organizationId]/brain/` (a single Company Brain page) and
  `.../brain/reports/[reportId]/`. Reuse `components/ui`. Polling every 1 s is fine.
- The live input box lets the presenter choose which employee to post as (default: Jane Doe).
- Triggerware: Node SDK (`npm install triggerware`). Plugin for help: `claude plugin install triggerware@triggerware`.
- Embeddings: `@huggingface/transformers` with `Xenova/all-MiniLM-L6-v2`. Load it once at startup, using mean
  pooling and normalized vectors.
- Keep thresholds, schedule and simulation speed in env vars. Log similarity scores while testing so they can be tuned.
- **Everything must work offline with no paid keys.** Gemini is optional, and the code must work without it.
- **Comment the code generously in plain English** (what each block does and why). The owner is not a TypeScript expert.
- Don't run `prisma migrate reset` without asking. Run `pnpm verify` before calling a step done.

### Environment variables

```
TRIGGERWARE_ADDRESS=localhost:<port>   # from the local TW install
TRIGGER_SCHEDULE=                      # every ~3 s; check the TW docs for the format
EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2
CLUSTER_SIMILARITY=0.55
MATCH_SIMILARITY=0.50
PROBLEM_THRESHOLD=5                    # fires when distinct authors > this
SOLUTION_THRESHOLD=3                   # fires when distinct authors >= this
SIMULATE_INTERVAL_MS=1500
GEMINI_API_KEY=                        # optional, free tier; empty = rules + template
```

### Open questions

- Does the Triggerware catalog include a Postgres connector? (Answered by the 0:00 spike.)
- What's the exact format of the Triggerware `schedule` string, and how short can it be?
- Are the similarity thresholds right? Tune them against the seed script.
