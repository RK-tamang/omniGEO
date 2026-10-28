CREATE TABLE auth_request_limits (
    flow text NOT NULL,
    subject_hash text NOT NULL,
    window_started_at timestamptz NOT NULL DEFAULT now(),
    request_count integer NOT NULL DEFAULT 0,
    blocked_until timestamptz,
    PRIMARY KEY (flow, subject_hash)
);

CREATE INDEX auth_request_limits_window_idx ON auth_request_limits(window_started_at);
