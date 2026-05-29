mod ai;
mod db;
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
            commands::journal_commands::get_journal_by_date,
            commands::journal_commands::save_journal,
            commands::journal_commands::get_timeline,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
