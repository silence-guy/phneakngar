//! Desktop workspace shell helpers (F5).
//!
//! Pure functions for deep-link → web path mapping, tray/window chrome labels,
//! and shell state snapshots. Kept free of Tauri so unit tests do not need a
//! window runtime.

use serde::{Deserialize, Serialize};

/// Scheme registered in `tauri.conf.json` for desktop deep links.
pub const DEEP_LINK_SCHEME: &str = "phneakngar";

/// Production control-plane origin used by the packaged desktop shell.
pub const PROD_WEB_ORIGIN: &str = "https://phneakngar.ai";

/// Local Next.js origin used by `tauri dev`.
pub const DEV_WEB_ORIGIN: &str = "http://localhost:3000";

/// Mutable shell chrome state pushed from the webview (or derived locally).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct ShellState {
    /// Chhlat / local runtime online flag.
    pub runtime_online: bool,
    /// Workspace-scoped pending approval count (high-stakes gate).
    pub pending_approvals: u32,
    /// Active workspace slug for deep-link navigation (e.g. "acme").
    pub workspace_slug: Option<String>,
}

/// Resolved navigation target for the main webview.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeepLinkNav {
    /// Path + optional query, always absolute under the web origin (e.g. `/w/acme/approvals`).
    pub path: String,
}

/// Origin the shell should load for the remote frontend.
pub fn web_origin(debug: bool) -> &'static str {
    if debug {
        DEV_WEB_ORIGIN
    } else {
        PROD_WEB_ORIGIN
    }
}

/// Build a full webview URL from an absolute app path.
pub fn web_url(origin: &str, path: &str) -> String {
    let origin = origin.trim_end_matches('/');
    let path = if path.starts_with('/') {
        path.to_string()
    } else {
        format!("/{path}")
    };
    format!("{origin}{path}")
}

/// Normalize a workspace slug for storage / path building.
///
/// Rejects empty, path-like, or query/fragment-tainted values so deep-link
/// capture and tray navigation stay aligned.
pub fn normalize_workspace_slug(slug: &str) -> Option<String> {
    let t = slug.trim().trim_matches('/');
    if t.is_empty() || t.contains('/') || t.contains('?') || t.contains('#') {
        None
    } else {
        Some(t.to_string())
    }
}

/// Extract a workspace slug from an absolute app path (`/w/{slug}/…`).
///
/// Ignores query/fragment so `/w/acme/home?tab=team` yields `"acme"`.
pub fn extract_workspace_slug_from_path(path: &str) -> Option<String> {
    let path_part = path.split('?').next().unwrap_or(path);
    let path_part = path_part.split('#').next().unwrap_or(path_part);
    let rest = path_part.strip_prefix("/w/")?;
    let slug = rest.split('/').next().unwrap_or("");
    normalize_workspace_slug(slug)
}

/// Build a workspace-scoped app path (`/w/{slug}/{segment...}`).
pub fn workspace_path(slug: &str, segments: &str) -> Option<String> {
    let slug = normalize_workspace_slug(slug)?;
    let segments = segments.trim().trim_matches('/');
    if segments.is_empty() {
        Some(format!("/w/{slug}/home"))
    } else {
        Some(format!("/w/{slug}/{segments}"))
    }
}

/// Approvals path for a workspace slug, if the slug is usable.
pub fn approvals_path(slug: &str) -> Option<String> {
    workspace_path(slug, "approvals")
}

/// Runtimes path for a workspace slug, if the slug is usable.
pub fn runtimes_path(slug: &str) -> Option<String> {
    workspace_path(slug, "runtimes")
}

/// Fallback when no workspace slug is known yet.
pub fn workspaces_fallback_path() -> &'static str {
    "/workspaces?auto"
}

