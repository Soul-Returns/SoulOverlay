/**
 * Web demo shim: replaces @tauri-apps/api/core.
 *
 * All UEX data is pre-fetched at build time and served as static JSON files
 * from public/data/.  This shim loads them lazily and returns the same shapes
 * the Rust backend would.  Settings and favorites are persisted in
 * localStorage.  Game / overlay / hotkey commands are no-ops.
 */

// ── App types (must match src/composables/useUex.ts) ──────────────────────

interface UexResult {
  id: string;
  name: string;
  kind: string;
  slug: string;
  uuid: string;
}

interface PriceEntry {
  entity_id: string;
  entity_name: string;
  price_type: string;
  location: string;
  terminal: string;
  terminal_id: string;
  buy_price: number;
  sell_price: number;
  rent_price: number;
  scu_available: number | null;
  date_updated: string;
  orbit: string;
  system: string;
  faction: string;
  scu_last: number;
  scu_users: number;
  scu_avg: number;
  scu_min: number;
  scu_max: number;
  price_last: number;
  price_users: number;
  price_avg: number;
  price_min: number;
  price_max: number;
  inventory_status: number;
  inventory_status_avg: number;
  container_sizes: string;
  is_buy_location: boolean;
}

interface EntityInfo {
  id: string;
  name: string;
  kind: string;
  slug: string;
  code: string | null;
  company_name: string | null;
  wiki: string | null;
  game_version: string | null;
  commodity_kind: string | null;
  weight_scu: number | null;
  avg_buy: number | null;
  avg_sell: number | null;
  is_illegal: boolean | null;
  is_buyable: boolean | null;
  is_sellable: boolean | null;
  is_mineral: boolean | null;
  is_raw: boolean | null;
  is_refined: boolean | null;
  is_harvestable: boolean | null;
  section: string | null;
  category: string | null;
  size: string | null;
  color: string | null;
  name_full: string | null;
  scu: number | null;
  crew: string | null;
  length: number | null;
  width: number | null;
  height: number | null;
  mass: number | null;
  pad_type: string | null;
  url_photo: string | null;
  url_store: string | null;
  roles: string[];
}

interface ApiResponse<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
  stale: boolean;
  total: number | null;
}

// ── Settings (must match src/stores/settings.ts) ──────────────────────────

interface LayoutWidths {
  left_panel_px: number;
  settings_panel_px: number;
  search_split_pct: number;
  search_solo_pct: number;
}

interface Settings {
  hotkey: string;
  uex_api_key: string;
  log_path: string | null;
  overlay_opacity: number;
  esc_closes_overlay: boolean;
  reset_on_open: boolean;
  max_search_results: number;
  cache_ttl_prices_secs: number;
  cache_ttl_catalog_secs: number;
  layout_widths: LayoutWidths;
  font_size: number;
  keybinds: { toggle_settings: string; toggle_debug: string };
}

const DEFAULT_SETTINGS: Settings = {
  hotkey: "Alt+Shift+S",
  uex_api_key: "",
  log_path: null,
  overlay_opacity: 0.85,
  esc_closes_overlay: false,
  reset_on_open: true,
  max_search_results: 50,
  cache_ttl_prices_secs: 3600,
  cache_ttl_catalog_secs: 86400,
  layout_widths: {
    left_panel_px: 280,
    settings_panel_px: 448,
    search_split_pct: 50,
    search_solo_pct: 50,
  },
  font_size: 14,
  keybinds: { toggle_settings: "F12", toggle_debug: "F11" },
};

// ── Favorites (must match src/stores/favorites.ts) ────────────────────────

interface Favorite {
  id: string;
  name: string;
  kind: string;
  slug: string;
  uuid: string;
  added_at: string;
}

// ── Static data loaders ────────────────────────────────────────────────────

interface Catalogs {
  commodities: UexResult[];
  vehicles: UexResult[];
  items: UexResult[];
  locations: UexResult[];
}

interface EntityInfoMap {
  commodity: Record<string, EntityInfo>;
  vehicle: Record<string, EntityInfo>;
  "ground vehicle": Record<string, EntityInfo>;
  item: Record<string, EntityInfo>;
}

const cache: Record<string, unknown> = {};

