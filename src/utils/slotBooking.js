const dayjs = require("dayjs");
const {
  TIME_SLOTS,
  SLOT_IDS,
  slotIdFromLegacyTime,
  isValidSlotId,
  startTimeForSlot,
  isRequestFullDay,
} = require("../constants/timeSlots");
const { isWeekRuleAllowed, isPastDate } = require("./calendarRules");
const { isWeekBlockedByP2c, isMonthFullyBlockedForP2c } = require("./p2cQuota");

const ACTIVE_STATUSES = ["en_attente", "validee", "a_completer"];

/** Un créneau n'est grisé pour les *autres* clients qu'après validation admin (statut validee). */
const SLOT_LOCKING_STATUSES = ["validee"];

/** Capacité par défaut (nombre de clients/vidéastes) d'un créneau sans réglage admin. */
const DEFAULT_SLOT_CAPACITY = 2;

/**
 * Capacité effective d'un créneau.
 * @param {string} slotId
 * @param {Object<string, number>|undefined} capacities map slotId -> capacité
 */
function capacityForSlot(slotId, capacities) {
  if (capacities && Object.prototype.hasOwnProperty.call(capacities, slotId)) {
    const c = Number(capacities[slotId]);
    if (Number.isFinite(c) && c >= 1) return Math.floor(c);
  }
  return DEFAULT_SLOT_CAPACITY;
}

function dateKeyFromInput(date) {
  return dayjs(date).format("YYYY-MM-DD");
}

function effectiveSlotId(requestDoc) {
  if (isRequestFullDay(requestDoc)) return null;
  if (requestDoc.timeSlotId && isValidSlotId(requestDoc.timeSlotId)) return requestDoc.timeSlotId;
  return slotIdFromLegacyTime(requestDoc.requestedTime);
}

function requestOccupiesSlot(requestDoc, slotId) {
  if (isRequestFullDay(requestDoc)) return true;
  return effectiveSlotId(requestDoc) === slotId;
}

/**
 * Nombre de demandes validées par créneau pour une date.
 * Une journée complète consomme 1 unité sur chaque créneau.
 * @returns {Object<string, number>} map slotId -> nombre de réservations validées
 */
function bookingCountsForDate(requests, dateKey, excludeRequestId) {
  const counts = {};
  for (const sid of SLOT_IDS) counts[sid] = 0;
  for (const req of requests) {
    if (excludeRequestId && String(req._id) === String(excludeRequestId)) continue;
    if (!SLOT_LOCKING_STATUSES.includes(req.status)) continue;
    const key = dateKeyFromInput(req.requestedDate);
    if (key !== dateKey) continue;
    if (isRequestFullDay(req)) {
      for (const sid of SLOT_IDS) counts[sid] += 1;
    } else {
      const sid = effectiveSlotId(req);
      if (sid && counts[sid] !== undefined) counts[sid] += 1;
    }
  }
  return counts;
}

/**
 * Créneaux pris au sens « plus aucune place » : nombre de demandes validées >= capacité.
 * @param {Object<string, number>|undefined} capacities map slotId -> capacité
 */
function occupiedSlotsForDate(requests, dateKey, excludeRequestId, capacities) {
  const counts = bookingCountsForDate(requests, dateKey, excludeRequestId);
  const set = new Set();
  for (const sid of SLOT_IDS) {
    if (counts[sid] >= capacityForSlot(sid, capacities)) set.add(sid);
  }
  return set;
}

/** Tous les créneaux ont au moins une place libre (et aucun blocage admin). */
function isFullDayAvailable({ dateKey, blockedDateDocs, blockedSlotDocs, requests, excludeRequestId, capacities }) {
  if (isFullDayBlocked(blockedDateDocs, dateKey)) return false;
  const occupied = occupiedSlotsForDate(requests, dateKey, excludeRequestId, capacities);
  const adminBlocked = adminBlockedSlotsForDate(blockedSlotDocs, dateKey);
  return SLOT_IDS.every((sid) => !occupied.has(sid) && !adminBlocked.has(sid));
}

/** slotId -> true si bloqué par admin pour ce jour */
function adminBlockedSlotsForDate(blockedSlotDocs, dateKey) {
  const set = new Set();
  for (const b of blockedSlotDocs) {
    const key = dateKeyFromInput(b.date);
    if (key === dateKey) set.add(b.slotId);
  }
  return set;
}

function isFullDayBlocked(blockedDateDocs, dateKey) {
  return blockedDateDocs.some((b) => dateKeyFromInput(b.date) === dateKey);
}

function hasAnyFreeSlot({ dateKey, blockedDateDocs, blockedSlotDocs, requests, excludeRequestId, capacities }) {
  if (isFullDayBlocked(blockedDateDocs, dateKey)) return false;
  const occupied = occupiedSlotsForDate(requests, dateKey, excludeRequestId, capacities);
  const adminBlocked = adminBlockedSlotsForDate(blockedSlotDocs, dateKey);
  return SLOT_IDS.some((sid) => !occupied.has(sid) && !adminBlocked.has(sid));
}

