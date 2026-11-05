// Company Brain: every (problem cluster, success cluster) pair in the same
// organization, with what the 🟢 solution_signal and 💎 problem_solution_match
// triggers need:
//   problem_authors / success_authors: distinct employees in each cluster
//   problem_browser: the browser most stuck employees use (IT inventory)
//   success_on_problem_browser: successful employees on that same browser
//   similarity: how close the two clusters' meanings are (1 = identical)
//
// Reads the brain_cluster_pairs view (created in the API's 0002 migration).
// Same pattern as pg_organizations.

generator("all", async ({ connection_url, _state }) => {
  // Load the Postgres client library (the runtime has no `require`).
  const { default: pg } = await import("pg")

  // One short-lived connection per run, always closed.
  const client = new pg.Client({ connectionString: connection_url })
  await client.connect()
  try {
    const result = await client.query(
      `SELECT organization_id, problem_cluster_id, success_cluster_id,
              problem_authors, success_authors, problem_browser,
              success_on_problem_browser, similarity
       FROM brain_cluster_pairs`,
    )

    // One plain list of values per row, in table.yaml's column order.
    const rows = result.rows.map((row) => [
      row.organization_id,
      row.problem_cluster_id,
      row.success_cluster_id,
      row.problem_authors,
      row.success_authors,
      row.problem_browser,
      row.success_on_problem_browser,
      row.similarity,
    ])
    return { rows, state: _state, exhausted: true }
  } finally {
    await client.end()
  }
})
