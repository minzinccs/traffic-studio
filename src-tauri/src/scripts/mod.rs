use crate::domain::*;
use rquickjs::{Context, Runtime};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ScriptInput {
    pub id: String,
    pub source: String,
    pub context: Value,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptResult {
    pub request: Value,
    pub variables: Value,
    pub assertions: Vec<Assertion>,
    pub logs: Vec<String>,
}
#[derive(Serialize, Deserialize)]
pub struct Assertion {
    pub name: String,
    pub passed: bool,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ScriptSummary {
    pub phase: String,
    pub assertions: Vec<Assertion>,
    pub failed: bool,
}
impl crate::storage::Database {
    pub fn record_script_results(
        &self,
        workspace_id: &str,
        run_id: &str,
        summaries: Vec<ScriptSummary>,
    ) -> ApiResult<i64> {
        valid_id(run_id)?;
        if summaries.len() > 2
            || summaries.iter().any(|summary| {
                !["pre", "post"].contains(&summary.phase.as_str())
                    || summary.assertions.len() > 100
                    || summary
                        .assertions
                        .iter()
                        .any(|assertion| assertion.name.len() > 1024)
            })
        {
            return Err(ApiError::new("validation", "Invalid script summary."));
        }
        let mut connection = self.lock()?;
        Self::require_workspace(&connection, workspace_id)?;
        let tx = connection.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
        let (revision,payload):(i64,String)=tx.query_row("SELECT revision,payload FROM entities WHERE workspace_id=?1 AND id=?2 AND kind='api_run'",rusqlite::params![workspace_id,run_id],|row|Ok((row.get(0)?,row.get(1)?)))?;
        let mut value: Value = serde_json::from_str(&payload)?;
        if value["source"] != "native_http" || value["state"] != "completed" {
            return Err(ApiError::new(
                "conflict",
                "Script summaries require a completed native run.",
            ));
        }
        value["scripts"] = serde_json::to_value(summaries)?;
        tx.execute("UPDATE entities SET payload=?3,revision=revision+1,updated_at=?4 WHERE workspace_id=?1 AND id=?2",rusqlite::params![workspace_id,run_id,serde_json::to_string(&value)?,now()])?;
        tx.commit()?;
        Ok(revision + 1)
    }
}
#[derive(Default)]
pub struct ScriptRuntime {
    active: Mutex<HashMap<String, Arc<AtomicBool>>>,
}
impl ScriptRuntime {
    pub fn cancel(&self, id: &str) -> ApiResult<()> {
        valid_id(id)?;
        let active = self
            .active
            .lock()
            .map_err(|_| ApiError::new("runtime", "Script worker unavailable."))?;
        if let Some(flag) = active.get(id) {
            flag.store(true, Ordering::Relaxed);
        }
        Ok(())
    }
    pub fn run(&self, input: ScriptInput) -> ApiResult<ScriptResult> {
        valid_id(&input.id)?;
        let encoded = serde_json::to_string(&input.context)?;
        if input.source.len() > 65536 || encoded.len() > 256 * 1024 {
            return Err(ApiError::new(
                "validation",
                "Script limit: 64 KiB source and 256 KiB context.",
            ));
        }
        let cancelled = Arc::new(AtomicBool::new(false));
        {
            let mut active = self
                .active
                .lock()
                .map_err(|_| ApiError::new("runtime", "Script worker unavailable."))?;
            if active.len() >= 4 || active.contains_key(&input.id) {
                return Err(ApiError::new(
                    "busy",
                    "Four scripts are active or this script ID is in use.",
                ));
            }
            active.insert(input.id.clone(), cancelled.clone());
        }
        struct Guard<'a> {
            worker: &'a ScriptRuntime,
            id: String,
        }
        impl Drop for Guard<'_> {
            fn drop(&mut self) {
                if let Ok(mut active) = self.worker.active.lock() {
                    active.remove(&self.id);
                }
            }
        }
        let _guard = Guard {
            worker: self,
            id: input.id,
        };
        let runtime = Runtime::new()
            .map_err(|_| ApiError::new("script", "Could not create script runtime."))?;
        runtime.set_memory_limit(16 * 1024 * 1024);
        runtime.set_max_stack_size(256 * 1024);
        let deadline = Instant::now() + Duration::from_secs(1);
        let flag = cancelled.clone();
        runtime.set_interrupt_handler(Some(Box::new(move || {
            flag.load(Ordering::Relaxed) || Instant::now() >= deadline
        })));
        let context = Context::full(&runtime)
            .map_err(|_| ApiError::new("script", "Could not create script context."))?;
        // Fresh QuickJS context. No file/network/shell/Tauri/Node bindings or
        // module loader. User source is a function parameter, never interpolated.
        let result=context.with(|ctx|->ApiResult<ScriptResult>{
            ctx.globals().set("__input",encoded).map_err(|_|ApiError::new("script","Script input unavailable."))?;
            ctx.globals().set("__source",input.source).map_err(|_|ApiError::new("script","Script source unavailable."))?;
            let output:String=ctx.eval(include_str!("runner.js")).map_err(|_|ApiError::new("script","Script failed, exceeded limits, or used an unsupported API. No exception text is logged."))?;
            if output.len()>1024*1024{return Err(ApiError::new("quota","Script result exceeds 1 MiB."));}
            let result:ScriptResult=serde_json::from_str(&output)?;
            if result.assertions.len()>100||result.logs.len()>32{return Err(ApiError::new("quota","Script output exceeds assertion/log limits."));}
            Ok(result)
        });
        if cancelled.load(Ordering::Relaxed) {
            Err(ApiError::new("cancelled", "Script cancelled."))
        } else if Instant::now() >= deadline {
            Err(ApiError::new(
                "timeout",
                "Script exceeded its one-second deadline.",
            ))
        } else {
            result
        }
    }
}
