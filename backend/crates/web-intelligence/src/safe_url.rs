//! URL canonicalization and network-target policy. DNS resolution must be repeated
//! immediately before every outbound connection; this module rejects literal unsafe targets.
use ipnet::IpNet;
use std::net::IpAddr;
use url::Url;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CanonicalUrl(Url);

impl CanonicalUrl {
    pub fn parse(raw: &str) -> Result<Self, String> {
        let candidate = raw.trim();
        let with_scheme = if candidate.contains("://") {
            candidate.to_owned()
        } else {
            format!("https://{candidate}")
        };
        let mut url = Url::parse(&with_scheme)
            .map_err(|_| "Enter a valid HTTP or HTTPS website URL.".to_owned())?;
        if !matches!(url.scheme(), "http" | "https") {
            return Err("Only HTTP and HTTPS URLs can be audited.".into());
        }
        if url.username() != "" || url.password().is_some() {
            return Err("URLs containing credentials are not allowed.".into());
        }
        let host = url
            .host_str()
            .ok_or_else(|| "The URL must include a public hostname.".to_owned())?;
        if host.eq_ignore_ascii_case("localhost") || host.ends_with(".localhost") {
            return Err("Local and private network targets are not allowed.".into());
        }
        // Url::host_str keeps brackets around IPv6 literals (e.g. "[::1]").
        // Strip them only for IP parsing; the original URL remains canonicalized by `url`.
        if let Ok(ip) = host.trim_matches(['[', ']']).parse::<IpAddr>() {
            ensure_public_ip(ip)?;
        }
        url.set_fragment(None);
        if url.path().is_empty() {
            url.set_path("/");
        }
        Ok(Self(url))
    }
    pub fn as_str(&self) -> &str {
        self.0.as_str()
    }
    pub fn into_string(self) -> String {
        self.0.into()
    }
}

pub fn ensure_public_ip(ip: IpAddr) -> Result<(), String> {
    if let IpAddr::V6(ipv6) = ip {
        if let Some(ipv4) = ipv6.to_ipv4_mapped() {
            return ensure_public_ip(IpAddr::V4(ipv4));
        }
    }
    let forbidden = [
        "0.0.0.0/8",
        "10.0.0.0/8",
        "100.64.0.0/10",
        "127.0.0.0/8",
        "169.254.0.0/16",
        "172.16.0.0/12",
        "192.0.0.0/24",
        "192.0.2.0/24",
        "192.168.0.0/16",
        "198.18.0.0/15",
        "198.51.100.0/24",
        "203.0.113.0/24",
        "192.88.99.0/24",
        "240.0.0.0/4",
        "224.0.0.0/4",
        "::/128",
        "::1/128",
        "fc00::/7",
        "fe80::/10",
        "ff00::/8",
        "2001:db8::/32",
    ];
    if forbidden
        .iter()
        .map(|cidr| cidr.parse::<IpNet>().expect("valid policy CIDR"))
        .any(|net| net.contains(&ip))
    {
        Err("Local, reserved, or private network targets are not allowed.".into())
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn canonicalizes_domain() {
        assert_eq!(
            CanonicalUrl::parse("example.com").unwrap().as_str(),
            "https://example.com/"
        );
    }
    #[test]
    fn blocks_ssrf_literals() {
        for url in ["http://127.0.0.1", "http://169.254.169.254", "http://[::1]"] {
            assert!(CanonicalUrl::parse(url).is_err(), "{url}");
        }
    }
    #[test]
    fn strips_fragment() {
        assert_eq!(
            CanonicalUrl::parse("https://example.com/a#x")
                .unwrap()
                .as_str(),
            "https://example.com/a"
        );
    }
    #[test]
    fn blocks_mapped_private_ipv4_and_documentation_ipv6() {
        for url in ["http://[::ffff:127.0.0.1]/", "http://[2001:db8::1]/"] {
            assert!(CanonicalUrl::parse(url).is_err(), "{url}");
        }
    }
}
