use super::*;
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EnvironmentInput {
    pub workspace_id: String,
    pub id: String,
    pub name: String,
    pub expected_revision: i64,
    pub variables: Vec<EnvironmentVariable>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EnvironmentVariable {
    pub key: String,
    pub value: String,
    pub secret: bool,
}
impl Drop for EnvironmentVariable {
    fn drop(&mut self) {
        if self.secret {
            unsafe {
                self.value.as_bytes_mut().fill(0);
            }
        }
    }
}
fn secret_id(environment: &str, key: &str) -> String {
    uuid::Uuid::new_v5(
        &uuid::Uuid::NAMESPACE_URL,
        format!("traffic-studio:environment:{environment}:{key}").as_bytes(),
    )
    .to_string()
}
impl Database {
    pub fn environment_save(&self, input: EnvironmentInput) -> ApiResult<Entity> {
        valid_id(&input.id)?;
        valid_name(&input.name)?;
        if input.expected_revision < 0 || input.variables.len() > 1000 {
            return Err(ApiError::new(
                "validation",
                "Invalid environment revision or more than1000 variables.",
            ));
        }
        let mut keys = std::collections::HashSet::new();
        let mut records = Vec::new();
        let mut secrets = Vec::new();
        let mut size = 0usize;
        for variable in &input.variables {
            let key = variable.key.trim();
            size += variable.key.len() + variable.value.len();
            if key.is_empty()
                || key.len() > 180
                || variable.value.len() > 65536
                || !keys.insert(key.to_string())
                || size > 1024 * 1024
            {
                return Err(ApiError::new("validation","Variable keys must be unique/nonempty (180 bytes); values max64 KiB; environment max1 MiB."));
            }
            if variable.secret {
                let id = secret_id(&input.id, key);
                let present = !variable.value.is_empty();
                if present {
                    secrets.push((
                        id.clone(),
                        crate::platform::secrets::protect_bytes(
                            variable.value.as_bytes(),
                            &input.workspace_id,
                        )?,
                    ));
                }
                records.push(serde_json::json!({"key":key,"value":"","secret":true,"secretId":if present{Some(id)}else{None}}));
            } else {
                records.push(serde_json::json!({"key":key,"value":variable.value,"secret":false}));
            }
        }
        let mut connection = self.lock()?;
        Self::require_workspace(&connection, &input.workspace_id)?;
        let tx = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let previous: Option<(i64, String, String)> = tx
            .query_row(
                "SELECT revision,kind,payload FROM entities WHERE workspace_id=?1 AND id=?2",
                params![input.workspace_id, input.id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .optional()?;
        if previous.as_ref().map(|value| value.0).unwrap_or(0) != input.expected_revision
            || previous
                .as_ref()
                .is_some_and(|value| value.1 != "environment")
        {
            return Err(ApiError::new(
                "conflict",
                "Native environment changed. Reload before saving.",
            ));
        }
        if let Some((_, _, payload)) = &previous {
            let value: Value = serde_json::from_str(payload)?;
            if let Some(variables) = value["variables"].as_array() {
                for variable in variables {
                    if let (Some(id), Some(key)) =
                        (variable["secretId"].as_str(), variable["key"].as_str())
                    {
                        if id == secret_id(&input.id, key) {
                            tx.execute(
                                "DELETE FROM secrets WHERE workspace_id=?1 AND id=?2",
                                params![input.workspace_id, id],
                            )?;
                        }
                    }
                }
            }
        }
        for (id, protected) in secrets {
            tx.execute("INSERT INTO secrets(workspace_id,id,protected,updated_at) VALUES(?1,?2,?3,?4) ON CONFLICT(workspace_id,id) DO UPDATE SET protected=excluded.protected,updated_at=excluded.updated_at",params![input.workspace_id,id,protected,now()])?;
        }
        let revision = input.expected_revision + 1;
        let updated_at = now();
        let payload = serde_json::json!({"variables":records});
        tx.execute("INSERT INTO entities(workspace_id,id,kind,name,schema_version,revision,payload,updated_at) VALUES(?1,?2,'environment',?3,1,?4,?5,?6) ON CONFLICT(workspace_id,id) DO UPDATE SET name=excluded.name,revision=excluded.revision,payload=excluded.payload,updated_at=excluded.updated_at",params![input.workspace_id,input.id,input.name.trim(),revision,serde_json::to_string(&payload)?,updated_at])?;
        tx.commit()?;
        Ok(Entity {
            workspace_id: input.workspace_id,
            id: input.id,
            kind: "environment".into(),
            name: input.name.trim().into(),
            schema_version: SCHEMA_VERSION,
            revision,
            payload,
            updated_at,
        })
    }
    pub fn environment_load(&self, workspace_id: &str, id: &str) -> ApiResult<Entity> {
        valid_id(id)?;
        let mut connection = self.lock()?;
        Self::require_workspace(&connection, workspace_id)?;
        let tx = connection.transaction()?;
        let mut entity=tx.query_row("SELECT workspace_id,id,kind,name,schema_version,revision,payload,updated_at FROM entities WHERE workspace_id=?1 AND id=?2",params![workspace_id,id],Self::parse_entity)?;
        if entity.kind != "environment" {
            return Err(ApiError::new("validation", "Expected native environment."));
        }
        if let Some(variables) = entity.payload["variables"].as_array_mut() {
            for variable in variables {
                if variable["secret"] == true {
                    if let (Some(reference), Some(key)) =
                        (variable["secretId"].as_str(), variable["key"].as_str())
                    {
                        if reference != secret_id(id, key) {
                            return Err(ApiError::new(
                                "validation",
                                "Environment secret reference does not belong to this variable.",
                            ));
                        }
                        let encrypted: Vec<u8> = tx.query_row(
                            "SELECT protected FROM secrets WHERE workspace_id=?1 AND id=?2",
                            params![workspace_id, reference],
                            |row| row.get(0),
                        )?;
                        let plain = String::from_utf8(crate::platform::secrets::unprotect_bytes(
                            &encrypted,
                            workspace_id,
                        )?)
                        .map_err(|_| {
                            ApiError::new("storage", "Environment secret cannot be decoded.")
                        })?;
                        variable["value"] = Value::String(plain);
                    }
                }
            }
        }
        tx.commit()?;
        Ok(entity)
    }
}
