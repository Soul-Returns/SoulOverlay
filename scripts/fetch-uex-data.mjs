#!/usr/bin/env node
/**
 * Build-time UEX data fetcher for the web demo.
 *
 * Fetches all catalog + price data from the UEX Corp API, transforms it into
 * the same shapes the Rust backend produces, and writes static JSON files to
 * public/data/.  The web demo then serves these files and invoke.ts reads
 * from them — no runtime API calls needed.
 *
 * Usage:
 *   UEX_API_KEY=xxx node scripts/fetch-uex-data.mjs
 *
 * Output (public/data/):
 *   catalogs.json               — search results per entity type
 *   entity-info.json            — detail cards per entity type, keyed by ID
 *   commodity-prices.json       — Record<id, PriceEntry[]>
 *   raw-commodity-prices.json   — Record<id, PriceEntry[]>
 *   item-prices.json            — Record<id, PriceEntry[]>
 *   vehicle-purchase-prices.json
 *   vehicle-rental-prices.json
 *   fuel-prices.json            — Record<terminal_id, PriceEntry[]>
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "..", "public", "data");

// ── Config ─────────────────────────────────────────────────────────────────

const API_BASE = "https://uexcorp.space/api/2.0";
const API_KEY = process.env.UEX_API_KEY;
if (!API_KEY) {
  console.error("ERROR: UEX_API_KEY environment variable is required.");
  process.exit(1);
}

const MAX_CONCURRENT = 5;
const RETRY_DELAY_MS = 2000;
const MAX_RETRIES = 3;

// ── HTTP helpers ───────────────────────────────────────────────────────────

async function uexGet(path, params = {}) {
  const url = new URL(API_BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    if (resp.status === 429) {
      const wait = RETRY_DELAY_MS * attempt;
      console.error(`  429 rate-limited on ${path}, retrying in ${wait}ms...`);
      await sleep(wait);
      continue;
    }
    if (!resp.ok) throw new Error(`UEX ${path} → HTTP ${resp.status}`);
    const wrapper = await resp.json();
    return wrapper.data ?? [];
  }
  throw new Error(`UEX ${path} → exceeded ${MAX_RETRIES} retries`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Run async tasks with bounded concurrency.
 * Returns results in the same order as the input tasks.
 */
