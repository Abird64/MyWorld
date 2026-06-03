mod ai;
mod db;
mod commands;
mod sync;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use std::sync::Arc;
    use tauri::Manager;

    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // 初始化数据库
            let (db_state, app_data_state) = db::connection::init_db(app.handle())?;
            app.manage(db_state);
            app.manage(app_data_state);

            // 初始化同步状态
            app.manage(sync::sync_engine::SyncState::new());

            // 初始化 LAN 同步状态
            let lan_server_state = Arc::new(sync::lan_server::LanServerState::new());
            app.manage(lan_server_state);
            let lan_discovery = Arc::new(
                sync::lan_discovery::LanDiscovery::new()
                    .unwrap_or_else(|e| {
                        log::warn!("mDNS 初始化失败: {}", e);
                        // 返回一个不会被使用的实例（实际应 panic 或降级处理）
                        panic!("mDNS 初始化失败: {}", e);
                    }),
            );
            app.manage(lan_discovery);

            // 启动后台同步任务
            sync::sync_engine::spawn_background_sync(app.handle().clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::task_commands::create_task,
            commands::task_commands::get_task,
            commands::task_commands::list_tasks,
            commands::task_commands::update_task,
            commands::task_commands::delete_task,
            commands::task_commands::complete_task,
            commands::task_commands::uncomplete_task,
            commands::task_commands::search_tasks,
            commands::skill_commands::list_skills,
            commands::skill_commands::get_task_skills,
            commands::skill_commands::set_task_skills,
            commands::skill_commands::get_skill_activity,
            commands::skill_commands::get_xp_sources,
            commands::journal_commands::get_journal_by_date,
            commands::journal_commands::save_journal,
            commands::journal_commands::get_timeline,
            commands::journal_commands::get_journal_count,
            commands::journal_commands::get_ai_diary,
            commands::journal_commands::save_ai_diary,
            commands::journal_commands::complete_diary,
            commands::journal_commands::daily_reflection,
            commands::contact_commands::create_contact,
            commands::contact_commands::get_contact,
            commands::contact_commands::list_contacts,
            commands::contact_commands::update_contact,
            commands::contact_commands::delete_contact,
            commands::contact_commands::search_contacts,
            commands::contact_commands::list_upcoming_birthdays,
            commands::contact_commands::list_all_birthdays,
            commands::schedule_commands::create_schedule,
            commands::schedule_commands::get_schedule,
            commands::schedule_commands::list_schedules_in_range,
            commands::schedule_commands::update_schedule,
            commands::schedule_commands::delete_schedule,
            commands::schedule_commands::list_countdowns,
            commands::schedule_commands::add_exdate,
            commands::schedule_commands::import_ics_events,
            commands::schedule_commands::export_ics_events,
            commands::config_commands::get_setting,
            commands::config_commands::set_setting,
            commands::config_commands::list_settings,
            commands::config_commands::delete_setting,
            commands::config_commands::clear_data,
            commands::ai_commands::create_conversation,
            commands::ai_commands::list_conversations,
            commands::ai_commands::delete_conversation,
            commands::ai_commands::rename_conversation,
            commands::ai_commands::list_messages,
            commands::ai_commands::send_message,
            commands::ai_commands::execute_tool_calls,
            commands::ai_commands::execute_single_tool_call,
            commands::ai_commands::finalize_tool_calls,
            commands::ai_commands::cancel_tool_calls,
            commands::ai_commands::modify_tool_calls,
            commands::calendar_commands::list_calendars,
            commands::calendar_commands::create_calendar,
            commands::calendar_commands::update_calendar,
            commands::calendar_commands::delete_calendar,
            commands::calendar_commands::get_default_calendar,
            commands::favorite_commands::add_favorite,
            commands::favorite_commands::list_favorites,
            commands::favorite_commands::delete_favorite,
            commands::favorite_commands::delete_favorite_by_message_id,
            commands::favorite_commands::delete_all_favorites,
            commands::memory_commands::list_memories,
            commands::memory_commands::delete_memory,
            commands::habit_commands::create_habit,
            commands::habit_commands::update_habit,
            commands::habit_commands::delete_habit,
            commands::habit_commands::list_habits,
            commands::habit_commands::check_habit,
            commands::habit_commands::uncheck_habit,
            commands::habit_commands::get_records,
            commands::habit_commands::get_streak,
            commands::habit_commands::get_all_streaks,
            commands::habit_commands::get_week_matrix,
            commands::sync_commands::sync_test_connection,
            commands::sync_commands::sync_set_enabled,
            commands::sync_commands::sync_now,
            commands::sync_commands::sync_get_status,
            commands::sync_commands::lan_start_server,
            commands::sync_commands::lan_stop_server,
            commands::sync_commands::lan_discover_peers,
            commands::sync_commands::lan_connect_manual,
            commands::sync_commands::lan_get_local_ip,
            commands::sync_commands::lan_test_peer,
            commands::pomodoro_commands::start_pomodoro,
            commands::pomodoro_commands::complete_pomodoro,
            commands::pomodoro_commands::cancel_pomodoro,
            commands::pomodoro_commands::get_active_pomodoro,
            commands::pomodoro_commands::get_pomodoro_stats,
            commands::wish_commands::list_wishes,
            commands::wish_commands::get_wish,
            commands::wish_commands::create_wish,
            commands::wish_commands::update_wish,
            commands::wish_commands::delete_wish,
            commands::wish_commands::mark_wish_achieved,
            commands::wish_commands::get_glow_balance,
            commands::wish_commands::add_glow,
            commands::wish_commands::add_tickets,
            commands::wish_commands::buy_tickets,
            commands::wish_commands::get_pity_progress,
            commands::wish_commands::list_draws,
            commands::wish_commands::draw_wish,
            commands::wish_commands::redeem_wish,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
