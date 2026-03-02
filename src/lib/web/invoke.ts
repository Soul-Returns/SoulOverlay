/**
 * Web demo shim: replaces @tauri-apps/api/core.
 *
 * Routes all invoke() calls to the /api/uex/ nginx proxy (which forwards to
 * https://uexcorp.space/api/2.0/).  Settings and favorites are persisted in
 * localStorage.  Game / overlay / hotkey commands are no-ops.
 *
 * Data transformations mirror the Rust DTO logic in src-tauri/src/uex/.
 */

// ── Raw UEX API response wrapper ───────────────────────────────────────────

interface UexApiWrapper<T> {
  data: T[] | null;
}

// ── UEX API DTOs (mirrors Rust structs in src-tauri/src/uex/) ─────────────

interface CommodityDto {
  id: number | string;
  name?: string;
  slug?: string;
  code?: string | null;
  kind?: string | null;
  wiki?: string | null;
  weight_scu?: number | null;
  price_buy?: number | null;
  price_sell?: number | null;
  is_illegal?: number | null;
  is_buyable?: number | null;
  is_sellable?: number | null;
  is_mineral?: number | null;
  is_raw?: number | null;
  is_refined?: number | null;
  is_harvestable?: number | null;
}

interface CommodityPriceDto {
  id_commodity: number | string;
  commodity_name?: string | null;
  star_system_name?: string | null;
  planet_name?: string | null;
  orbit_name?: string | null;
  terminal_name?: string | null;
  id_terminal: number | string;
  faction_name?: string | null;
  price_buy?: number | null;
  price_buy_min?: number | null;
  price_buy_max?: number | null;
  price_buy_avg?: number | null;
  price_buy_users?: number | null;
  price_sell?: number | null;
  price_sell_min?: number | null;
  price_sell_max?: number | null;
  price_sell_avg?: number | null;
  price_sell_users?: number | null;
  scu_buy?: number | null;
  scu_buy_min?: number | null;
  scu_buy_max?: number | null;
  scu_buy_avg?: number | null;
  scu_buy_users?: number | null;
  scu_sell?: number | null;
  scu_sell_stock?: number | null;
  scu_sell_stock_avg?: number | null;
  status_buy?: number | null;
  status_buy_avg?: number | null;
  status_sell?: number | null;
  status_sell_avg?: number | null;
  container_sizes?: string | null;
  date_modified?: number | string | null;
  date_added?: number | string | null;
}

interface VehicleDto {
  id: number | string;
  name?: string;
  name_full?: string | null;
  slug?: string;
  company_name?: string | null;
  scu?: number | null;
  crew?: string | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  mass?: number | null;
  pad_type?: string | null;
  url_photo?: string | null;
  url_store?: string | null;
  game_version?: string | null;
  is_ground_vehicle?: number | null;
  is_boarding?: number | null;
  is_bomber?: number | null;
  is_cargo?: number | null;
  is_carrier?: number | null;
  is_civilian?: number | null;
  is_construction?: number | null;
  is_datarunner?: number | null;
  is_exploration?: number | null;
  is_industrial?: number | null;
  is_interdiction?: number | null;
  is_medical?: number | null;
  is_military?: number | null;
  is_mining?: number | null;
  is_passenger?: number | null;
  is_racing?: number | null;
  is_refinery?: number | null;
  is_refuel?: number | null;
  is_repair?: number | null;
  is_research?: number | null;
  is_salvage?: number | null;
  is_scanning?: number | null;
  is_science?: number | null;
  is_stealth?: number | null;
}

interface VehiclePurchasePriceDto {
  id_vehicle: number | string;
  vehicle_name?: string | null;
  star_system_name?: string | null;
  planet_name?: string | null;
  orbit_name?: string | null;
  faction_name?: string | null;
  terminal_name?: string | null;
  id_terminal: number | string;
  price_buy?: number | null;
  date_modified?: number | string | null;
  date_added?: number | string | null;
}

