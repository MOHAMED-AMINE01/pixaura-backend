const mongoose = require("mongoose");

/**
 * Capacité (nombre de clients/vidéastes) par créneau.
 * Un document par slotId. Si aucun document n'existe pour un créneau,
 * la capacité par défaut (DEFAULT_SLOT_CAPACITY) s'applique.
 */
const slotCapacitySchema = new mongoose.Schema(
  {
    slotId: { type: String, required: true, unique: true },
    capacity: { type: Number, required: true, min: 1, default: 2 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SlotCapacity", slotCapacitySchema);