function buildDaySlotsForClient({ dateKey, blockedDateDocs, blockedSlotDocs, requests, excludeRequestId, capacities }) {
  const fullDay = isFullDayBlocked(blockedDateDocs, dateKey);
  const counts = bookingCountsForDate(requests, dateKey, excludeRequestId);
  const occupied = occupiedSlotsForDate(requests, dateKey, excludeRequestId, capacities);
  const adminBlocked = adminBlockedSlotsForDate(blockedSlotDocs, dateKey);

  const slots = TIME_SLOTS.map((def) => {
    const capacity = capacityForSlot(def.id, capacities);
    const booked = counts[def.id] || 0;
    const remaining = Math.max(0, capacity - booked);
    let available = true;
    let reason = "";
    if (fullDay) {
      available = false;
      reason = "jour_bloque";
    } else if (adminBlocked.has(def.id)) {
      available = false;
      reason = "admin";
    } else if (occupied.has(def.id)) {
      available = false;
      reason = "reserve";
    }
    return {
      id: def.id,
      label: def.label,
      startTime: def.startTime,
      endTime: def.endTime,
      available,
      reason: available ? "" : reason,
      capacity,
      booked,
      remaining,
    };
  });

  const fullDayAvailable = isFullDayAvailable({
    dateKey,
    blockedDateDocs,
    blockedSlotDocs,
    requests,
    excludeRequestId,
    capacities,
  });

  return { date: dateKey, fullDayBlocked: fullDay, fullDayAvailable, slots };
}

/** Détail admin : qui occupe chaque créneau */
function buildDaySlotsForAdmin({ dateKey, blockedDateDocs, blockedSlotDocs, requests, capacities }) {
  const fullDay = isFullDayBlocked(blockedDateDocs, dateKey);
  const adminBlockIdBySlot = new Map();
  for (const b of blockedSlotDocs) {
    if (dateKeyFromInput(b.date) === dateKey) adminBlockIdBySlot.set(b.slotId, String(b._id));
  }

  const bySlot = new Map();
  for (const req of requests) {
    if (!ACTIVE_STATUSES.includes(req.status)) continue;
    if (dateKeyFromInput(req.requestedDate) !== dateKey) continue;
    if (isRequestFullDay(req)) {
      for (const def of TIME_SLOTS) {
        if (!bySlot.has(def.id)) bySlot.set(def.id, []);
        bySlot.get(def.id).push({
          requestId: String(req._id),
          clientId: String(req.client),
          company: req.company || "",
          fullDay: true,
        });
      }
      continue;
    }
    const sid = effectiveSlotId(req);
    if (!sid) continue;
    if (!bySlot.has(sid)) bySlot.set(sid, []);
    bySlot.get(sid).push({
      requestId: String(req._id),
      clientId: String(req.client),
      company: req.company || "",
    });
  }

  const slots = TIME_SLOTS.map((def) => {
    const adminId = adminBlockIdBySlot.get(def.id) || null;
    const admin = Boolean(adminId);
    const bookings = bySlot.get(def.id) || [];
    const capacity = capacityForSlot(def.id, capacities);
    return {
      id: def.id,
      label: def.label,
      startTime: def.startTime,
      endTime: def.endTime,
      adminBlocked: admin,
      blockedSlotId: adminId,
      bookings,
      capacity,
      remaining: Math.max(0, capacity - bookings.length),
      free: !fullDay && !admin && bookings.length < capacity,
    };
  });

  return { date: dateKey, fullDayBlocked: fullDay, slots };
}

function monthAvailabilityWithSlots({
  month,
  year,
  clientType,
  blockedDates,
  blockedSlots,
  requests,
  p2cState,
  excludeRequestId,
  clientMonthClosed = false,
  capacities,
}) {
  const first = dayjs(`${year}-${String(month).padStart(2, "0")}-01`);
  const days = first.daysInMonth();
  const result = [];
  for (let i = 1; i <= days; i += 1) {
    const current = dayjs(`${year}-${String(month).padStart(2, "0")}-${String(i).padStart(2, "0")}`);
    const dateKey = current.format("YYYY-MM-DD");
    const dateObj = current.toDate();
    const past = isPastDate(dateObj);
    const inProfile = isWeekRuleAllowed({ date: dateObj, clientType });
    const weekBlockedByP2c = isWeekBlockedByP2c(dateObj, p2cState);
    const monthFullyBlocked = isMonthFullyBlockedForP2c(p2cState);
    const p2cQuotaFull = monthFullyBlocked;
    const fullDayBlocked = isFullDayBlocked(blockedDates, dateKey);
    const hasFreeSlot = hasAnyFreeSlot({
      dateKey,
      blockedDateDocs: blockedDates,
      blockedSlotDocs: blockedSlots,
      requests,
      excludeRequestId,
      capacities,
    });
    const fullDayAvailable =
      !past &&
      inProfile &&
      !monthFullyBlocked &&
      Boolean(p2cState?.canBookFullDay) &&
      isFullDayAvailable({
        dateKey,
        blockedDateDocs: blockedDates,
        blockedSlotDocs: blockedSlots,
        requests,
        excludeRequestId,
        capacities,
      });
    result.push({
      date: dateKey,
      /** Clic possible : profil + quota ; journée complète = tout le mois fermé */
      selectable:
        !clientMonthClosed && !past && inProfile && !monthFullyBlocked && !weekBlockedByP2c && hasFreeSlot,
      inProfile,
      isPast: past,
      weekBlockedByP2c,
      monthFullyBlocked,
      p2cQuotaFull,
      fullDayBlocked,
      hasFreeSlot,
      fullDayAvailable: clientMonthClosed ? false : fullDayAvailable,
      clientMonthClosed,
    });
  }
  return result;
}

module.exports = {
  TIME_SLOTS,
  SLOT_IDS,
  isValidSlotId,
  startTimeForSlot,
  slotIdFromLegacyTime,
  effectiveSlotId,
  requestOccupiesSlot,
  isFullDayAvailable,
  dateKeyFromInput,
  occupiedSlotsForDate,
  bookingCountsForDate,
  adminBlockedSlotsForDate,
  hasAnyFreeSlot,
  buildDaySlotsForClient,
  buildDaySlotsForAdmin,
  monthAvailabilityWithSlots,
  capacityForSlot,
  DEFAULT_SLOT_CAPACITY,
  ACTIVE_STATUSES,
  SLOT_LOCKING_STATUSES,
};