interface VehicleRentalPriceDto {
  id_vehicle: number | string;
  vehicle_name?: string | null;
  star_system_name?: string | null;
  planet_name?: string | null;
  orbit_name?: string | null;
  faction_name?: string | null;
  terminal_name?: string | null;
  id_terminal: number | string;
  price_rent?: number | null;
  date_modified?: number | string | null;
  date_added?: number | string | null;
}

interface ItemDto {
  id: number | string;
  name?: string;
  slug?: string;
  uuid?: string | null;
  section?: string | null;
  category?: string | null;
  company_name?: string | null;
  size?: string | null;
  color?: string | null;
  game_version?: string | null;
}

interface ItemPriceDto {
  id_item: number | string;
  item_name?: string | null;
  star_system_name?: string | null;
  planet_name?: string | null;
  orbit_name?: string | null;
  faction_name?: string | null;
  terminal_name?: string | null;
  id_terminal: number | string;
  price_buy?: number | null;
  price_sell?: number | null;
  date_modified?: number | string | null;
  date_added?: number | string | null;
}

interface TerminalDto {
  id: number | string;
  name?: string;
  displayname?: string | null;
  fullname?: string | null;
  code?: string | null;
  slug?: string | null;
}

interface FuelPriceDto {
  id_commodity: number | string;
  commodity_name?: string | null;
  star_system_name?: string | null;
  planet_name?: string | null;
  terminal_name?: string | null;
  id_terminal: number | string;
  price_buy?: number | null;
  date_modified?: number | string | null;
  date_added?: number | string | null;
}

interface CategoryDto {
  id: number | string;
  type?: string;
}

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
  esc_closes_overlay: false, // ESC can't close the browser tab
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

// ── In-memory cache ────────────────────────────────────────────────────────

interface MemEntry {
  data: unknown;
  at: number;
  ttlSecs: number;
}

const MEM = new Map<string, MemEntry>();

function memGet<T>(key: string): T | null {
  const e = MEM.get(key);
  if (!e) return null;
  if ((Date.now() - e.at) / 1000 > e.ttlSecs) return null;
  return e.data as T;
}

function memSet(key: string, data: unknown, ttlSecs: number): void {
  MEM.set(key, { data, at: Date.now(), ttlSecs });
}

async function withCache<T>(key: string, ttl: number, fetch: () => Promise<T>): Promise<T> {
  const cached = memGet<T>(key);
  if (cached !== null) return cached;
  const data = await fetch();
  memSet(key, data, ttl);
  return data;
}

// ── Serde helpers (mirrors Rust logic in src-tauri/src/uex/types.rs) ───────

function flexId(v: number | string | undefined | null): string {
  if (v === undefined || v === null) return "";
  return String(v);
}

function nonemptyStr(v: string | null | undefined): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

function positiveF64(v: number | null | undefined): number | null {
  return typeof v === "number" && v > 0 ? v : null;
}

function boolFlag(v: number | null | undefined): boolean | null {
  if (v === null || v === undefined) return null;
  return v === 1;
}

function locationStr(
  sys: string | null | undefined,
  planet: string | null | undefined,
): string {
  return nonemptyStr(sys) ?? nonemptyStr(planet) ?? "Unknown";
}

function tsStr(
  a: number | string | null | undefined,
  b: number | string | null | undefined,
): string {
  const v = a ?? b;
  return v !== null && v !== undefined ? String(v) : "";
}

function containerSizes(cs: string | null | undefined): string {
  if (!cs) return "";
  const nums = cs
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n));
  if (!nums.length) return "";
  const mn = Math.min(...nums);
  const mx = Math.max(...nums);
  return mn === mx ? String(mn) : `${mn}-${mx}`;
}

// ── UEX HTTP client ────────────────────────────────────────────────────────

async function uexGet<T>(path: string, params: Record<string, string> = {}): Promise<T[]> {
  const url = new URL("/api/uex" + path, window.location.origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`UEX ${path} → HTTP ${resp.status}`);
  const wrapper = (await resp.json()) as UexApiWrapper<T>;
  return wrapper.data ?? [];
}

