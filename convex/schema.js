import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  products: defineTable({
    id: v.string(), // E.g. "crepe-nutella"
    name: v.string(),
    price: v.number(),
    category: v.string(),
    description: v.string(),
    available: v.boolean(),
  }).index("by_product_id", ["id"]),

  orders: defineTable({
    id: v.string(), // E.g. "C-X39B" (ticket code)
    deviceId: v.optional(v.string()), // Device tracking identifier
    customerName: v.string(),
    customerClass: v.string(),
    status: v.string(), // "Neu" | "Zubereitung" | "Fertig" | "Ausgeliefert"
    type: v.string(), // "online" | "kasse"
    deliveryMethod: v.optional(v.string()), // "Abholung" | "Lieferung"
    createdAt: v.number(),
    updatedAt: v.number(),
    items: v.array(
      v.object({
        productId: v.string(),
        productName: v.string(),
        quantity: v.number(),
        priceAtOrder: v.number(),
        toppings: v.optional(v.array(v.string())), // Array of selected toppings
      })
    ),
  })
    .index("by_ticket_code", ["id"])
    .index("by_status", ["status"])
    .index("by_device", ["deviceId"]),

  blockedDevices: defineTable({
    deviceId: v.string(),
    blockedAt: v.number(),
  }).index("by_device", ["deviceId"]),

  loyaltyCards: defineTable({
    customerName: v.string(),
    stamps: v.number(), // 0 to 10
    authToken: v.string(), // Random authentication token for downloading pkpass
    redeemedCount: v.number(), // Number of times they redeemed their 10 stamps
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_token", ["authToken"]),

  passRegistrations: defineTable({
    serialNumber: v.string(), // ID of loyaltyCard
    deviceLibraryIdentifier: v.string(),
    pushToken: v.string(),
    createdAt: v.number(),
  })
    .index("by_serial", ["serialNumber"])
    .index("by_device_and_serial", ["deviceLibraryIdentifier", "serialNumber"])
    .index("by_device", ["deviceLibraryIdentifier"])
});
