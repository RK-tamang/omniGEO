use serde::Serialize;
use serde_json::Value;
use url::Url;

const ENDPOINT: &str = "https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed";

#[derive(Serialize)]
pub struct PageSpeedRun {
    pub strategy: String,
    pub performance_score: Option<f64>,
    pub category_scores: Value,
    pub metrics: Value,
    pub opportunities: Vec<PageSpeedOpportunity>,
    pub raw_status: String,
}
#[derive(Serialize)]
pub struct PageSpeedOpportunity {
    pub id: String,
    pub title: String,
    pub savings_ms: Option<f64>,
}

pub async fn run(
    target: &str,
    strategy: &str,
    api_key: Option<&str>,
) -> Result<PageSpeedRun, String> {
    let mut query = Url::parse(ENDPOINT).map_err(|error| error.to_string())?;
    {
        let mut pairs = query.query_pairs_mut();
        pairs.append_pair("url", target);
        pairs.append_pair("strategy", strategy);
        for category in ["PERFORMANCE", "ACCESSIBILITY", "SEO"] {
            pairs.append_pair("category", category);
        }
        if let Some(key) = api_key {
            pairs.append_pair("key", key);
        }
    }
    let response = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(45))
        .build()
        .map_err(|error| error.to_string())?
        .get(query)
        .send()
        .await
        .map_err(|error| error.to_string())?;
    let status = response.status();
    let retry_after = response
        .headers()
        .get(reqwest::header::RETRY_AFTER)
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned);
    let raw_body = response.text().await.map_err(|error| error.to_string())?;
    let body: Value = serde_json::from_str(&raw_body).unwrap_or(Value::Null);
    if !status.is_success() {
        let message = body
            .get("error")
            .and_then(|value| value.get("message"))
            .and_then(Value::as_str)
            .unwrap_or("PageSpeed request failed")
            .to_owned();
        if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
            return Err(format!(
                "quota_exceeded: {message}{}",
                retry_after
                    .map(|value| format!("; retry after {value} seconds"))
                    .unwrap_or_default()
            ));
        }
        if status == reqwest::StatusCode::FORBIDDEN {
            return Err(format!("provider_rejected: {message}"));
        }
        return Err(format!("provider_http_{}: {message}", status.as_u16()));
    }
    let lighthouse = body.get("lighthouseResult").unwrap_or(&Value::Null);
    let performance_score = lighthouse
        .get("categories")
        .and_then(|value| value.get("performance"))
        .and_then(|value| value.get("score"))
        .and_then(Value::as_f64)
        .map(|score| score * 100.0);
    let category_scores = lighthouse.get("categories").cloned().unwrap_or(Value::Null);
    let metrics=lighthouse.get("audits").map(|audits|serde_json::json!({"first_contentful_paint":audits.get("first-contentful-paint").and_then(|value|value.get("displayValue")),"largest_contentful_paint":audits.get("largest-contentful-paint").and_then(|value|value.get("displayValue")),"total_blocking_time":audits.get("total-blocking-time").and_then(|value|value.get("displayValue")),"cumulative_layout_shift":audits.get("cumulative-layout-shift").and_then(|value|value.get("displayValue"))})).unwrap_or(Value::Null);
    let opportunities = lighthouse
        .get("audits")
        .and_then(Value::as_object)
        .map(|audits| {
            audits
                .iter()
                .filter_map(|(id, audit)| {
                    let savings = audit
                        .get("details")
                        .and_then(|value| value.get("overallSavingsMs"))
                        .and_then(Value::as_f64);
                    (savings.unwrap_or(0.0) > 0.0).then(|| PageSpeedOpportunity {
                        id: id.clone(),
                        title: audit
                            .get("title")
                            .and_then(Value::as_str)
                            .unwrap_or(id)
                            .to_owned(),
                        savings_ms: savings,
                    })
                })
                .take(20)
                .collect()
        })
        .unwrap_or_default();
    Ok(PageSpeedRun {
        strategy: strategy.into(),
        performance_score,
        category_scores,
        metrics,
        opportunities,
        raw_status: status.to_string(),
    })
}