// ── DTO → app-type transformers ────────────────────────────────────────────

function commodityToResult(d: CommodityDto): UexResult {
  return { id: flexId(d.id), name: d.name ?? "", kind: "commodity", slug: d.slug ?? "", uuid: "" };
}

function commodityToInfo(d: CommodityDto): EntityInfo {
  return {
    id: flexId(d.id),
    name: d.name ?? "",
    kind: "commodity",
    slug: d.slug ?? "",
    code: nonemptyStr(d.code),
    wiki: nonemptyStr(d.wiki),
    commodity_kind: nonemptyStr(d.kind),
    weight_scu: typeof d.weight_scu === "number" ? d.weight_scu : null,
    avg_buy: positiveF64(d.price_buy),
    avg_sell: positiveF64(d.price_sell),
    is_illegal: boolFlag(d.is_illegal),
    is_buyable: boolFlag(d.is_buyable),
    is_sellable: boolFlag(d.is_sellable),
    is_mineral: boolFlag(d.is_mineral),
    is_raw: boolFlag(d.is_raw),
    is_refined: boolFlag(d.is_refined),
    is_harvestable: boolFlag(d.is_harvestable),
    company_name: null,
    game_version: null,
    section: null,
    category: null,
    size: null,
    color: null,
    name_full: null,
    scu: null,
    crew: null,
    length: null,
    width: null,
    height: null,
    mass: null,
    pad_type: null,
    url_photo: null,
    url_store: null,
    roles: [],
  };
}

function commodityPriceToEntry(d: CommodityPriceDto, priceType: string): PriceEntry {
  const isBuy = (d.price_buy ?? 0) > 0;
  return {
    entity_id: flexId(d.id_commodity),
    entity_name: d.commodity_name ?? "",
    price_type: priceType,
    location: locationStr(d.star_system_name, d.planet_name),
    terminal: d.terminal_name ?? "Unknown",
    terminal_id: flexId(d.id_terminal),
    buy_price: d.price_buy ?? 0,
    sell_price: d.price_sell ?? 0,
    rent_price: 0,
    scu_available: d.scu_buy ?? d.scu_sell ?? null,
    date_updated: tsStr(d.date_modified, d.date_added),
    orbit: d.orbit_name ?? "",
    system: d.star_system_name ?? "",
    faction: d.faction_name ?? "",
    scu_last: isBuy ? (d.scu_buy ?? 0) : (d.scu_sell_stock ?? 0),
    scu_users: isBuy ? (d.scu_buy_users ?? 0) : 0,
    scu_avg: isBuy ? (d.scu_buy_avg ?? 0) : (d.scu_sell_stock_avg ?? 0),
    scu_min: isBuy ? (d.scu_buy_min ?? 0) : 0,
    scu_max: isBuy ? (d.scu_buy_max ?? 0) : 0,
    price_last: isBuy ? (d.price_buy ?? 0) : (d.price_sell ?? 0),
    price_users: isBuy ? (d.price_buy_users ?? 0) : (d.price_sell_users ?? 0),
    price_avg: isBuy ? (d.price_buy_avg ?? 0) : (d.price_sell_avg ?? 0),
    price_min: isBuy ? (d.price_buy_min ?? 0) : (d.price_sell_min ?? 0),
    price_max: isBuy ? (d.price_buy_max ?? 0) : (d.price_sell_max ?? 0),
    inventory_status: isBuy ? (d.status_buy ?? 0) : (d.status_sell ?? 0),
    inventory_status_avg: isBuy ? (d.status_buy_avg ?? 0) : (d.status_sell_avg ?? 0),
    container_sizes: containerSizes(d.container_sizes),
    is_buy_location: isBuy,
  };
}