/// Parse a deep-link or https URL into a same-app path the webview can open.
///
/// Accepted forms:
/// - `phneakngar://w/{slug}/approvals`
/// - `phneakngar:///w/{slug}/approvals`
/// - `phneakngar://open?path=/w/{slug}/issues/abc`
/// - `https://phneakngar.ai/w/{slug}/agents/{id}`
/// - `http://localhost:3000/w/{slug}/home`
/// - bare app paths: `/w/{slug}/approvals`
pub fn parse_deep_link(raw: &str) -> Option<DeepLinkNav> {
    let raw = raw.trim();
    if raw.is_empty() {
        return None;
    }

    let path = if let Some(rest) = strip_http_origin(raw) {
        rest
    } else if let Some(rest) = strip_custom_scheme(raw) {
        rest
    } else if raw.starts_with('/') {
        raw.to_string()
    } else {
        return None;
    };

    let normalized = normalize_app_path(&path)?;
    Some(DeepLinkNav { path: normalized })
}

fn strip_http_origin(raw: &str) -> Option<String> {
    for prefix in ["https://", "http://"] {
        if let Some(rest) = raw.strip_prefix(prefix) {
            // host[/path]
            if let Some(slash) = rest.find('/') {
                return Some(rest[slash..].to_string());
            }
            return Some("/".to_string());
        }
    }
    None
}

fn strip_custom_scheme(raw: &str) -> Option<String> {
    let rest = raw
        .strip_prefix(&format!("{DEEP_LINK_SCHEME}://"))
        .or_else(|| raw.strip_prefix(&format!("{DEEP_LINK_SCHEME}:")))?;

    // open?path=/w/...
    if rest.starts_with("open?") || rest.starts_with("open/?") {
        let query = rest.split('?').nth(1).unwrap_or("");
        for pair in query.split('&') {
            let mut kv = pair.splitn(2, '=');
            let key = kv.next().unwrap_or("");
            let val = kv.next().unwrap_or("");
            if key == "path" {
                return Some(urlencoding_decode(val));
            }
        }
        return None;
    }

    if rest.starts_with('/') {
        // phneakngar:///w/slug/...
        Some(rest.to_string())
    } else if rest.is_empty() {
        Some("/workspaces?auto".to_string())
    } else {
        // phneakngar://w/slug/... → treat host+path as /w/slug/...
        Some(format!("/{rest}"))
    }
}

/// Minimal percent-decoding for deep-link query values (`%2F` → `/`).
fn urlencoding_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = String::with_capacity(input.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(h), Some(l)) = (from_hex(bytes[i + 1]), from_hex(bytes[i + 2])) {
                out.push((h << 4 | l) as char);
                i += 3;
                continue;
            }
        }
        if bytes[i] == b'+' {
            out.push(' ');
        } else {
            out.push(bytes[i] as char);
        }
        i += 1;
    }
    out
}

