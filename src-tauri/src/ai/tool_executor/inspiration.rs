use crate::commands::inspiration_commands;

/// 执行 parse_video 工具：获取 B 站视频字幕
///
/// `sessdata` 是 B 站登录 cookie，传入后可获取 AI 生成的字幕
pub async fn execute_parse_video(arguments: &str, sessdata: Option<String>) -> Result<String, String> {
    let args: serde_json::Value = serde_json::from_str(arguments)
        .map_err(|e| format!("参数解析失败: {}", e))?;

    let url = args["url"].as_str()
        .ok_or("缺少 url 参数")?;

    // 获取视频信息
    let video_info = inspiration_commands::fetch_bilibili_video_info(url.to_string(), sessdata).await?;

    // 获取字幕
    let subtitle_text = if !video_info.subtitles.is_empty() {
        // 优先选中文字幕
        let zh_sub = video_info.subtitles.iter()
            .find(|s| s.lang.contains("中") || s.lang.contains("zh"));
        let sub = zh_sub.unwrap_or(&video_info.subtitles[0]);
        let subtitle = inspiration_commands::fetch_bilibili_subtitle(sub.url.clone()).await?;
        subtitle.full_text
    } else {
        // 没有字幕，用标题+简介
        format!("视频标题：{}\n视频简介：{}", video_info.title, video_info.desc)
    };

    // 构建返回结果
    let result = serde_json::json!({
        "title": video_info.title,
        "author": video_info.author,
        "duration": video_info.duration,
        "view": video_info.view,
        "has_subtitle": !video_info.subtitles.is_empty(),
        "subtitle_text": subtitle_text,
    });

    serde_json::to_string_pretty(&result)
        .map_err(|e| format!("序列化结果失败: {}", e))
}