async function loadJson<T>(filename: string): Promise<T> {
  if (cache[filename]) return cache[filename] as T;
  const resp = await fetch(`/data/${filename}`);
  if (!resp.ok) throw new Error(`Failed to load /data/${filename}: ${resp.status}`);
  const data = await resp.json() as T;
  cache[filename] = data;
  return data;
}

async function getCatalogs(): Promise<Catalogs> {
  return loadJson<Catalogs>("catalogs.json");
}

async function getEntityInfoMap(): Promise<EntityInfoMap> {
  return loadJson<EntityInfoMap>("entity-info.json");
}

async function getPriceMap(filename: string): Promise<Record<string, PriceEntry[]>> {
  return loadJson<Record<string, PriceEntry[]>>(filename);
}

function searchIn(items: UexResult[], query: string): UexResult[] {
  const q = query.toLowerCase();
  return items.filter((r) => r.name.toLowerCase().includes(q));
}

// ── localStorage helpers ───────────────────────────────────────────────────

const LS_SETTINGS = "soul_overlay_settings";
const LS_FAVORITES = "soul_overlay_favorites";

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(LS_SETTINGS);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettingsToStorage(s: Settings): void {
  localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
}

function loadFavorites(): Favorite[] {
  try {
    const raw = localStorage.getItem(LS_FAVORITES);
    if (raw) return JSON.parse(raw) as Favorite[];
  } catch {
    /* ignore */
  }
  return [];
}

function saveFavorites(favs: Favorite[]): void {
  localStorage.setItem(LS_FAVORITES, JSON.stringify(favs));
}

// ── ApiResponse constructors ───────────────────────────────────────────────

function apiOk<T>(data: T, total?: number): ApiResponse<T> {
  return { ok: true, data, error: null, stale: false, total: total ?? null };
}

function apiErr<T>(msg: string): ApiResponse<T> {
  return { ok: false, data: null, error: msg, stale: false, total: null };
}

// ── Public invoke() ────────────────────────────────────────────────────────