fn from_hex(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

fn normalize_app_path(path: &str) -> Option<String> {
    let (path_part, query) = match path.split_once('?') {
        Some((p, q)) => (p, Some(q)),
        None => (path, None),
    };
    // Drop fragments.
    let path_part = path_part.split('#').next().unwrap_or(path_part);

    let mut path_part = path_part.to_string();
    if !path_part.starts_with('/') {
        path_part = format!("/{path_part}");
    }

    // Collapse duplicate slashes in the path only.
    while path_part.contains("//") {
        path_part = path_part.replace("//", "/");
    }

    let allowed = path_part == "/workspaces"
        || path_part.starts_with("/workspaces/")
        || path_part.starts_with("/w/");
    if !allowed {
        return None;
    }

    // Reject traversal segments.
    for seg in path_part.split('/') {
        if seg == ".." {
            return None;
        }
    }

    match query {
        Some(q) if !q.is_empty() => Some(format!("{path_part}?{q}")),
        _ => Some(path_part),
    }
}

/// Tray tooltip: runtime status + optional approval badge count.
pub fn format_tray_tooltip(state: &ShellState) -> String {
    let runtime = if state.runtime_online {
        "Runtime online"
    } else {
        "Runtime offline"
    };
    match state.pending_approvals {
        0 => format!("ភ្នាក់ងារ — {runtime}"),
        1 => format!("ភ្នាក់ងារ — {runtime} · 1 approval pending"),
        n => format!("ភ្នាក់ងារ — {runtime} · {n} approvals pending"),
    }
}

/// Disabled status row in the tray menu.
pub fn format_runtime_menu_label(online: bool) -> String {
    if online {
        "Runtime: Online".to_string()
    } else {
        "Runtime: Offline".to_string()
    }
}

/// Approvals tray item with badge count.
pub fn format_approvals_menu_label(count: u32) -> String {
    match count {
        0 => "Approvals".to_string(),
        1 => "Approvals (1)".to_string(),
        n => format!("Approvals ({n})"),
    }
}

/// Main window title, including a compact badge when approvals are pending.
pub fn format_window_title(pending_approvals: u32) -> String {
    match pending_approvals {
        0 => "ភ្នាក់ងារ".to_string(),
        n => format!("ភ្នាក់ងារ ({n})"),
    }
}

/// Prefer a workspace approvals path; fall back to workspace picker.
pub fn resolve_approvals_nav(slug: Option<&str>) -> String {
    slug.and_then(approvals_path)
        .unwrap_or_else(|| workspaces_fallback_path().to_string())
}

/// Prefer a workspace runtimes path; fall back to workspace picker.
pub fn resolve_runtimes_nav(slug: Option<&str>) -> String {
    slug.and_then(runtimes_path)
        .unwrap_or_else(|| workspaces_fallback_path().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_custom_scheme_host_path() {
        let nav = parse_deep_link("phneakngar://w/acme/approvals").unwrap();
        assert_eq!(nav.path, "/w/acme/approvals");
    }

    #[test]
    fn parse_custom_scheme_absolute_path() {
        let nav = parse_deep_link("phneakngar:///w/acme/issues/iss_1").unwrap();
        assert_eq!(nav.path, "/w/acme/issues/iss_1");
    }

    #[test]
    fn parse_open_query_path() {
        let nav = parse_deep_link("phneakngar://open?path=%2Fw%2Facme%2Fruntimes").unwrap();
        assert_eq!(nav.path, "/w/acme/runtimes");
    }

    #[test]
    fn parse_https_origin() {
        let nav = parse_deep_link("https://phneakngar.ai/w/acme/agents/a1").unwrap();
        assert_eq!(nav.path, "/w/acme/agents/a1");
    }

    #[test]
    fn parse_localhost_origin() {
        let nav = parse_deep_link("http://localhost:3000/w/acme/home").unwrap();
        assert_eq!(nav.path, "/w/acme/home");
    }

    #[test]
    fn parse_bare_app_path() {
        let nav = parse_deep_link("/w/acme/approvals").unwrap();
        assert_eq!(nav.path, "/w/acme/approvals");
    }

    #[test]
    fn parse_rejects_unknown_paths() {
        assert!(parse_deep_link("phneakngar://evil/../etc/passwd").is_none());
        assert!(parse_deep_link("phneakngar://settings").is_none());
        assert!(parse_deep_link("https://evil.example/w/acme").is_some()); // path still /w/acme
        assert!(parse_deep_link("https://evil.example/admin").is_none());
        assert!(parse_deep_link("").is_none());
    }

    #[test]
    fn parse_rejects_traversal() {
        assert!(parse_deep_link("phneakngar:///w/acme/../../etc/passwd").is_none());
    }

    #[test]
    fn parse_preserves_query() {
        let nav = parse_deep_link("phneakngar://w/acme/home?tab=team").unwrap();
        assert_eq!(nav.path, "/w/acme/home?tab=team");
    }

    #[test]
    fn workspace_paths() {
        assert_eq!(
            workspace_path("acme", "approvals").as_deref(),
            Some("/w/acme/approvals")
        );
        assert_eq!(
            workspace_path("acme", "/runtimes/").as_deref(),
            Some("/w/acme/runtimes")
        );
        assert_eq!(workspace_path("", "approvals"), None);
        assert_eq!(workspace_path("a/b", "approvals"), None);
    }

    #[test]
    fn tooltip_and_badge_labels() {
        let offline = ShellState {
            runtime_online: false,
            pending_approvals: 0,
            workspace_slug: None,
        };
        assert_eq!(
            format_tray_tooltip(&offline),
            "ភ្នាក់ងារ — Runtime offline"
        );

        let pending = ShellState {
            runtime_online: true,
            pending_approvals: 3,
            workspace_slug: Some("acme".into()),
        };
        assert_eq!(
            format_tray_tooltip(&pending),
            "ភ្នាក់ងារ — Runtime online · 3 approvals pending"
        );
        assert_eq!(format_approvals_menu_label(0), "Approvals");
        assert_eq!(format_approvals_menu_label(1), "Approvals (1)");
        assert_eq!(format_approvals_menu_label(3), "Approvals (3)");
        assert_eq!(format_runtime_menu_label(true), "Runtime: Online");
        assert_eq!(format_runtime_menu_label(false), "Runtime: Offline");
        assert_eq!(format_window_title(0), "ភ្នាក់ងារ");
        assert_eq!(format_window_title(2), "ភ្នាក់ងារ (2)");
    }

    #[test]
    fn resolve_nav_with_and_without_slug() {
        assert_eq!(
            resolve_approvals_nav(Some("acme")),
            "/w/acme/approvals"
        );
        assert_eq!(
            resolve_approvals_nav(None),
            "/workspaces?auto"
        );
        assert_eq!(
            resolve_runtimes_nav(Some("acme")),
            "/w/acme/runtimes"
        );
    }

    #[test]
    fn web_url_joins_origin_and_path() {
        assert_eq!(
            web_url("https://phneakngar.ai/", "/w/acme/home"),
            "https://phneakngar.ai/w/acme/home"
        );
        assert_eq!(
            web_url(DEV_WEB_ORIGIN, "w/acme/home"),
            "http://localhost:3000/w/acme/home"
        );
    }

    #[test]
    fn web_origin_debug_vs_release() {
        assert_eq!(web_origin(true), DEV_WEB_ORIGIN);
        assert_eq!(web_origin(false), PROD_WEB_ORIGIN);
    }

    #[test]
    fn shell_shows_badge_count_from_pending_approvals() {
        // F5 acceptance: shell chrome surfaces the pending-approval badge count.
        let state = ShellState {
            runtime_online: true,
            pending_approvals: 5,
            workspace_slug: Some("ops".into()),
        };
        assert!(format_tray_tooltip(&state).contains("5 approvals pending"));
        assert_eq!(format_approvals_menu_label(state.pending_approvals), "Approvals (5)");
        assert_eq!(format_window_title(state.pending_approvals), "ភ្នាក់ងារ (5)");
    }

    #[test]
    fn shell_runtime_status_and_singular_approval_badge() {
        // F5 acceptance: runtime online/offline status + singular badge copy.
        let offline = ShellState {
            runtime_online: false,
            pending_approvals: 1,
            workspace_slug: Some("ops".into()),
        };
        assert_eq!(
            format_tray_tooltip(&offline),
            "ភ្នាក់ងារ — Runtime offline · 1 approval pending"
        );
        assert_eq!(format_runtime_menu_label(false), "Runtime: Offline");
        assert_eq!(format_runtime_menu_label(true), "Runtime: Online");
        assert_eq!(format_approvals_menu_label(1), "Approvals (1)");
        assert_eq!(format_window_title(1), "ភ្នាក់ងារ (1)");
    }

    #[test]
    fn deep_link_channel_and_task_paths() {
        // Parent F5: deep link to channel/task (beyond tray-only wrap).
        let channel = parse_deep_link("phneakngar://w/acme/channels/ch_1").unwrap();
        assert_eq!(channel.path, "/w/acme/channels/ch_1");
        let task = parse_deep_link("phneakngar:///w/acme/tasks/task_9").unwrap();
        assert_eq!(task.path, "/w/acme/tasks/task_9");
        let issue = parse_deep_link("https://phneakngar.ai/w/acme/issues/iss_2").unwrap();
        assert_eq!(issue.path, "/w/acme/issues/iss_2");
        let open = parse_deep_link("phneakngar://open?path=%2Fw%2Facme%2Fchannels%2Fc1").unwrap();
        assert_eq!(open.path, "/w/acme/channels/c1");
    }

    #[test]
    fn deep_link_drops_fragment_and_allows_workspaces() {
        let nav = parse_deep_link("phneakngar://w/acme/home#section").unwrap();
        assert_eq!(nav.path, "/w/acme/home");
        let picker = parse_deep_link("phneakngar://workspaces?auto").unwrap();
        assert_eq!(picker.path, "/workspaces?auto");
        let bare_scheme = parse_deep_link("phneakngar://").unwrap();
        assert_eq!(bare_scheme.path, "/workspaces?auto");
    }

    #[test]
    fn normalize_and_extract_workspace_slug() {
        assert_eq!(normalize_workspace_slug(" acme ").as_deref(), Some("acme"));
        assert_eq!(normalize_workspace_slug(""), None);
        assert_eq!(normalize_workspace_slug("a/b"), None);
        assert_eq!(normalize_workspace_slug("acme?x"), None);
        assert_eq!(normalize_workspace_slug("acme#x"), None);

        // Query/fragment must not poison the stored slug.
        assert_eq!(
            extract_workspace_slug_from_path("/w/acme/home?tab=team").as_deref(),
            Some("acme")
        );
        assert_eq!(
            extract_workspace_slug_from_path("/w/acme?tab=team").as_deref(),
            Some("acme")
        );
        assert_eq!(
            extract_workspace_slug_from_path("/w/acme/channels/c1#top").as_deref(),
            Some("acme")
        );
        assert_eq!(extract_workspace_slug_from_path("/workspaces?auto"), None);
        assert_eq!(extract_workspace_slug_from_path("/w/"), None);
    }

    #[test]
    fn tray_nav_uses_slug_after_deep_link_path() {
        // End-to-end pure flow: deep link path → slug → tray Approvals/Runtimes targets.
        let nav = parse_deep_link("phneakngar://w/ops/channels/inbox").unwrap();
        let slug = extract_workspace_slug_from_path(&nav.path);
        assert_eq!(slug.as_deref(), Some("ops"));
        assert_eq!(
            resolve_approvals_nav(slug.as_deref()),
            "/w/ops/approvals"
        );
        assert_eq!(
            resolve_runtimes_nav(slug.as_deref()),
            "/w/ops/runtimes"
        );
        assert_eq!(
            resolve_runtimes_nav(None),
            "/workspaces?auto"
        );
        assert_eq!(approvals_path("ops").as_deref(), Some("/w/ops/approvals"));
        assert_eq!(runtimes_path("ops").as_deref(), Some("/w/ops/runtimes"));
    }

    #[test]
    fn shell_state_default_and_serde_shape() {
        let state = ShellState::default();
        assert!(!state.runtime_online);
        assert_eq!(state.pending_approvals, 0);
        assert_eq!(state.workspace_slug, None);

        // Badge stays clean at zero pending.
        assert_eq!(format_approvals_menu_label(0), "Approvals");
        assert_eq!(format_window_title(0), "ភ្នាក់ងារ");
        assert_eq!(
            format_tray_tooltip(&state),
            "ភ្នាក់ងារ — Runtime offline"
        );
    }
}
