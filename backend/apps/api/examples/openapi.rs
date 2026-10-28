//! Print the generated OpenAPI document.
//!
//! Regenerate `docs/openapi.json` with:
//!   cargo run -p answerscope-api --example openapi > ../docs/openapi.json

fn main() -> anyhow::Result<()> {
    let document = answerscope_api::openapi::document();
    println!("{}", serde_json::to_string_pretty(&document)?);
    Ok(())
}