const VEHICLE_ROLE_FLAGS: [keyof VehicleDto, string][] = [
  ["is_boarding", "Boarding"],
  ["is_bomber", "Bomber"],
  ["is_cargo", "Cargo"],
  ["is_carrier", "Carrier"],
  ["is_civilian", "Civilian"],
  ["is_construction", "Construction"],
  ["is_datarunner", "Data Runner"],
  ["is_exploration", "Exploration"],
  ["is_industrial", "Industrial"],
  ["is_interdiction", "Interdiction"],
  ["is_medical", "Medical"],
  ["is_military", "Military"],
  ["is_mining", "Mining"],
  ["is_passenger", "Passenger"],
  ["is_racing", "Racing"],
  ["is_refinery", "Refinery"],
  ["is_refuel", "Refuel"],
  ["is_repair", "Repair"],
  ["is_research", "Research"],
  ["is_salvage", "Salvage"],
  ["is_scanning", "Scanning"],
  ["is_science", "Science"],
  ["is_stealth", "Stealth"],
];

function vehicleKind(d: VehicleDto): string {
  return d.is_ground_vehicle === 1 ? "ground vehicle" : "vehicle";
}

function vehicleRoles(d: VehicleDto): string[] {
  return VEHICLE_ROLE_FLAGS.filter(([k]) => d[k] === 1).map(([, label]) => label);
}

function vehicleToResult(d: VehicleDto): UexResult {
  return {
    id: flexId(d.id),
    name: nonemptyStr(d.name_full) ?? d.name ?? "",
    kind: vehicleKind(d),
    slug: d.slug ?? "",
    uuid: "",
  };
}

function vehicleToInfo(d: VehicleDto): EntityInfo {
  const crew = nonemptyStr(d.crew);
  return {
    id: flexId(d.id),
    name: d.name ?? "",
    kind: vehicleKind(d),
    slug: d.slug ?? "",
    name_full: nonemptyStr(d.name_full),
    company_name: nonemptyStr(d.company_name),
    scu: positiveF64(d.scu),
    crew: crew === "0" ? null : crew,
    length: positiveF64(d.length),
    width: positiveF64(d.width),
    height: positiveF64(d.height),
    mass: positiveF64(d.mass),
    pad_type: nonemptyStr(d.pad_type),
    url_photo: nonemptyStr(d.url_photo),
    url_store: nonemptyStr(d.url_store),
    game_version: nonemptyStr(d.game_version),
    roles: vehicleRoles(d),
    code: null,
    wiki: null,
    commodity_kind: null,
    weight_scu: null,
    avg_buy: null,
    avg_sell: null,
    is_illegal: null,
    is_buyable: null,
    is_sellable: null,
    is_mineral: null,
    is_raw: null,
    is_refined: null,
    is_harvestable: null,
    section: null,
    category: null,
    size: null,
    color: null,
  };
}

function vehiclePurchasePriceToEntry(d: VehiclePurchasePriceDto): PriceEntry {
  return {
    entity_id: flexId(d.id_vehicle),
    entity_name: d.vehicle_name ?? "",
    price_type: "vehicle_purchase",
    location: locationStr(d.star_system_name, d.planet_name),
    terminal: d.terminal_name ?? "Unknown",
    terminal_id: flexId(d.id_terminal),
    buy_price: d.price_buy ?? 0,
    sell_price: 0,
    rent_price: 0,
    scu_available: null,
    date_updated: tsStr(d.date_modified, d.date_added),
    orbit: d.orbit_name ?? "",
    system: d.star_system_name ?? "",
    faction: d.faction_name ?? "",
    scu_last: 0,
    scu_users: 0,
    scu_avg: 0,
    scu_min: 0,
    scu_max: 0,
    price_last: d.price_buy ?? 0,
    price_users: 0,
    price_avg: 0,
    price_min: 0,
    price_max: 0,
    inventory_status: 0,
    inventory_status_avg: 0,
    container_sizes: "",
    is_buy_location: true,
  };
}

