use crate::{domain::*, storage::Database};
use rusqlite::{params, OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Rule {
    id: String,
    enabled: bool,
    #[serde(rename = "match")]
    matcher: String,
    #[serde(default)]
    method: String,
    action: String,
    #[serde(default)]
    key: String,
    #[serde(default)]
    value: String,
    #[serde(default)]
    body: String,
    #[serde(default)]
    target: String,
    #[serde(default)]
    status: u16,
    #[serde(default)]
    delay_ms: u32,
    #[serde(default)]
    content_type: String,
}
pub fn validate(rules: &[Rule]) -> ApiResult<()> {
    if rules.len() > 200 {
        return Err(ApiError::new("validation", "Limit rule sets to 200 rules."));
    }
    let mut ids = std::collections::HashSet::new();
    let mut total = 0;
    let mut mirrors = 0;
    for rule in rules {
        valid_id(&rule.id)?;
        if !ids.insert(&rule.id) || rule.matcher.is_empty() || rule.matcher.len() > 2048 {
            return Err(ApiError::new(
                "validation",
                "Rules need unique UUIDs and nonempty URL substring matches.",
            ));
        }
        if !rule.method.is_empty()
            && rule.method != "*"
            && (!rule
                .method
                .bytes()
                .all(|c| c.is_ascii_uppercase() || c == b'-')
                || rule.method.len() > 20)
        {
            return Err(ApiError::new(
                "validation",
                "Rule method must be an uppercase HTTP method or *.",
            ));
        }
        if ![
            "mock",
            "request-header",
            "request-body",
            "response-header",
            "response-body",
            "redirect",
            "map-remote",
            "gateway",
            "mirror",
            "delay",
            "drop",
            "breakpoint",
            "response-breakpoint",
        ]
        .contains(&rule.action.as_str())
        {
            return Err(ApiError::new(
                "unsupported",
                "This rule action has no native implementation.",
            ));
        }
        if rule.enabled && rule.action == "mirror" {
            mirrors += 1;
            if mirrors > 4 {
                return Err(ApiError::new(
                    "quota",
                    "At most four enabled mirror targets are allowed.",
                ));
            }
        }
        total += rule.body.len() + rule.value.len() + rule.target.len() + rule.matcher.len();
        if total > 200 * 1024 || rule.delay_ms > 30000 {
            return Err(ApiError::new(
                "validation",
                "Rule size/delay limit exceeded.",
            ));
        }
        if rule.action.ends_with("-header") {
            if rule.key.is_empty()
                || rule.key.len() > 128
                || !rule
                    .key
                    .bytes()
                    .all(|v| v.is_ascii_alphanumeric() || b"!#$%&'*+-.^_`|~".contains(&v))
                || rule.value.contains(['\r', '\n'])
                || [
                    "host",
                    "content-length",
                    "transfer-encoding",
                    "connection",
                    "upgrade",
                ]
                .contains(&rule.key.to_lowercase().as_str())
            {
                return Err(ApiError::new(
                    "validation",
                    "Invalid header or transport-owned header.",
                ));
            }
        }
        if ["mock", "redirect"].contains(&rule.action.as_str())
            && !(200..=599).contains(&rule.status)
        {
            return Err(ApiError::new(
                "validation",
                "Response status must be 200–599.",
            ));
        }
        if ["redirect", "map-remote", "gateway", "mirror"].contains(&rule.action.as_str()) {
            let url = reqwest::Url::parse(&rule.target)
                .map_err(|_| ApiError::new("validation", "Invalid rule target URL."))?;
            if !["http", "https"].contains(&url.scheme())
                || !url.username().is_empty()
                || url.password().is_some()
                || ["gateway", "mirror"].contains(&rule.action.as_str())
                    && (!matches!(url.path(), "" | "/")
                        || url.query().is_some()
                        || url.fragment().is_some())
            {
                return Err(ApiError::new("validation","Use an HTTP(S) target without credentials; gateway/mirror need an origin only."));
            }
        }
        if rule.content_type.contains(['\r', '\n']) || rule.content_type.len() > 160 {
            return Err(ApiError::new(
                "validation",
                "Invalid response Content-Type.",
            ));
        }
    }
    Ok(())
}
pub fn reject_listener_recursion(rules: &[Rule], port: u16) -> ApiResult<()> {
    for rule in rules {
        if rule.enabled && ["map-remote", "gateway", "mirror"].contains(&rule.action.as_str()) {
            let target = reqwest::Url::parse(&rule.target)
                .map_err(|_| ApiError::new("validation", "Invalid rule target URL."))?;
            if target.port_or_known_default() == Some(port)
                && matches!(target.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"))
            {
                return Err(ApiError::new(
                    "validation",
                    "Rule target points back to the active proxy listener.",
                ));
            }
        }
    }
    Ok(())
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveRules {
    pub id: String,
    pub revision: i64,
}
impl Database {
    pub fn active_rules(&self, workspace: &str) -> ApiResult<Option<ActiveRules>> {
        let connection = self.lock()?;
        Self::require_workspace(&connection, workspace)?;
        connection
            .query_row(
                "SELECT rule_set_id,revision FROM active_rules WHERE workspace_id=?1",
                [workspace],
                |r| {
                    Ok(ActiveRules {
                        id: r.get(0)?,
                        revision: r.get(1)?,
                    })
                },
            )
            .optional()
            .map_err(Into::into)
    }
    pub fn set_active_rules(&self, workspace: &str, id: &str, revision: i64) -> ApiResult<()> {
        valid_id(id)?;
        let mut connection = self.lock()?;
        Self::require_workspace(&connection, workspace)?;
        let tx = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let current: Option<(String, i64)> = tx
            .query_row(
                "SELECT kind,revision FROM entities WHERE workspace_id=?1 AND id=?2",
                params![workspace, id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()?;
        if !current.is_some_and(|(kind, value)| kind == "rule_set" && value == revision) {
            return Err(ApiError::new(
                "conflict",
                "Applied rule set changed before activation could be saved.",
            ));
        }
        tx.execute("INSERT INTO active_rules(workspace_id,rule_set_id,revision) VALUES(?1,?2,?3) ON CONFLICT(workspace_id) DO UPDATE SET rule_set_id=excluded.rule_set_id,revision=excluded.revision",params![workspace,id,revision])?;
        tx.commit()?;
        Ok(())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn mirror_target_and_limit_cannot_recurse() {
        let id = uuid::Uuid::new_v4().to_string();
        let one = serde_json::json!([{"id":id,"enabled":true,"match":"/","action":"mirror","target":"http://127.0.0.1:8899"}]);
        let rules: Vec<Rule> = serde_json::from_value(one).unwrap();
        validate(&rules).unwrap();
        assert!(reject_listener_recursion(&rules, 8899).is_err());
        let many=(0..5).map(|_|serde_json::json!({"id":uuid::Uuid::new_v4().to_string(),"enabled":true,"match":"/","action":"mirror","target":"http://example.invalid"})).collect::<Vec<_>>();
        let rules: Vec<Rule> = serde_json::from_value(serde_json::json!(many)).unwrap();
        assert!(validate(&rules).is_err());
    }
}
