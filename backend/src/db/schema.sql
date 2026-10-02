-- Listings: the ORIGINAL content is never modified after creation.
CREATE TABLE IF NOT EXISTS listings (
  id             SERIAL PRIMARY KEY,
  title          TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 5 AND 100),
  description    TEXT NOT NULL CHECK (char_length(btrim(description)) BETWEEN 20 AND 5000),
  category       TEXT NOT NULL,
  price          NUMERIC(12,2) NOT NULL CHECK (price > 0),
  attributes     JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(attributes) = 'object'),
  seller         TEXT NOT NULL CHECK (char_length(btrim(seller)) BETWEEN 2 AND 100),
  tags           TEXT[] NOT NULL DEFAULT '{}',
  status         TEXT NOT NULL DEFAULT 'PENDING'
                 CHECK (status IN ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED')),
  final_content  JSONB,          -- revised version snapshot, set when the listing is approved
  decision_note  TEXT,           -- reviewer's reason for final approve/reject
  decided_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Duplicate detection enforced by the database (case/whitespace-insensitive, race-safe)
CREATE UNIQUE INDEX IF NOT EXISTS listings_seller_title_unique
  ON listings (lower(btrim(seller)), lower(btrim(title)));

CREATE INDEX IF NOT EXISTS listings_status_created_idx
  ON listings (status, created_at);

-- One row per AI run (success or failure). Older runs are kept as history.
CREATE TABLE IF NOT EXISTS analysis_runs (
  id                  SERIAL PRIMARY KEY,
  listing_id          INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  model               TEXT NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('SUCCEEDED', 'FAILED')),
  retrieved_sections  TEXT[] NOT NULL DEFAULT '{}',
  summary             TEXT,
  raw_output          JSONB,
  error_message       TEXT,
  latency_ms          INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analysis_runs_listing_idx
  ON analysis_runs (listing_id, created_at DESC);

-- One row per AI suggestion; the human decision lives here.
CREATE TABLE IF NOT EXISTS findings (
  id                SERIAL PRIMARY KEY,
  analysis_run_id   INTEGER NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  listing_id        INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  field             TEXT NOT NULL
                    CHECK (field IN ('title', 'description', 'category', 'price', 'attributes', 'tags')),
  issue_type        TEXT NOT NULL
                    CHECK (issue_type IN ('UNCLEAR', 'MISLEADING', 'PROHIBITED', 'INCOMPLETE',
                                          'UNVERIFIABLE_CLAIM', 'ASSUMPTION')),
  severity          TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH')),
  policy_section    TEXT NOT NULL,      -- must be one of the retrieved section IDs (checked in code)
  explanation       TEXT NOT NULL,
  original_excerpt  TEXT,               -- exact text from the listing the finding refers to
  suggested_text    TEXT,               -- AI's proposed replacement (null = advisory only)
  decision          TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (decision IN ('PENDING', 'APPROVED', 'EDITED', 'REJECTED')),
  final_text        TEXT,               -- what the human accepted (AI text or edited text)
  decided_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS findings_listing_idx ON findings (listing_id);
CREATE INDEX IF NOT EXISTS findings_run_idx ON findings (analysis_run_id);

-- Append-only audit trail: never UPDATE or DELETE rows here.
CREATE TABLE IF NOT EXISTS review_events (
  id          BIGSERIAL PRIMARY KEY,
  listing_id  INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  finding_id  INTEGER REFERENCES findings(id) ON DELETE SET NULL,
  action      TEXT NOT NULL CHECK (action IN (
                'CREATED', 'ANALYSIS_SUCCEEDED', 'ANALYSIS_FAILED',
                'FINDING_APPROVED', 'FINDING_EDITED', 'FINDING_REJECTED',
                'LISTING_APPROVED', 'LISTING_REJECTED')),
  actor       TEXT NOT NULL DEFAULT 'reviewer',
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS review_events_listing_idx
  ON review_events (listing_id, created_at);