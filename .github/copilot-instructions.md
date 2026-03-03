# SoulOverlay — Copilot Instructions

SoulOverlay is a Tauri 2 + Vue 3 overlay for Star Citizen on Windows x86_64. It renders a
transparent, always-on-top window over the game showing UEX Corp commodity prices. Data from
the UEX Corp API is cached in a local SQLite database with per-collection TTLs and served
from an in-memory mirror for instant search.

## Shell & Git Rules

- Never use `2>nul` in commands — creates a literal file named `nul`. Use `2>/dev/null`.
- Never run `git commit` or `git push`. The user manages all commits and pushes manually.

## Build & Quality Gates

```powershell
# Frontend type-check (must pass before committing)
npx vue-tsc --noEmit

# Rust type-check (fast, no link step) — run from src-tauri/
cargo check --all-targets --workspace

# Dev server with hot-reload
npm run tauri dev

# Full release build → src-tauri/target/release/bundle/nsis/SoulOverlay_*_setup.exe
npm run tauri build

# Web demo build (browser-only, no Tauri) → dist-web/
npm run build:web
```

No ESLint, Prettier, Vitest, or `#[cfg(test)]` suites exist. Quality is enforced by
`vue-tsc` (`strict: true`, `noUnusedLocals`, `noUnusedParameters`) and `cargo check`.
Fix all type errors. Never use `any` or `@ts-ignore`. Verify manually by running the app.

## Logging

Logs: `%APPDATA%\SoulOverlay\soul-overlay.log` (overwritten each launch) + stderr.
Format: `[timestamp][LEVEL][module] message`. Set `RUST_LOG=debug` for verbose output.

## Project Structure

```
src/                                 # Vue 3 + TypeScript frontend
├── assets/main.css                  # Tailwind directives + global font
├── lib/web/                         # Browser shims (invoke, event, opener) for web demo build
├── components/
│   ├── icons/                       # SVG icon wrappers (template-only, use currentColor)
│   ├── layout/                      # StatusBar, TabBar
│   ├── overlay/                     # SearchBar, SearchResultRow, CommodityPanel, FavoritesPanel, EntityInfoCard
│   ├── panels/                      # SettingsPanel, DebugPanel
│   ├── settings/                    # HotkeyCapture, OpacitySlider, SettingsField, CacheSettingsPanel
│   ├── tabs/                        # SearchTab, InventoryTab, DetailsTab, PlaceholderTab
│   └── ui/                          # AlertBanner, LoadingSpinner, PanelHeader, ToggleSwitch,
│                                    #   ResizeHandle, ContextMenu, KeybindsModal
├── composables/                     # useUex, useCache, useLogWatcher, useOverlayEvents, useHotkeyMatch
├── stores/                          # game.ts, settings.ts, favorites.ts, details.ts (Pinia setup stores)
├── App.vue                          # Root layout, hotkey fallback, ESC handler
└── main.ts
src-tauri/src/                       # Rust backend
├── lib.rs                           # Module declarations + Tauri builder + run()
├── main.rs                          # Entry point — calls lib::run()
├── config.rs                        # AppPaths: centralized path resolution + settings I/O
├── state.rs                         # AppState struct (all Mutex-wrapped fields + AppPaths + UexClient)
├── app_setup.rs                     # .setup() initialization sequence + background prefetch
├── settings.rs                      # Settings struct (pure serde data)
├── activity.rs                      # ActivityLog: tracks API fetch events + last user actions
├── database.rs                      # SQLite connection init, WAL mode, schema migrations
├── cache_store.rs                   # CacheStore: per-collection TTL, in-memory HashMap + SQLite persistence
├── logging.rs                       # fern dual-logger setup (stderr + file, path from config)
├── platform.rs                      # HWND <-> isize helpers (breaks circular deps)
├── window.rs                        # Win32 overlay: WNDPROC subclass, show/hide, geometry
├── game_tracker.rs                  # SC window polling thread, SharedGameState
├── log_watcher.rs                   # game.log tail + regex parse + Tauri event emit
├── uex/                             # UEX Corp API client (typed deserialization from swagger spec)
│   ├── client.rs                    # UexClient struct: shared reqwest::Client, generic get<T>
│   ├── types.rs                     # App types: UexResult, PriceEntry, EntityInfo + serde helpers
│   ├── commodities.rs               # Commodity fetch/search/info/prices
│   ├── vehicles.rs                  # Vehicle fetch/search/info/purchase & rental prices
│   ├── items.rs                     # Item fetch/search/info/prices + category fan-out
│   ├── locations.rs                 # Terminal fetch/search
│   └── fuel.rs                      # Fuel price fetch
├── tray.rs                          # System tray icon + menu
├── commands/                        # All #[tauri::command] functions
│   ├── api.rs                       # api_search, api_commodity_prices + ApiResponse<T> envelope
│   ├── uex.rs                       # uex_search, uex_search_all, uex_prices (legacy)
│   ├── cache.rs                     # cache_status, cache_refresh, cache_refresh_all + prefetch_all
│   ├── settings.rs                  # get_settings, save_settings
│   ├── overlay.rs                   # show_overlay_cmd, hide_overlay_cmd
│   ├── favorites.rs                 # get_favorites, add_favorite, remove_favorite, is_favorite
│   └── debug.rs                     # get_debug_info, get_game_state
└── hotkey/                          # Global keyboard hook
    ├── mod.rs                       # HookHandle, register_hotkey, LL hook callback, atomics
    └── keymap.rs                    # token_to_vk() VK code lookup table
```