function vehicleRentalPriceToEntry(d: VehicleRentalPriceDto): PriceEntry {
  return {
    entity_id: flexId(d.id_vehicle),
    entity_name: d.vehicle_name ?? "",
    price_type: "vehicle_rental",
    location: locationStr(d.star_system_name, d.planet_name),
    terminal: d.terminal_name ?? "Unknown",
    terminal_id: flexId(d.id_terminal),
    buy_price: 0,
    sell_price: 0,
    rent_price: d.price_rent ?? 0,
    scu_available: null,
    date_updated: tsStr(d.date_modified, d.date_added),
    orbit: d.orbit_name ?? "",
    system: d.star_system_name ?? "",
    faction: d.faction_name ?? "",
    scu_last: 0,
    scu_users: 0,
    scu_avg: 0,
    scu_min: 0,
    scu_max: 0,
    price_last: 0,
    price_users: 0,
    price_avg: 0,
    price_min: 0,
    price_max: 0,
    inventory_status: 0,
    inventory_status_avg: 0,
    container_sizes: "",
    is_buy_location: false,
  };
}

function itemToResult(d: ItemDto): UexResult {
  return {
    id: flexId(d.id),
    name: d.name ?? "",
    kind: "item",
    slug: d.slug ?? "",
    uuid: d.uuid ?? "",
  };
}

function itemToInfo(d: ItemDto): EntityInfo {
  return {
    id: flexId(d.id),
    name: d.name ?? "",
    kind: "item",
    slug: d.slug ?? "",
    section: nonemptyStr(d.section),
    category: nonemptyStr(d.category),
    company_name: nonemptyStr(d.company_name),
    size: nonemptyStr(d.size),
    color: nonemptyStr(d.color),
    game_version: nonemptyStr(d.game_version),
    code: null,
    wiki: null,
    commodity_kind: null,
    weight_scu: null,
    avg_buy: null,
    avg_sell: null,
    is_illegal: null,
    is_buyable: null,
    is_sellable: null,
    is_mineral: null,
    is_raw: null,
    is_refined: null,
    is_harvestable: null,
    name_full: null,
    scu: null,
    crew: null,
    length: null,
    width: null,
    height: null,
    mass: null,
    pad_type: null,
    url_photo: null,
    url_store: null,
    roles: [],
  };
}

function itemPriceToEntry(d: ItemPriceDto): PriceEntry {
  return {
    entity_id: flexId(d.id_item),
    entity_name: d.item_name ?? "",
    price_type: "item",
    location: locationStr(d.star_system_name, d.planet_name),
    terminal: d.terminal_name ?? "Unknown",
    terminal_id: flexId(d.id_terminal),
    buy_price: d.price_buy ?? 0,
    sell_price: d.price_sell ?? 0,
    rent_price: 0,
    scu_available: null,
    date_updated: tsStr(d.date_modified, d.date_added),
    orbit: d.orbit_name ?? "",
    system: d.star_system_name ?? "",
    faction: d.faction_name ?? "",
    scu_last: 0,
    scu_users: 0,
    scu_avg: 0,
    scu_min: 0,
    scu_max: 0,
    price_last: d.price_buy ?? d.price_sell ?? 0,
    price_users: 0,
    price_avg: 0,
    price_min: 0,
    price_max: 0,
    inventory_status: 0,
    inventory_status_avg: 0,
    container_sizes: "",
    is_buy_location: (d.price_buy ?? 0) > 0,
  };
}

function terminalToResult(d: TerminalDto): UexResult {
  const name =
    nonemptyStr(d.displayname) ?? nonemptyStr(d.fullname) ?? d.name ?? "";
  const slug = nonemptyStr(d.code) ?? d.slug ?? "";
  return { id: flexId(d.id), name, kind: "location", slug, uuid: "" };
}

