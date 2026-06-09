const SlotCapacity = require("../models/SlotCapacity");
const { SLOT_IDS, DEFAULT_SLOT_CAPACITY } = require("./slotBooking");

/** Charge la map slotId -> capacité depuis la base (créneaux non réglés = absents). */
async function loadCapacitiesMap() {
  const rows = await SlotCapacity.find();
  const map = {};
  for (const r of rows) map[r.slotId] = r.capacity;
  return map;
}

/** Complète la map avec la capacité par défaut pour tous les créneaux connus. */
function capacitiesWithDefaults(map) {
  const full = {};
  for (const sid of SLOT_IDS) {
    full[sid] = map && map[sid] != null ? map[sid] : DEFAULT_SLOT_CAPACITY;
  }
  return full;
}

module.exports = { loadCapacitiesMap, capacitiesWithDefaults };
