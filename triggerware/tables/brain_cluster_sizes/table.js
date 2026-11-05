// Company Brain: how many different employees are in each message cluster.
//
// Reads the brain_cluster_sizes view (created in the API's 0002 migration).
// The 🔴 problem_threshold trigger watches this table. Same pattern as
// pg_organizations: Triggerware's Node runtime, the `pg` library, and a
// connection string from the table's config.
//
// Every organization's clusters are returned, each tagged with its
// organization_id, so the API knows whose alert it is.

generator("all", async ({ connection_url, _state }) => {
  // Load the Postgres client library (the runtime has no `require`).
  const { default: pg } = await import("pg")

  // One short-lived connection per run, always closed, because Triggerware
  // polls this every few seconds.
  const client = new pg.Client({ connectionString: connection_url })
  await client.connect()
  try {
    const result = await client.query(
      `SELECT cluster_id, organization_id, kind, authors FROM brain_cluster_sizes`,
    )

    // One plain list of values per row, in table.yaml's column order.
    const rows = result.rows.map((row) => [
      row.cluster_id,
      row.organization_id,
      row.kind,
      row.authors,
    ])
    return { rows, state: _state, exhausted: true }
  } finally {
    await client.end()
  }
})
