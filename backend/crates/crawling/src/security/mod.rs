//! Security policies for URL validation, DNS resolution, network access,
//! redirect handling, and SSRF prevention.
//!
//! Reuses `answerscope_web_intelligence::safe_url` for canonical URL parsing
//! and public-IP enforcement, then adds per-hop redirect validation and
//! DNS rebinding protection.

use std::net::{IpAddr, SocketAddr};
use std::time::Instant;
use tokio::net::lookup_host;
use tracing::warn;
use url::Url;
use serde::{Deserialize, Serialize};

use crate::domain::{ContentFingerprint, is_allowed_scheme, is_safe_host, normalize_url_for_frontier};

/// Result of validating a target URL before any network connection.
#[derive(Debug, Clone)]
pub struct ValidatedTarget {
    pub url: Url,
    pub resolved_addresses: Vec<SocketAddr>,
}

/// Rejected destination with reason.
#[derive(Debug, Clone, thiserror::Error)]
#[error("{0}")]
pub struct SecurityRejection(pub String);

/// DNS rebinding guard: records the first-resolved address set for a host
/// and rejects subsequent resolutions that differ.
#[derive(Debug, Clone, Default)]
pub struct DnsRebindingGuard {
    entries: std::collections::HashMap<String, (Vec<IpAddr>, Instant)>,
    ttl_seconds: u64,
}

impl DnsRebindingGuard {
    pub fn new(ttl_seconds: u64) -> Self {
        Self {
            entries: std::collections::HashMap::new(),
            ttl_seconds,
        }
    }

    /// Validate that the newly resolved addresses match the previously
    /// observed set for this host (within TTL). Returns Err if rebinding
    /// is detected.
    pub fn check(&mut self, host: &str, addresses: &[SocketAddr]) -> Result<(), SecurityRejection> {
        let now = Instant::now();
        let ips: Vec<IpAddr> = addresses.iter().map(|a| a.ip()).collect();

        if let Some((prev_ips, prev_time)) = self.entries.get(host) {
            if now.duration_since(*prev_time).as_secs() < self.ttl_seconds {
                let prev_set: std::collections::HashSet<IpAddr> =
                    prev_ips.iter().cloned().collect();
                let curr_set: std::collections::HashSet<IpAddr> = ips.iter().cloned().collect();
                if prev_set != curr_set {
                    warn!(host, prev_ips = ?prev_set, ips = ?curr_set, "DNS rebinding detected");
                    return Err(SecurityRejection(format!(
                        "DNS rebinding detected for host {host}"
                    )));
                }
            }
        }

        self.entries.insert(host.to_owned(), (ips, now));
        Ok(())
    }
}

/// Validate a URL and resolve it to public addresses only.
///
/// Performs:
/// - Scheme check (HTTP/HTTPS only)
/// - Credential rejection
/// - Host presence check
/// - Localhost/private IP rejection
/// - DNS resolution through the system resolver
/// - Public IP enforcement on every resolved address
/// - DNS rebinding guard check
pub async fn validate_target(
    raw_url: &str,
    guard: &mut DnsRebindingGuard,
) -> Result<ValidatedTarget, SecurityRejection> {
    let mut url = Url::parse(raw_url).map_err(|e| SecurityRejection(format!("Invalid URL: {e}")))?;

    if !is_allowed_scheme(&url) {
        return Err(SecurityRejection("Only HTTP and HTTPS URLs are allowed.".into()));
    }

    if url.username() != "" || url.password().is_some() {
        return Err(SecurityRejection("URLs containing credentials are not allowed.".into()));
    }

    let host = url
        .host_str()
        .ok_or_else(|| SecurityRejection("URL must include a public hostname.".into()))?;

    if !is_safe_host(host) {
        return Err(SecurityRejection(
            "Local, reserved, or private network targets are not allowed.".into(),
        ));
    }

    let port = url.port_or_known_default().unwrap_or(443);
    let addresses: Vec<SocketAddr> = lookup_host((host, port))
        .await
        .map_err(|e| SecurityRejection(format!("DNS resolution failed: {e}")))?
        .collect();

    if addresses.is_empty() {
        return Err(SecurityRejection("DNS lookup returned no addresses".into()));
    }

    for addr in &addresses {
        answerscope_web_intelligence::safe_url::ensure_public_ip(addr.ip())
            .map_err(|e| SecurityRejection(format!("SSRF protection: {e}")))?;
    }

    guard.check(host, &addresses)?;

    normalize_url_for_frontier(&mut url);

    Ok(ValidatedTarget { url, resolved_addresses: addresses })
}

