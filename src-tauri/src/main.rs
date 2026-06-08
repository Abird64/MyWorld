// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(feature = "gui")]
fn main() {
  lantern_lib::run();
}

#[cfg(not(feature = "gui"))]
fn main() {}
