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
    deviceId: v.string(),
    customerName: v.string(),
    customerClass: v.string(),
    type: v.string(), // 'online' | 'kasse'
    deliveryMethod: v.optional(v.string()), // 'Abholung' | 'Lieferung'
    items: v.array(
      v.object({
        productId: v.string(),
        quantity: v.number(),
        toppings: v.optional(v.array(v.string())), // Selected toppings
      })
    ),
  },
  handler: async (ctx, args) => {
    // 1. Check if device is blocked
    const isBlocked = await ctx.db
      .query("blockedDevices")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .unique();
    if (isBlocked) {
      throw new Error("Dieses Gerät wurde für weitere Bestellungen gesperrt. Bitte wende dich an das Personal.");
    }

    // 2. For online orders, enforce active order check and anti-spam limit (max 1 order per hour)
    if (args.type === 'online') {
      const deviceOrders = await ctx.db
        .query("orders")
        .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
        .collect();

      const activeOrder = deviceOrders.find(
        (o) => o.status === 'Neu' || o.status === 'Zubereitung' || o.status === 'Fertig'
      );
      if (activeOrder) {
        throw new Error("Du hast bereits eine aktive Bestellung. Für weitere Bestellungen bestelle bitte direkt vor Ort an der Kasse.");
      }

      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const recentOrders = deviceOrders.filter((o) => o.createdAt > oneHourAgo);

      if (recentOrders.length >= 1) {
        throw new Error("Du hast bereits online bestellt. Für weitere Bestellungen bestelle bitte direkt vor Ort an der Kasse (Limit: 1 Online-Bestellung pro Stunde).");
      }

      // 3. Enforce maximum 10 non-water items per order for online orders
      const nonWaterQty = args.items.reduce((sum, item) => {
        return item.productId !== 'drink-wasser' ? sum + item.quantity : sum;
      }, 0);
      if (nonWaterQty > 10) {
        throw new Error("Maximal 10 Produkte pro Online-Bestellung erlaubt. Für größere Bestellungen bestelle bitte direkt vor Ort an der Kasse.");
      }
    }

    // Fetch all products to resolve details
    const products = await ctx.db.query("products").collect();

    // Map items to nested document with price and name at order time
    const orderItems = args.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      const basePrice = product ? product.price : 0.00;
      
      // Calculate toppings price: each selected topping adds +0.50 €
      const toppingsPrice = item.toppings ? item.toppings.length * 0.50 : 0.00;

      // Format product name to display selected toppings
      const toppingsLabel = item.toppings && item.toppings.length > 0
        ? ` (${item.toppings.join(", ")})`
        : "";

      return {
        productId: item.productId,
        productName: (product ? product.name : "Unbekanntes Produkt") + toppingsLabel,
        quantity: item.quantity,
        priceAtOrder: basePrice + toppingsPrice,
        toppings: item.toppings || []
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
      deviceId: args.deviceId,
      customerName: args.customerName,
      customerClass: args.customerClass || "",
      status: "Neu",
      type: args.type,
      deliveryMethod: args.deliveryMethod || "Abholung",
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

// List all devices and order metadata for moderation (staff only)
export const listDevices = query({
  args: { password: v.string() },
  handler: async (ctx, args) => {
    if (args.password !== "crepes2026") {
      throw new Error("Nicht autorisiert. Falsches Passwort.");
    }

    const allOrders = await ctx.db.query("orders").collect();
    const allBlocked = await ctx.db.query("blockedDevices").collect();
    const blockedSet = new Set(allBlocked.map((b) => b.deviceId));

    const deviceMap = {};
    for (const order of allOrders) {
      const devId = order.deviceId;
      if (!devId) continue;
      
      if (!deviceMap[devId]) {
        deviceMap[devId] = {
          deviceId: devId,
          customerNames: new Set(),
          orderCount: 0,
          lastOrderAt: 0,
          blocked: blockedSet.has(devId)
        };
      }
      
      deviceMap[devId].customerNames.add(order.customerName);
      deviceMap[devId].orderCount += 1;
      if (order.createdAt > deviceMap[devId].lastOrderAt) {
        deviceMap[devId].lastOrderAt = order.createdAt;
      }
    }

    // Include blocked devices that might not have any orders (edge case)
    for (const blocked of allBlocked) {
      if (!deviceMap[blocked.deviceId]) {
        deviceMap[blocked.deviceId] = {
          deviceId: blocked.deviceId,
          customerNames: new Set(["(Keine Bestellungen)"]),
          orderCount: 0,
          lastOrderAt: blocked.blockedAt,
          blocked: true
        };
      }
    }

    return Object.values(deviceMap)
      .map((dev) => ({
        deviceId: dev.deviceId,
        customerNames: Array.from(dev.customerNames).join(", "),
        orderCount: dev.orderCount,
        lastOrderAt: dev.lastOrderAt,
        blocked: dev.blocked
      }))
      .sort((a, b) => b.lastOrderAt - a.lastOrderAt);
  },
});

// Toggle block on device (staff only)
export const toggleDeviceBlock = mutation({
  args: {
    password: v.string(),
    deviceId: v.string(),
    blocked: v.boolean()
  },
  handler: async (ctx, args) => {
    if (args.password !== "crepes2026") {
      throw new Error("Nicht autorisiert. Falsches Passwort.");
    }

    const existing = await ctx.db
      .query("blockedDevices")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .unique();

    if (args.blocked && !existing) {
      await ctx.db.insert("blockedDevices", {
        deviceId: args.deviceId,
        blockedAt: Date.now()
      });
    } else if (!args.blocked && existing) {
      await ctx.db.delete(existing._id);
    }
    
    return { success: true };
  },
});

// Check if a device has an active order or recent order (last 60 mins)
export const checkActiveOrRecentOrder = query({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    if (!args.deviceId) {
      return { status: "ok" };
    }

    // 1. Check if blocked
    const isBlocked = await ctx.db
      .query("blockedDevices")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .unique();
    if (isBlocked) {
      return { status: "blocked" };
    }

    const deviceOrders = await ctx.db
      .query("orders")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .collect();

    // Check active
    const activeOrder = deviceOrders.find(
      (o) => o.status === 'Neu' || o.status === 'Zubereitung' || o.status === 'Fertig'
    );
    if (activeOrder) {
      return { status: "active", ticketCode: activeOrder.id, orderStatus: activeOrder.status };
    }

    // Check cooldown (60 minutes)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentOrders = deviceOrders.filter((o) => o.createdAt > oneHourAgo);
    if (recentOrders.length > 0) {
      const sorted = recentOrders.sort((a, b) => b.createdAt - a.createdAt);
      const lastOrderTime = sorted[0].createdAt;
      const nextAllowed = lastOrderTime + 60 * 60 * 1000;
      const remainingMs = nextAllowed - Date.now();
      return {
        status: "cooldown",
        remainingMinutes: Math.max(1, Math.ceil(remainingMs / 60000))
      };
    }

    return { status: "ok" };
  }
});