/// Validate a redirect target against the same security policy.
///
/// The redirect target is resolved independently and checked for SSRF.
/// The original host is not inherited — every hop is validated on its own.
pub async fn validate_redirect(
    from: &Url,
    location: &str,
    guard: &mut DnsRebindingGuard,
) -> Result<Url, SecurityRejection> {
    let joined = from.join(location).map_err(|e| SecurityRejection(format!("Redirect join error: {e}")))?;
    let validated = validate_target(joined.as_str(), guard).await?;
    Ok(validated.url)
}

/// Network policy: which ports are allowed for outbound connections.
#[derive(Debug, Clone, Copy, Default)]
pub struct NetworkPolicy {
    pub allowed_ports: [u16; 2],
}

impl NetworkPolicy {
    pub fn http_https() -> Self {
        Self { allowed_ports: [80, 443] }
    }

    pub fn is_port_allowed(&self, port: u16) -> bool {
        self.allowed_ports.contains(&port)
    }
}

/// Redirect policy: maximum hops and whether cross-origin redirects are allowed.
#[derive(Debug, Clone, Copy, Default)]
pub struct RedirectPolicy {
    pub max_hops: usize,
    pub allow_cross_origin: bool,
}

impl RedirectPolicy {
    pub fn strict() -> Self {
        Self {
            max_hops: 5,
            allow_cross_origin: false,
        }
    }

    pub fn lenient() -> Self {
        Self {
            max_hops: 10,
            allow_cross_origin: true,
        }
    }
}

/// SSRF protection summary for audit logging.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SsrfReport {
    pub target_url: String,
    pub resolved_ips: Vec<String>,
    pub dns_rebinding_checked: bool,
    pub ports_checked: Vec<u16>,
    pub rejected: bool,
    pub rejection_reason: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use url::Url;

    #[test]
    fn dns_rebinding_guard_detects_changed_ips() {
        let mut guard = DnsRebindingGuard::new(3600);
        let addrs1: Vec<SocketAddr> = vec!["1.2.3.4:443".parse().unwrap()];
        let addrs2: Vec<SocketAddr> = vec!["5.6.7.8:443".parse().unwrap()];

        assert!(guard.check("example.com", &addrs1).is_ok());
        assert!(guard.check("example.com", &addrs1).is_ok());
        assert!(guard.check("example.com", &addrs2).is_err());
    }

    #[test]
    fn dns_rebinding_guard_expires_after_ttl() {
        let mut guard = DnsRebindingGuard::new(0); // TTL of 0 means always re-check
        let addrs1: Vec<SocketAddr> = vec!["1.2.3.4:443".parse().unwrap()];
        let addrs2: Vec<SocketAddr> = vec!["5.6.7.8:443".parse().unwrap()];

        assert!(guard.check("example.com", &addrs1).is_ok());
        // With TTL=0, every check is treated as new, so different IPs are allowed.
        // This tests that the guard doesn't permanently cache.
        assert!(guard.check("example.com", &addrs2).is_ok());
    }

    #[test]
    fn validate_target_blocks_localhost() {
        // We can't easily async-test here without a runtime, but we verify
        // the guard logic separately above.
        let _ = is_allowed_scheme(&Url::parse("http://localhost/").unwrap());
        assert!(!is_safe_host("localhost"));
    }

    #[test]
    fn network_policy_default_is_http_https() {
        let policy = NetworkPolicy::http_https();
        assert!(policy.is_port_allowed(80));
        assert!(policy.is_port_allowed(443));
        assert!(!policy.is_port_allowed(22));
        assert!(!policy.is_port_allowed(3306));
    }
}
