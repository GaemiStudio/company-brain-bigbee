# Triggerware tables

Triggerware tables that read our app's Postgres database. Triggerware runs
these itself, in its own Node "runtime" process. They aren't part of the API
or web app.

## Why not the catalog's `postgres` connector?

It needs Triggerware's Python runtime, which calls `python`. A Mac with only
`python3` can't install it. So we write the tables ourselves in JavaScript
and run them on the Node runtime.

## One-time setup (local Triggerware)

The local Triggerware install was missing pieces of its Node runtime. To set
it up on a new laptop:

```bash
# 1. Start the local Triggerware server and install the Node runtime.
triggerware start
triggerware runtimes install --name node

# 2. The runtime depends on `tw2-jsonrpc`, which the installer didn't include.
#    Put it where the runtime expects it, along with its one dependency.
mkdir -p ~/.triggerware/tw2-jsonrpc && cd ~/.triggerware/tw2-jsonrpc
npm pack tw2-jsonrpc@1.0.4 && tar xzf tw2-jsonrpc-1.0.4.tgz && mv package npm
(cd npm && npm install --omit=dev --ignore-scripts)

# 3. Add the Postgres client library and compile the runtime. tsc reports
#    missing Node type definitions, but it still produces dist/index.js.
cd ~/.triggerware/runtimes/node
npm install --no-save pg@8.13.1
npm run build

# 4. Restart so Triggerware picks up the compiled runtime.
triggerware stop && triggerware start
```

## Adding or updating a table

Each folder under `tables/` holds `table.js` (the code that fetches rows) and
`table.yaml` (its columns). From inside a table's folder:

```bash
triggerware tables create --name pg_organizations --runtime node \
  --code "$(cat table.js)" --meta "$(cat table.yaml)"

# Give it the local dev database's address (credentials from docker-compose.yml).
# The CLI prints an "AuthorizationResult" error here, but the config still saves.
triggerware tables configure --name pg_organizations \
  --config '{"connection_url":"postgresql://app_starter:app_starter@localhost:5432/app_starter"}'

# Check it works:
triggerware execute --sql 'SELECT * FROM pg_organizations' --rows 10
```
