use chrono::Local;
use serde::Deserialize;

use crate::ai::guide;

use super::date_utils::resolve_date_expression;

#[derive(Debug, Deserialize)]
struct ToolGetGuideArgs {
    module: String,
}

#[derive(Debug, Deserialize)]
struct ToolResolveDateArgs {
    expression: String,
}

pub fn execute_get_guide(arguments: &str) -> Result<String, String> {
    let args: ToolGetGuideArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("get_guide 参数解析失败: {}", e))?;

    guide::get_guide(&args.module)
}

pub fn execute_resolve_date(arguments: &str) -> Result<String, String> {
    let args: ToolResolveDateArgs = serde_json::from_str(arguments)
        .map_err(|e| format!("resolve_date 参数解析失败: {}", e))?;
    let today = Local::now().date_naive();
    match resolve_date_expression(&args.expression, today) {
        Ok((result, explanation)) => {
            Ok(format!("{}\n日期: {}", explanation, result))
        }
        Err(e) => Err(e),
    }
}