## Architecture Overview

The app has two layers that communicate exclusively via Tauri IPC:

**Rust backend** (`src-tauri/src/`): Owns all state. Key modules:
- `lib.rs` — startup sequence, `AppState` construction, `generate_handler!` registration
- `app_setup.rs` — `.setup()` hook, spawns background `prefetch_all` task
- `cache_store.rs` — dual-layer cache: in-memory `HashMap` + SQLite (`rmp-serde` blobs)
- `window.rs` — Win32 WNDPROC subclass; manages show/hide, geometry, transparency
- `hotkey/mod.rs` — `WH_KEYBOARD_LL` global hook; toggles via `PostMessageW(WM_APP+42)`
- `commands/api.rs` — primary IPC surface; returns `ApiResponse<T>` envelope

**Vue frontend** (`src/`): Stateless UI. All data lives in Rust; frontend calls `invoke`.
- Pinia stores (`game.ts`, `settings.ts`) are thin wrappers around `invoke` calls
- Composables (`useUex`, `useCache`, `useOverlayEvents`) handle polling and event listening
- `App.vue` owns the hotkey fallback for when the overlay has focus (Tauri global shortcut
  doesn't fire on the focused window)

**Initialization order** (critical — do not reorder):
1. `AppPaths::init()` — resolves `%APPDATA%\SoulOverlay\`, creates data dir
2. `logging::setup()` — fern to stderr + `soul-overlay.log`
3. `database::init()` — SQLite WAL mode + schema migrations
4. `AppState` construction → `.manage()`
5. `.setup()` → `app_setup::initialize()` → spawns prefetch thread

## IPC Contract

All `commands/api.rs` commands return:
```json
{ "ok": true,  "data": [...], "error": null,  "stale": false }
{ "ok": true,  "data": [...], "error": null,  "stale": true  }
{ "ok": false, "data": null,  "error": "...", "stale": false }
```
`stale: true` means cached data was returned and a background refresh is in progress.

Frontend always uses `invoke<ApiResponse<T>>("command_name")`. Commands are registered
with full module paths in `generate_handler!` — `pub use` re-exports do NOT work there.

## Path Configuration

All application files live under `%APPDATA%\SoulOverlay\`. Path resolution is centralized
in `config.rs` via `AppPaths` — no other module should resolve `APPDATA` or hard-code paths.

| File | Path | Purpose |
|------|------|---------|
| `soul-overlay.log` | `%APPDATA%\SoulOverlay\soul-overlay.log` | App log (overwritten each launch) |
| `soul_overlay.db` | `%APPDATA%\SoulOverlay\soul_overlay.db` | SQLite cache database |
| `settings.json` | `%APPDATA%\SoulOverlay\settings.json` | User settings (plain JSON) |

`AppPaths` provides `load_settings()` and `save_settings()` — no `tauri-plugin-store`.
The SC game log path is resolved separately in `log_watcher::default_log_path()` since it
lives outside the app data directory.

## Settings & Keybinds

`settings.rs` has three sub-structs with `#[serde(default)]`:
- `LayoutWidths` — panel pixel widths / split percentages (persisted on every resize drag)
- `Keybinds` — in-app panel toggle keys (`toggle_settings: "F12"`, `toggle_debug: "F11"`)
- Root fields — `hotkey` (global Rust hook), `font_size`, `overlay_opacity`, etc.

**Two keybind systems**:
1. **Global hook** (`hotkey/mod.rs`) — processes keys even when overlay is hidden, used only
   for the overlay toggle. Stored in `settings.hotkey`. Registered via `register_hotkey`.
2. **In-app keys** (`settings.keybinds.*`) — checked in `App.vue`'s `handleKeyDown` via
   `matchesHotkey(e, settingsStore.settings.keybinds.toggle_settings)`. Only fire while
   the overlay is visible.

`blockBrowserShortcuts` (capture-phase listener in `App.vue`) always `preventDefault` for
F3/F5/F11/F12 regardless of configured keybind, to prevent browser fullscreen/devtools.

## Cache / Database Architecture

**Storage stack**: SQLite (`rusqlite` with `bundled` feature) for persistence, in-memory
`HashMap<String, MemoryEntry>` for instant reads. Data is serialized to MessagePack
(`rmp-serde`) blobs in the `cache_entries` table. Schema migrations via `rusqlite_migration`.

`CacheStore` lives on `AppState.cache` (not behind a `Mutex` — manages its own internal
locks). Key methods: `put<T>`, `get<T> → Fresh|Stale|Missing`, `invalidate*`, `status`.

| Collection | TTL | Key pattern | Prefetched |
|------------|-----|-------------|------------|
| `Commodities` | 10 min | `commodities` | Yes |
| `CommodityPrices` | 10 min | `commodity_prices:{id}` | No |
| `Vehicles` | 24 h | `vehicles` | Yes |
| `Items` | 24 h | `items` | Yes |
| `Locations` | 24 h | `locations` | Yes |

**Favorites** bypass `CacheStore` entirely — plain SQLite table in `commands/favorites.rs`,
keyed by `(id, kind)`. No TTL.

## Z-index Layering

| Layer | z-index | Element |
|-------|---------|---------|
| Main content | (flow) | Tabs, panels |
| Floating modals (e.g. `KeybindsModal`) | 40 | `Teleport to="body"`, fixed inset backdrop |
| Settings side panel wrapper | 50 | `class="relative z-50"` in App.vue |

New floating modals: use `Teleport to="body"` at z-40. Close via `@mousedown.self` on backdrop.

## ESC Key Hierarchy

All ESC handling flows through `App.vue → handleKeyDown`:
1. Delegate to `searchTabRef.handleEsc()` on the Search tab:
   - Row selected → deselect row
   - Input not focused → focus input (without clearing)
   - Input focused + query → clear query
   - Returns `false` → fall through
2. If `settings.esc_closes_overlay`: call `hide_overlay_cmd`

ESC does **not** close the Settings or Debug panels — toggled only via their keybinds or
close buttons.

## Key Constraints — Do Not Violate

- Do NOT use `WS_EX_TRANSPARENT` — makes window click-through, breaks interaction
- Do NOT use `WS_EX_NOACTIVATE` while overlay is visible — prevents keyboard input
- Do NOT use `x86_64-pc-windows-gnu` (MinGW) — incompatible with the `windows` crate
- Do NOT import `tauri::WebviewWindowExt` — `.hwnd()` is inherent in Tauri 2
- Do NOT apply CSS `opacity` to the root overlay div — only to the background layer
- Do NOT call blocking operations inside `WH_KEYBOARD_LL` callbacks
- Do NOT use `any`, `@ts-ignore`, `reactive()`, or `computed()` in the frontend

## TypeScript / Vue Style

**Import order** (all `.vue` and `.ts` files):
1. Vue core (`ref`, `watch`, `onMounted`, ...)
2. Tauri APIs (`@tauri-apps/api/core`, `@tauri-apps/api/event`)
3. Local components
4. Stores (`@/stores/...`)
5. Composables (`@/composables/...`)
6. Type-only imports (`import type { Foo } from "..."`) last

Use `@/` alias everywhere except `App.vue` (relative paths).

**Components**: Always `<script setup lang="ts">`. No Options API, no `defineComponent`.
Props via `defineProps<{ prop: Type }>()`. Emits via `defineEmits<{ (e: "name"): void }>()`.
Reactive state: `ref()` only — no `reactive()`. Derive values via `watch` or inline; no `computed()`.

**Naming**: Components `PascalCase.vue` | Composables `useCamelCase` | Stores `useXxxStore`
(ID = filename) | Tauri events `kebab-case` | Tauri commands `snake_case` | Props `camelCase`

**Types**: `interface` for object shapes. Always `import type` for type-only imports.
Always `invoke<ReturnType>()`. Nullable: `T | null` (not `undefined`).
Timer handles: `ReturnType<typeof setTimeout>`.

**Error handling**:
```ts
const loading = ref(false);
const error = ref<string | null>(null);
async function doSomething() {
  loading.value = true;
  error.value = null;
  try {
    const result = await invoke<MyType>("command");
  } catch (e) {
    error.value = String(e);
    console.error("context:", e);
  } finally {
    loading.value = false;
  }
}
```
Re-throw in store actions when the caller also needs to handle. Clean up `listen()` handles
in `onUnmounted`. Use `e.code` (not `e.key`) for keybind capture (locale-independent).

**Tailwind**: Utility-first only (no `@apply`). Opacity via modifiers (`bg-black/60`).
Palette: white+opacity for text/borders, gray-900 for panels, blue-500/600 actions,
green-400 success, red-400 errors, yellow-400 warnings.

**Pinia — two store archetypes**:
- **Backend-backed** (`settings.ts`, `favorites.ts`, `game.ts`): all mutations go through `invoke`.
  No `$patch`, no Options mutations. Export interfaces from store files.
- **UI-coordination** (`details.ts`): pure in-memory, no `invoke`. Holds the currently viewed
  entity and a `requestTabSwitch: ref<boolean>` flag that `App.vue` watches to switch tabs
  programmatically. Consumers call `clearTabSwitchRequest()` after handling the flag.

## Rust Conventions

**Naming**: Structs `PascalCase` | functions/fields `snake_case` | constants `SCREAMING_SNAKE`.
Tauri commands: `snake_case` matching the JS `invoke` string. Unused params: `_name` prefix.

**Error handling**: Commands return `Result<T, String>`. Convert with `.map_err(|e| format!(...))`.
Discard acceptable failures: `let _ = expr;`. `.unwrap()` only on `Mutex::lock()`.
`try_lock()` inside LL hook callbacks — never block in a hook.

**Platform**: Windows-only (x86_64-pc-windows-msvc). No `#[cfg(windows)]` guards or
non-Windows stubs — Win32 APIs are called directly without conditional compilation.

**Thread safety**: Store `HWND` as `isize` for `Send + Sync`. Document `unsafe impl`
with `// SAFETY:`. Use `Arc<Mutex<T>>` for shared state, `Arc<AtomicBool>` for flags.
Drop `MutexGuard` explicitly before calling code that may lock. Use `PostMessageW` from
hook callbacks — `run_on_main_thread` can deadlock when the overlay is focused.

**Commands module**: `tauri::generate_handler!` requires full paths (e.g.,
`commands::uex::uex_search`). `pub use` re-exports do NOT carry the hidden `__cmd__` items.

**Tauri IPC**: Events via `app.emit("kebab-name", json!({...}))`.

## Web Demo Branch (`web-demo`)

The `web-demo` branch adds a browser-only build of the overlay that runs without the Rust
backend. All UEX data is fetched at build time and served as static JSON — no runtime API
calls. It is always rebased on top of `main` (or release branches) and deployed to a
Linux VPS via Docker.

### Branch Strategy

- Never merge `web-demo` into `main`. Rebase it on top of `main` after main changes.
- Web-demo-only files: `Dockerfile`, `docker-compose.yml`, `nginx/`, `.env.example`,
  `vite.web.config.ts`, `src/lib/web/`, `scripts/fetch-uex-data.mjs`.
- The Vue frontend code in `src/` is shared — changes on `main` flow into `web-demo`
  via rebase. The shim layer makes them work without Tauri.

### Static Data Architecture

A build-time script (`scripts/fetch-uex-data.mjs`) fetches all UEX Corp data, transforms
DTOs to app types, and writes pre-transformed JSON to `public/data/` (gitignored).

| File | Content | Loaded |
|---|---|---|
| `catalogs.json` | Search results per entity type | On first search |
| `entity-info.json` | EntityInfo maps keyed by ID | On detail view |
| `commodity-prices.json` | `Record<id, PriceEntry[]>` | Lazily per price type |
| `raw-commodity-prices.json` | `Record<id, PriceEntry[]>` | Lazily |
| `item-prices.json` | `Record<id, PriceEntry[]>` | Lazily |
| `vehicle-purchase-prices.json` | `Record<id, PriceEntry[]>` | Lazily |
| `vehicle-rental-prices.json` | `Record<id, PriceEntry[]>` | Lazily |
| `fuel-prices.json` | `Record<terminal_id, PriceEntry[]>` | Lazily |

### Shim Layer

`vite.web.config.ts` aliases Tauri imports to browser shims at build time:

| Tauri import | Shim | Strategy |
|---|---|---|
| `@tauri-apps/api/core` | `src/lib/web/invoke.ts` | Loads static JSON, localStorage for settings/favorites |
| `@tauri-apps/api/event` | `src/lib/web/event.ts` | No-op `listen()` / `emit()` |
| `@tauri-apps/plugin-opener` | `src/lib/web/opener.ts` | Delegates to `window.open()` |

`invoke.ts` handles every frontend `invoke()` call — search looks up `catalogs.json`,
prices look up the corresponding price JSON, entity info from `entity-info.json`.
Settings and favorites persist in `localStorage`. Game/overlay/cache commands are no-ops.

When adding a new Tauri command on `main`, `invoke.ts` needs a matching `case` after
rebase — the `default` case logs a warning but returns `undefined`.

### Build & Deploy

```bash
# Fetch all UEX data (requires UEX_API_KEY env var)
UEX_API_KEY=xxx npm run fetch:data

# Build the web demo (type-check + Vite build)
npm run build:web

# Docker build & run (fetches data + builds in one step)
cp .env.example .env          # set UEX_API_KEY
docker compose up -d --build  # nginx on port 1420
```

**Docker stack**: two-stage Dockerfile — `node:20-alpine` runs `fetch:data` then
`build:web`, then `nginx:1.27-alpine` serves `dist-web/` as a pure static file server.
API key is a build arg only — not present at runtime.

### Key Constraints — Web Demo

- Do NOT import from `@tauri-apps/*` in `src/lib/web/` — those files *are* the shims
- DTO transformations live in `scripts/fetch-uex-data.mjs` — keep in sync with Rust
  structs in `src-tauri/src/uex/` and app types in `invoke.ts`
- `public/data/` is gitignored — generated by `npm run fetch:data`, bundled into Docker image
