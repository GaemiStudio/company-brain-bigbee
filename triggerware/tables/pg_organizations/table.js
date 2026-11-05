// Spike table: proves Triggerware can read our app's Postgres database.
//
// Triggerware runs this file inside its Node "runtime" (a helper process it
// starts itself). It is not part of the NestJS API, and nothing in apps/ imports it.
//
// Why a hand-written table instead of the catalog's "postgres" connector:
// that connector needs Triggerware's Python runtime, which would not install
// on this machine. The Node runtime works, so we query Postgres from here.
//
// The `pg` library has to be installed inside Triggerware's Node runtime
// folder (see triggerware/README.md). The runtime offers no `require`, so the
// library is loaded with `import()` the first time a query runs.

// A "generator" is how a Triggerware table produces rows. "all" takes no
// inputs and returns every row. `connection_url` comes from the table's
// config (set with `triggerware tables configure`), so the password isn't
// written in this file.
generator("all", async ({ connection_url, _state }) => {
  // Load the Postgres client library.
  const { default: pg } = await import("pg")

  // Open one connection for this query, and always close it afterwards,
  // even if the query fails, so Triggerware's repeated polling never leaks
  // connections.
  const client = new pg.Client({ connectionString: connection_url })
  await client.connect()
  try {
    const result = await client.query(
      `SELECT id, name, slug FROM organizations ORDER BY "createdAt"`,
    )

    // Triggerware expects each row as a plain list of values, in the same
    // order as the columns in table.yaml.
    const rows = result.rows.map((row) => [row.id, row.name, row.slug])

    // `exhausted: true` tells Triggerware that this is every row, with no
    // more pages to fetch.
    return { rows, state: _state, exhausted: true }
  } finally {
    await client.end()
  }
})