export async function invoke<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  switch (cmd) {
    // ── Search ───────────────────────────────────────────────────────────
    case "api_search": {
      const query = args.query as string;
      if (!query.trim()) return apiOk<UexResult[]>([], 0) as unknown as T;
      const maxResults = loadSettings().max_search_results;
      const catalogs = await getCatalogs();
      const all = [
        ...searchIn(catalogs.commodities, query),
        ...searchIn(catalogs.vehicles, query),
        ...searchIn(catalogs.items, query),
        ...searchIn(catalogs.locations, query),
      ];
      return apiOk(all.slice(0, maxResults), all.length) as unknown as T;
    }

    case "api_search_commodities": {
      const query = args.query as string;
      if (!query.trim()) return apiOk<UexResult[]>([]) as unknown as T;
      return apiOk(searchIn((await getCatalogs()).commodities, query)) as unknown as T;
    }

    case "api_search_vehicles": {
      const query = args.query as string;
      if (!query.trim()) return apiOk<UexResult[]>([]) as unknown as T;
      return apiOk(searchIn((await getCatalogs()).vehicles, query)) as unknown as T;
    }

    case "api_search_items": {
      const query = args.query as string;
      if (!query.trim()) return apiOk<UexResult[]>([]) as unknown as T;
      return apiOk(searchIn((await getCatalogs()).items, query)) as unknown as T;
    }

    case "api_search_locations": {
      const query = args.query as string;
      if (!query.trim()) return apiOk<UexResult[]>([]) as unknown as T;
      return apiOk(searchIn((await getCatalogs()).locations, query)) as unknown as T;
    }

    // ── Prices ───────────────────────────────────────────────────────────
    case "api_commodity_prices": {
      const id = args.commodityId as string;
      const map = await getPriceMap("commodity-prices.json");
      return apiOk(map[id] ?? []) as unknown as T;
    }

    case "api_raw_commodity_prices": {
      const id = args.commodityId as string;
      const map = await getPriceMap("raw-commodity-prices.json");
      return apiOk(map[id] ?? []) as unknown as T;
    }

    case "api_item_prices": {
      const id = args.itemId as string;
      const map = await getPriceMap("item-prices.json");
      return apiOk(map[id] ?? []) as unknown as T;
    }

    case "api_vehicle_purchase_prices": {
      const id = args.vehicleId as string;
      const map = await getPriceMap("vehicle-purchase-prices.json");
      return apiOk(map[id] ?? []) as unknown as T;
    }

    case "api_vehicle_rental_prices": {
      const id = args.vehicleId as string;
      const map = await getPriceMap("vehicle-rental-prices.json");
      return apiOk(map[id] ?? []) as unknown as T;
    }

    case "api_fuel_prices": {
      const id = args.terminalId as string;
      const map = await getPriceMap("fuel-prices.json");
      return apiOk(map[id] ?? []) as unknown as T;
    }

    // ── Entity info ──────────────────────────────────────────────────────
    case "api_entity_info": {
      const kind = args.kind as string;
      const entityId = args.entityId as string;
      try {
        const infoMap = await getEntityInfoMap();
        const bucket = infoMap[kind as keyof EntityInfoMap];
        if (!bucket) return apiErr<EntityInfo>(`Entity info not supported for kind: ${kind}`) as unknown as T;
        const info = bucket[entityId];
        if (!info) return apiErr<EntityInfo>(`${kind} ${entityId} not found`) as unknown as T;
        return apiOk(info) as unknown as T;
      } catch (e) {
        return apiErr<EntityInfo>(String(e)) as unknown as T;
      }
    }

    // ── Settings ─────────────────────────────────────────────────────────
    case "get_settings":
      return loadSettings() as unknown as T;

    case "save_settings": {
      saveSettingsToStorage(args.newSettings as Settings);
      return undefined as unknown as T;
    }

    // ── Favorites ────────────────────────────────────────────────────────
    case "get_favorites":
      return loadFavorites() as unknown as T;

    case "add_favorite": {
      const { id, name, kind, slug, uuid } = args as {
        id: string;
        name: string;
        kind: string;
        slug: string;
        uuid: string;
      };
      const favs = loadFavorites().filter((f) => !(f.id === id && f.kind === kind));
      favs.push({ id, name, kind, slug, uuid, added_at: new Date().toISOString() });
      saveFavorites(favs);
      return undefined as unknown as T;
    }

    case "remove_favorite": {
      const { id, kind } = args as { id: string; kind: string };
      saveFavorites(loadFavorites().filter((f) => !(f.id === id && f.kind === kind)));
      return undefined as unknown as T;
    }

    case "is_favorite": {
      const { id, kind } = args as { id: string; kind: string };
      return loadFavorites().some((f) => f.id === id && f.kind === kind) as unknown as T;
    }

    // ── Game / overlay (no-ops in browser) ───────────────────────────────
    case "get_game_state":
      return { sc_detected: false } as unknown as T;

    case "hide_overlay_cmd":
    case "show_overlay_cmd":
      return undefined as unknown as T;

    // ── Cache (no-ops in browser) ─────────────────────────────────────────
    case "cache_status":
      return [] as unknown as T;

    case "cache_refresh":
      return { ok: true, collection: String(args.collection ?? ""), error: null } as unknown as T;

    case "cache_refresh_all":
      return [] as unknown as T;

    case "cache_refresh_expired":
      return undefined as unknown as T;

    // ── Debug info ────────────────────────────────────────────────────────
    case "get_debug_info": {
      const s = loadSettings();
      return {
        sc_detected: false,
        sc_focused: false,
        sc_hwnd: null,
        sc_window_x: 0,
        sc_window_y: 0,
        sc_window_w: 0,
        sc_window_h: 0,
        hotkey: s.hotkey,
        log_path: null,
        overlay_opacity: s.overlay_opacity,
        uex_api_key_set: false,
        esc_closes_overlay: s.esc_closes_overlay,
        reset_on_open: s.reset_on_open,
        max_search_results: s.max_search_results,
        cache_ttl_prices_secs: s.cache_ttl_prices_secs,
        cache_ttl_catalog_secs: s.cache_ttl_catalog_secs,
        log_watcher_active: false,
        hotkey_registered: false,
        refreshing_collections: [],
        cache_total_keys: Object.keys(cache).length,
        cache_collections: [],
        last_bg_check_at: null,
        next_bg_check_in_secs: 30,
        last_bg_check_ago_secs: null,
        last_user_action: null,
        fetch_log: [],
      } as unknown as T;
    }

    default:
      console.warn(`[web-shim] unhandled invoke: ${cmd}`, args);
      return undefined as unknown as T;
  }
}