async function mapConcurrent(items, concurrency, fn) {
  const results = new Array(items.length);
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

// ── Serde helpers (mirrors Rust logic) ─────────────────────────────────────

function flexId(v) {
  if (v === undefined || v === null) return "";
  return String(v);
}

function nonemptyStr(v) {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

function positiveF64(v) {
  return typeof v === "number" && v > 0 ? v : null;
}

function boolFlag(v) {
  if (v === null || v === undefined) return null;
  return v === 1;
}

function locationStr(sys, planet) {
  return nonemptyStr(sys) ?? nonemptyStr(planet) ?? "Unknown";
}

function tsStr(a, b) {
  const v = a ?? b;
  return v !== null && v !== undefined ? String(v) : "";
}

function containerSizes(cs) {
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

// ── DTO → app-type transformers ────────────────────────────────────────────

function commodityToResult(d) {
  return { id: flexId(d.id), name: d.name ?? "", kind: "commodity", slug: d.slug ?? "", uuid: "" };
}

function commodityToInfo(d) {
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
    company_name: null, game_version: null, section: null, category: null,
    size: null, color: null, name_full: null, scu: null, crew: null,
    length: null, width: null, height: null, mass: null, pad_type: null,
    url_photo: null, url_store: null, roles: [],
  };
}

function commodityPriceToEntry(d, priceType) {
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

const VEHICLE_ROLE_FLAGS = [
  ["is_boarding", "Boarding"], ["is_bomber", "Bomber"], ["is_cargo", "Cargo"],
  ["is_carrier", "Carrier"], ["is_civilian", "Civilian"], ["is_construction", "Construction"],
  ["is_datarunner", "Data Runner"], ["is_exploration", "Exploration"],
  ["is_industrial", "Industrial"], ["is_interdiction", "Interdiction"],
  ["is_medical", "Medical"], ["is_military", "Military"], ["is_mining", "Mining"],
  ["is_passenger", "Passenger"], ["is_racing", "Racing"], ["is_refinery", "Refinery"],
  ["is_refuel", "Refuel"], ["is_repair", "Repair"], ["is_research", "Research"],
  ["is_salvage", "Salvage"], ["is_scanning", "Scanning"], ["is_science", "Science"],
  ["is_stealth", "Stealth"],
];

function vehicleKind(d) {
  return d.is_ground_vehicle === 1 ? "ground vehicle" : "vehicle";
}

function vehicleRoles(d) {
  return VEHICLE_ROLE_FLAGS.filter(([k]) => d[k] === 1).map(([, label]) => label);
}

function vehicleToResult(d) {
  return {
    id: flexId(d.id),
    name: nonemptyStr(d.name_full) ?? d.name ?? "",
    kind: vehicleKind(d),
    slug: d.slug ?? "",
    uuid: "",
  };
}

function vehicleToInfo(d) {
  const crew = nonemptyStr(d.crew);
  return {
    id: flexId(d.id), name: d.name ?? "", kind: vehicleKind(d), slug: d.slug ?? "",
    name_full: nonemptyStr(d.name_full), company_name: nonemptyStr(d.company_name),
    scu: positiveF64(d.scu), crew: crew === "0" ? null : crew,
    length: positiveF64(d.length), width: positiveF64(d.width),
    height: positiveF64(d.height), mass: positiveF64(d.mass),
    pad_type: nonemptyStr(d.pad_type), url_photo: nonemptyStr(d.url_photo),
    url_store: nonemptyStr(d.url_store), game_version: nonemptyStr(d.game_version),
    roles: vehicleRoles(d),
    code: null, wiki: null, commodity_kind: null, weight_scu: null,
    avg_buy: null, avg_sell: null, is_illegal: null, is_buyable: null,
    is_sellable: null, is_mineral: null, is_raw: null, is_refined: null,
    is_harvestable: null, section: null, category: null, size: null, color: null,
  };
}

function vehiclePurchasePriceToEntry(d) {
  return {
    entity_id: flexId(d.id_vehicle), entity_name: d.vehicle_name ?? "",
    price_type: "vehicle_purchase",
    location: locationStr(d.star_system_name, d.planet_name),
    terminal: d.terminal_name ?? "Unknown", terminal_id: flexId(d.id_terminal),
    buy_price: d.price_buy ?? 0, sell_price: 0, rent_price: 0, scu_available: null,
    date_updated: tsStr(d.date_modified, d.date_added),
    orbit: d.orbit_name ?? "", system: d.star_system_name ?? "", faction: d.faction_name ?? "",
    scu_last: 0, scu_users: 0, scu_avg: 0, scu_min: 0, scu_max: 0,
    price_last: d.price_buy ?? 0, price_users: 0, price_avg: 0, price_min: 0, price_max: 0,
    inventory_status: 0, inventory_status_avg: 0, container_sizes: "", is_buy_location: true,
  };
}

function vehicleRentalPriceToEntry(d) {
  return {
    entity_id: flexId(d.id_vehicle), entity_name: d.vehicle_name ?? "",
    price_type: "vehicle_rental",
    location: locationStr(d.star_system_name, d.planet_name),
    terminal: d.terminal_name ?? "Unknown", terminal_id: flexId(d.id_terminal),
    buy_price: 0, sell_price: 0, rent_price: d.price_rent ?? 0, scu_available: null,
    date_updated: tsStr(d.date_modified, d.date_added),
    orbit: d.orbit_name ?? "", system: d.star_system_name ?? "", faction: d.faction_name ?? "",
    scu_last: 0, scu_users: 0, scu_avg: 0, scu_min: 0, scu_max: 0,
    price_last: 0, price_users: 0, price_avg: 0, price_min: 0, price_max: 0,
    inventory_status: 0, inventory_status_avg: 0, container_sizes: "", is_buy_location: false,
  };
}

function itemToResult(d) {
  return { id: flexId(d.id), name: d.name ?? "", kind: "item", slug: d.slug ?? "", uuid: d.uuid ?? "" };
}

function itemToInfo(d) {
  return {
    id: flexId(d.id), name: d.name ?? "", kind: "item", slug: d.slug ?? "",
    section: nonemptyStr(d.section), category: nonemptyStr(d.category),
    company_name: nonemptyStr(d.company_name), size: nonemptyStr(d.size),
    color: nonemptyStr(d.color), game_version: nonemptyStr(d.game_version),
    code: null, wiki: null, commodity_kind: null, weight_scu: null,
    avg_buy: null, avg_sell: null, is_illegal: null, is_buyable: null,
    is_sellable: null, is_mineral: null, is_raw: null, is_refined: null,
    is_harvestable: null, name_full: null, scu: null, crew: null,
    length: null, width: null, height: null, mass: null, pad_type: null,
    url_photo: null, url_store: null, roles: [],
  };
}

function itemPriceToEntry(d) {
  return {
    entity_id: flexId(d.id_item), entity_name: d.item_name ?? "",
    price_type: "item",
    location: locationStr(d.star_system_name, d.planet_name),
    terminal: d.terminal_name ?? "Unknown", terminal_id: flexId(d.id_terminal),
    buy_price: d.price_buy ?? 0, sell_price: d.price_sell ?? 0, rent_price: 0,
    scu_available: null, date_updated: tsStr(d.date_modified, d.date_added),
    orbit: d.orbit_name ?? "", system: d.star_system_name ?? "", faction: d.faction_name ?? "",
    scu_last: 0, scu_users: 0, scu_avg: 0, scu_min: 0, scu_max: 0,
    price_last: d.price_buy ?? d.price_sell ?? 0, price_users: 0, price_avg: 0,
    price_min: 0, price_max: 0,
    inventory_status: 0, inventory_status_avg: 0, container_sizes: "",
    is_buy_location: (d.price_buy ?? 0) > 0,
  };
}

function terminalToResult(d) {
  const name = nonemptyStr(d.displayname) ?? nonemptyStr(d.fullname) ?? d.name ?? "";
  const slug = nonemptyStr(d.code) ?? d.slug ?? "";
  return { id: flexId(d.id), name, kind: "location", slug, uuid: "" };
}

function fuelPriceToEntry(d) {
  return {
    entity_id: flexId(d.id_commodity), entity_name: d.commodity_name ?? "",
    price_type: "fuel",
    location: locationStr(d.star_system_name, d.planet_name),
    terminal: d.terminal_name ?? "Unknown", terminal_id: flexId(d.id_terminal),
    buy_price: d.price_buy ?? 0, sell_price: 0, rent_price: 0, scu_available: null,
    date_updated: tsStr(d.date_modified, d.date_added),
    orbit: "", system: "", faction: "",
    scu_last: 0, scu_users: 0, scu_avg: 0, scu_min: 0, scu_max: 0,
    price_last: d.price_buy ?? 0, price_users: 0, price_avg: 0, price_min: 0, price_max: 0,
    inventory_status: 0, inventory_status_avg: 0, container_sizes: "", is_buy_location: true,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function writeJson(filename, data) {
  const path = resolve(OUT_DIR, filename);
  writeFileSync(path, JSON.stringify(data));
  const sizeMb = (Buffer.byteLength(JSON.stringify(data)) / 1024 / 1024).toFixed(2);
  console.error(`  ✓ ${filename} (${sizeMb} MB)`);
}

function progress(label, current, total) {
  process.stderr.write(`\r  ${label}: ${current}/${total}`);
  if (current === total) process.stderr.write("\n");
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.error("Fetching UEX data...\n");

  // ── Catalogs ───────────────────────────────────────────────────────────

  console.error("Fetching catalogs...");
  const [rawCommodities, rawVehicles, rawCategories, rawTerminals] = await Promise.all([
    uexGet("/commodities"),
    uexGet("/vehicles"),
    uexGet("/categories"),
    uexGet("/terminals"),
  ]);

  const commodityResults = rawCommodities.map(commodityToResult);
  const vehicleResults = rawVehicles.map(vehicleToResult);
  const locationResults = rawTerminals.map(terminalToResult);

  // Items require per-category fan-out
  console.error(`Fetching items (${rawCategories.filter((c) => c.type === "item").length} categories)...`);
  const itemCatIds = rawCategories.filter((c) => c.type === "item").map((c) => flexId(c.id));
  const rawItemsByCategory = await mapConcurrent(itemCatIds, MAX_CONCURRENT, async (catId, i) => {
    progress("  item categories", i + 1, itemCatIds.length);
    try {
      return await uexGet("/items", { id_category: catId });
    } catch (e) {
      console.error(`\n  WARN: failed to fetch items for category ${catId}: ${e.message}`);
      return [];
    }
  });

  const seenItemIds = new Set();
  const allRawItems = [];
  for (const chunk of rawItemsByCategory) {
    for (const dto of chunk) {
      const id = flexId(dto.id);
      if (!seenItemIds.has(id)) {
        seenItemIds.add(id);
        allRawItems.push(dto);
      }
    }
  }
  const itemResults = allRawItems.map(itemToResult);

  console.error(`  Catalogs: ${commodityResults.length} commodities, ${vehicleResults.length} vehicles, ${itemResults.length} items, ${locationResults.length} locations`);

  writeJson("catalogs.json", {
    commodities: commodityResults,
    vehicles: vehicleResults,
    items: itemResults,
    locations: locationResults,
  });

  // ── Entity info ────────────────────────────────────────────────────────

  const commodityInfo = {};
  for (const d of rawCommodities) commodityInfo[flexId(d.id)] = commodityToInfo(d);

  const vehicleInfo = {};
  for (const d of rawVehicles) vehicleInfo[flexId(d.id)] = vehicleToInfo(d);

  const itemInfo = {};
  for (const d of allRawItems) itemInfo[flexId(d.id)] = itemToInfo(d);

  writeJson("entity-info.json", {
    commodity: commodityInfo,
    vehicle: vehicleInfo,
    "ground vehicle": vehicleInfo,
    item: itemInfo,
  });

  // ── Commodity prices ───────────────────────────────────────────────────

  console.error(`\nFetching commodity prices (${rawCommodities.length} commodities)...`);
  const commodityPrices = {};
  const rawCommodityPrices = {};

  await mapConcurrent(rawCommodities, MAX_CONCURRENT, async (d, i) => {
    const id = flexId(d.id);
    progress("commodity prices", i + 1, rawCommodities.length);
    try {
      const dtos = await uexGet("/commodities_prices", { id_commodity: id });
      commodityPrices[id] = dtos.map((p) => commodityPriceToEntry(p, "commodity"));
    } catch {
      commodityPrices[id] = [];
    }
    try {
      const dtos = await uexGet("/commodities_raw_prices", { id_commodity: id });
      if (dtos.length > 0) rawCommodityPrices[id] = dtos.map((p) => commodityPriceToEntry(p, "raw_commodity"));
    } catch {
      // no raw prices for this commodity — skip
    }
  });

  writeJson("commodity-prices.json", commodityPrices);
  writeJson("raw-commodity-prices.json", rawCommodityPrices);

  // ── Vehicle prices ─────────────────────────────────────────────────────

  console.error(`Fetching vehicle prices (${rawVehicles.length} vehicles)...`);
  const vehiclePurchasePrices = {};
  const vehicleRentalPrices = {};

  await mapConcurrent(rawVehicles, MAX_CONCURRENT, async (d, i) => {
    const id = flexId(d.id);
    progress("vehicle prices", i + 1, rawVehicles.length);
    try {
      const dtos = await uexGet("/vehicles_purchases_prices", { id_vehicle: id });
      if (dtos.length > 0) vehiclePurchasePrices[id] = dtos.map(vehiclePurchasePriceToEntry);
    } catch { /* skip */ }
    try {
      const dtos = await uexGet("/vehicles_rentals_prices", { id_vehicle: id });
      if (dtos.length > 0) vehicleRentalPrices[id] = dtos.map(vehicleRentalPriceToEntry);
    } catch { /* skip */ }
  });

  writeJson("vehicle-purchase-prices.json", vehiclePurchasePrices);
  writeJson("vehicle-rental-prices.json", vehicleRentalPrices);

  // ── Item prices ────────────────────────────────────────────────────────

  console.error(`Fetching item prices (${allRawItems.length} items)...`);
  const itemPrices = {};

  await mapConcurrent(allRawItems, MAX_CONCURRENT, async (d, i) => {
    const id = flexId(d.id);
    progress("item prices", i + 1, allRawItems.length);
    try {
      const dtos = await uexGet("/items_prices", { id_item: id });
      if (dtos.length > 0) itemPrices[id] = dtos.map(itemPriceToEntry);
    } catch { /* skip */ }
  });

  writeJson("item-prices.json", itemPrices);

  // ── Fuel prices ────────────────────────────────────────────────────────

  console.error(`Fetching fuel prices (${rawTerminals.length} terminals)...`);
  const fuelPrices = {};

  await mapConcurrent(rawTerminals, MAX_CONCURRENT, async (d, i) => {
    const id = flexId(d.id);
    progress("fuel prices", i + 1, rawTerminals.length);
    try {
      const dtos = await uexGet("/fuel_prices", { id_terminal: id });
      if (dtos.length > 0) fuelPrices[id] = dtos.map(fuelPriceToEntry);
    } catch { /* skip */ }
  });

  writeJson("fuel-prices.json", fuelPrices);

  console.error("\nDone!");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
