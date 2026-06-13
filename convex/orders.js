import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get all orders (for staff, requires credentials)
export const listAll = query({
  args: { password: v.string() },
  handler: async (ctx, args) => {
    if (args.password !== "crepes2026") {
      throw new Error("Nicht autorisiert. Falsches Passwort.");
    }
    
    const orders = await ctx.db.query("orders").collect();

    // Sort orders:
    // 1. Status priority (Neu -> Zubereitung -> Fertig -> Ausgeliefert)
    // 2. Within Neu: oldest first (createdAt ASC)
    // 3. Within others: newest first (createdAt DESC)
    return orders.sort((a, b) => {
      const statusPriority = {
        'Neu': 1,
        'Zubereitung': 2,
        'Fertig': 3,
        'Ausgeliefert': 4
      };

      const priorityA = statusPriority[a.status] || 5;
      const priorityB = statusPriority[b.status] || 5;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      if (a.status === 'Neu') {
        return a.createdAt - b.createdAt; // oldest first
      } else {
        return b.createdAt - a.createdAt; // newest first
      }
    });
  },
});

// Get single order details (public, for invoice page)
export const get = query({
  args: { ticketCode: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("orders")
      .withIndex("by_ticket_code", (q) => q.eq("id", args.ticketCode))
      .unique();
  },
});

// Create a new order
export const create = mutation({
  args: {
    customerName: v.string(),
    customerClass: v.string(),
    type: v.string(), // 'online' | 'kasse'
    items: v.array(
      v.object({
        productId: v.string(),
        quantity: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Fetch all products to resolve details
    const products = await ctx.db.query("products").collect();

    // Map items to nested document with price and name at order time
    const orderItems = args.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      return {
        productId: item.productId,
        productName: product ? product.name : "Unbekanntes Produkt",
        quantity: item.quantity,
        priceAtOrder: product ? product.price : 0.00,
      };
    });

    // Generate ticket code (C-XXXX)
    const generateCode = () => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code = "";
      for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return `C-${code}`;
    };

    let code = generateCode();

    // Check uniqueness
    let existing = await ctx.db
      .query("orders")
      .withIndex("by_ticket_code", (q) => q.eq("id", code))
      .unique();

    while (existing) {
      code = generateCode();
      existing = await ctx.db
        .query("orders")
        .withIndex("by_ticket_code", (q) => q.eq("id", code))
        .unique();
    }

    const now = Date.now();
    const newOrderId = await ctx.db.insert("orders", {
      id: code,
      customerName: args.customerName,
      customerClass: args.customerClass || "",
      status: "Neu",
      type: args.type,
      createdAt: now,
      updatedAt: now,
      items: orderItems,
    });

    return await ctx.db.get(newOrderId);
  },
});

// Update order status (staff only)
export const updateStatus = mutation({
  args: {
    password: v.string(),
    ticketCode: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.password !== "crepes2026") {
      throw new Error("Nicht autorisiert. Falsches Passwort.");
    }

    const validStatuses = ['Neu', 'Zubereitung', 'Fertig', 'Ausgeliefert'];
    if (!validStatuses.includes(args.status)) {
      throw new Error("Ungültiger Status.");
    }

    const order = await ctx.db
      .query("orders")
      .withIndex("by_ticket_code", (q) => q.eq("id", args.ticketCode))
      .unique();

    if (!order) {
      throw new Error("Bestellung nicht gefunden.");
    }

    await ctx.db.patch(order._id, {
      status: args.status,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(order._id);
  },
});

// Cancel/Delete order (staff only)
export const deleteOrder = mutation({
  args: {
    password: v.string(),
    ticketCode: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.password !== "crepes2026") {
      throw new Error("Nicht autorisiert. Falsches Passwort.");
    }

    const order = await ctx.db
      .query("orders")
      .withIndex("by_ticket_code", (q) => q.eq("id", args.ticketCode))
      .unique();

    if (!order) {
      throw new Error("Bestellung nicht gefunden.");
    }

    await ctx.db.delete(order._id);
    return { success: true };
  },
});