function fuelPriceToEntry(d: FuelPriceDto): PriceEntry {
  return {
    entity_id: flexId(d.id_commodity),
    entity_name: d.commodity_name ?? "",
    price_type: "fuel",
    location: locationStr(d.star_system_name, d.planet_name),
    terminal: d.terminal_name ?? "Unknown",
    terminal_id: flexId(d.id_terminal),
    buy_price: d.price_buy ?? 0,
    sell_price: 0,
    rent_price: 0,
    scu_available: null,
    date_updated: tsStr(d.date_modified, d.date_added),
    orbit: "",
    system: "",
    faction: "",
    scu_last: 0,
    scu_users: 0,
    scu_avg: 0,
    scu_min: 0,
    scu_max: 0,
    price_last: d.price_buy ?? 0,
    price_users: 0,
    price_avg: 0,
    price_min: 0,
    price_max: 0,
    inventory_status: 0,
    inventory_status_avg: 0,
    container_sizes: "",
    is_buy_location: true,
  };
}

// ── Collection fetchers with caching ──────────────────────────────────────

const TTL_CATALOG = 86400; // 24 h
const TTL_PRICES = 600; // 10 min

async function allCommodities(): Promise<UexResult[]> {
  return withCache("commodities", TTL_CATALOG, async () =>
    (await uexGet<CommodityDto>("/commodities")).map(commodityToResult),
  );
}

async function allVehicles(): Promise<UexResult[]> {
  return withCache("vehicles", TTL_CATALOG, async () =>
    (await uexGet<VehicleDto>("/vehicles")).map(vehicleToResult),
  );
}

async function allItems(): Promise<UexResult[]> {
  return withCache("items", TTL_CATALOG, async () => {
    const cats = await uexGet<CategoryDto>("/categories");
    const ids = cats.filter((c) => c.type === "item").map((c) => flexId(c.id));
    const chunks = await Promise.allSettled(
      ids.map((id) => uexGet<ItemDto>("/items", { id_category: id })),
    );
    const seen = new Set<string>();
    const results: UexResult[] = [];
    for (const chunk of chunks) {
      if (chunk.status === "fulfilled") {
        for (const dto of chunk.value) {
          const r = itemToResult(dto);
          if (!seen.has(r.id)) {
            seen.add(r.id);
            results.push(r);
          }
        }
      }
    }
    return results;
  });
}

