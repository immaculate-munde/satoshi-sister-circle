-- Latest live FX rates, shared between the web process and the worker.
CREATE TABLE fx_rate_cache (
  pair TEXT PRIMARY KEY,
  rate_decimal TEXT NOT NULL,
  source TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

ALTER TABLE fx_rate_cache ENABLE ROW LEVEL SECURITY;
