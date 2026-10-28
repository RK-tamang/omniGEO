# Billing test coverage

The domain tests live in `crates/billing/src/lib.rs`. The API integration test
`apps/api/tests/billing_flow.rs` needs a disposable PostgreSQL database because
it applies the workspace migrations and creates/deletes test organizations.

With the Compose PostgreSQL service running on its default local mapping:

```sh
cd backend
BILLING_TEST_DATABASE_URL=postgres://answerscope:answerscope@127.0.0.1:55432/answerscope \
  CARGO_PROFILE_DEV_DEBUG=0 CARGO_INCREMENTAL=0 cargo test --workspace
```

Use only a disposable test database. The billing integration test invokes the
complete migration set and inserts real subscription, payment, and refund rows.