async function allLocations(): Promise<UexResult[]> {
  return withCache("locations", TTL_CATALOG, async () =>
    (await uexGet<TerminalDto>("/terminals")).map(terminalToResult),
  );
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
      const [comms, vehs, items, locs] = await Promise.allSettled([
        allCommodities(),
        allVehicles(),
        allItems(),
        allLocations(),
      ]);
      const all: UexResult[] = [];
      for (const r of [comms, vehs, items, locs]) {
        if (r.status === "fulfilled") all.push(...searchIn(r.value, query));
      }
      const total = all.length;
      return apiOk(all.slice(0, maxResults), total) as unknown as T;
    }

    case "api_search_commodities": {
      const query = args.query as string;
      if (!query.trim()) return apiOk<UexResult[]>([]) as unknown as T;
      return apiOk(searchIn(await allCommodities(), query)) as unknown as T;
    }

    case "api_search_vehicles": {
      const query = args.query as string;
      if (!query.trim()) return apiOk<UexResult[]>([]) as unknown as T;
      return apiOk(searchIn(await allVehicles(), query)) as unknown as T;
    }

    case "api_search_items": {
      const query = args.query as string;
      if (!query.trim()) return apiOk<UexResult[]>([]) as unknown as T;
      return apiOk(searchIn(await allItems(), query)) as unknown as T;
    }

    case "api_search_locations": {
      const query = args.query as string;
      if (!query.trim()) return apiOk<UexResult[]>([]) as unknown as T;
      return apiOk(searchIn(await allLocations(), query)) as unknown as T;
    }

    // ── Prices ───────────────────────────────────────────────────────────
    case "api_commodity_prices": {
      const id = args.commodityId as string;
      return apiOk(
        await withCache(`commodity_prices:${id}`, TTL_PRICES, async () =>
          (
            await uexGet<CommodityPriceDto>("/commodities_prices", { id_commodity: id })
          ).map((d) => commodityPriceToEntry(d, "commodity")),
        ),
      ) as unknown as T;
    }

    case "api_raw_commodity_prices": {
      const id = args.commodityId as string;
      return apiOk(
        await withCache(`raw_commodity_prices:${id}`, TTL_PRICES, async () =>
          (
            await uexGet<CommodityPriceDto>("/commodities_raw_prices", { id_commodity: id })
          ).map((d) => commodityPriceToEntry(d, "raw_commodity")),
        ),
      ) as unknown as T;
    }

    case "api_item_prices": {
      const id = args.itemId as string;
      return apiOk(
        await withCache(`item_prices:${id}`, TTL_PRICES, async () =>
          (await uexGet<ItemPriceDto>("/items_prices", { id_item: id })).map(itemPriceToEntry),
        ),
      ) as unknown as T;
    }

    case "api_vehicle_purchase_prices": {
      const id = args.vehicleId as string;
      return apiOk(
        await withCache(`vehicle_purchase_prices:${id}`, TTL_PRICES, async () =>
          (
            await uexGet<VehiclePurchasePriceDto>("/vehicles_purchases_prices", {
              id_vehicle: id,
            })
          ).map(vehiclePurchasePriceToEntry),
        ),
      ) as unknown as T;
    }

    case "api_vehicle_rental_prices": {
      const id = args.vehicleId as string;
      return apiOk(
        await withCache(`vehicle_rental_prices:${id}`, TTL_PRICES, async () =>
          (
            await uexGet<VehicleRentalPriceDto>("/vehicles_rentals_prices", { id_vehicle: id })
          ).map(vehicleRentalPriceToEntry),
        ),
      ) as unknown as T;
    }

    case "api_fuel_prices": {
      const id = args.terminalId as string;
      return apiOk(
        await withCache(`fuel_prices:${id}`, TTL_PRICES, async () =>
          (await uexGet<FuelPriceDto>("/fuel_prices", { id_terminal: id })).map(fuelPriceToEntry),
        ),
      ) as unknown as T;
    }

    // ── Entity info ──────────────────────────────────────────────────────
    case "api_entity_info": {
      const kind = args.kind as string;
      const entityId = args.entityId as string;
      const cacheKey = `entity_info:${kind}:${entityId}`;

      if (kind === "commodity") {
        return apiOk(
          await withCache(cacheKey, TTL_CATALOG, async () => {
            const dtos = await uexGet<CommodityDto>("/commodities");
            const dto = dtos.find((d) => flexId(d.id) === entityId);
            if (!dto) throw new Error(`Commodity ${entityId} not found`);
            return commodityToInfo(dto);
          }),
        ) as unknown as T;
      }

      if (kind === "vehicle" || kind === "ground vehicle") {
        return apiOk(
          await withCache(cacheKey, TTL_CATALOG, async () => {
            const dtos = await uexGet<VehicleDto>("/vehicles");
            const dto = dtos.find((d) => flexId(d.id) === entityId);
            if (!dto) throw new Error(`Vehicle ${entityId} not found`);
            return vehicleToInfo(dto);
          }),
        ) as unknown as T;
      }

      if (kind === "item") {
        try {
          const info = await withCache(cacheKey, TTL_CATALOG, async () => {
            const items = await allItems();
            const item = items.find((r) => r.id === entityId);
            if (!item?.uuid) throw new Error(`Item ${entityId} uuid not available`);
            const dtos = await uexGet<ItemDto>("/items", { uuid: item.uuid });
            const dto = dtos[0];
            if (!dto) throw new Error(`Item ${entityId} not found`);
            return itemToInfo(dto);
          });
          return apiOk(info) as unknown as T;
        } catch (e) {
          return apiErr<EntityInfo>(String(e)) as unknown as T;
        }
      }

      return apiErr<EntityInfo>(`Entity info not supported for kind: ${kind}`) as unknown as T;
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
        cache_total_keys: MEM.size,
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
