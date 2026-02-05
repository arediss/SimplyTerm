//! Plugin API v1
//!
//! This module contains all API endpoints available to plugins.
//! Each submodule corresponds to a functional area with its own permissions.

// These are public APIs for plugins - they may not be used internally
#![allow(unused_imports)]
#![allow(dead_code)]

pub mod events;
pub mod session_metadata;
pub mod sessions;
pub mod settings;
pub mod shell;
pub mod storage;
pub mod vault;
