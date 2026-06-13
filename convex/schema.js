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
    customerName: v.string(),
    customerClass: v.string(),
    status: v.string(), // "Neu" | "Zubereitung" | "Fertig" | "Ausgeliefert"
    type: v.string(), // "online" | "kasse"
    createdAt: v.number(),
    updatedAt: v.number(),
    items: v.array(
      v.object({
        productId: v.string(),
        productName: v.string(),
        quantity: v.number(),
        priceAtOrder: v.number(),
      })
    ),
  })
    .index("by_ticket_code", ["id"])
    .index("by_status", ["status"])
});
