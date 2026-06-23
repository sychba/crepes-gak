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
// Create a new order
export const create = mutation({
  args: {
    deviceId: v.string(),
    loyaltyCardId: v.optional(v.string()), // Optionaler Parameter für automatische Stempelkarte
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

      // 3. Enforce maximum 10 items per order for online orders
      const totalQty = args.items.reduce((sum, item) => sum + item.quantity, 0);
      if (totalQty > 10) {
        throw new Error("Maximal 10 Produkte pro Online-Bestellung erlaubt. Für größere Bestellungen bestelle bitte direkt vor Ort an der Kasse.");
      }
    }

    // Fetch all products to resolve details
    const products = await ctx.db.query("products").collect();

    // Map items to nested document with price and name at order time, flattening them
    const orderItems = [];
    for (const item of args.items) {
      const product = products.find((p) => p.id === item.productId);
      const basePrice = product ? product.price : 0.00;
      
      // Calculate toppings price: each selected topping adds +0.50 €
      const toppingsPrice = item.toppings ? item.toppings.length * 0.50 : 0.00;

      // Format product name to display selected toppings
      const toppingsLabel = item.toppings && item.toppings.length > 0
        ? ` (${item.toppings.join(", ")})`
        : "";

      let displayName = product ? product.name : "Unbekanntes Produkt";
      let displayCategory = product ? product.category : "";

      if (item.productId === 'base-crepe') {
        displayName = "Crepe";
        displayCategory = "Crepes";
      } else if (item.productId === 'base-waffel') {
        displayName = "Waffel";
        displayCategory = "Waffeln";
      }

      for (let i = 0; i < item.quantity; i++) {
        orderItems.push({
          productId: item.productId,
          productName: displayName + toppingsLabel,
          quantity: 1, // Flattened
          priceAtOrder: basePrice + toppingsPrice,
          toppings: item.toppings || [],
          status: "Neu", // Initialize item status
          category: displayCategory // Save category in order
        });
      }
    }

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
    let finalOrderItems = orderItems;
    let pushTokens = [];
    let stampsAdded = 0;

    if (args.loyaltyCardId) {
      // Zähle Crêpes im Warenkorb
      let crepeCount = 0;
      for (const item of orderItems) {
        if (item.category === "Crepes") {
          crepeCount += item.quantity;
        }
      }

      if (crepeCount > 0) {
        try {
          // Versuche die Karte zu laden
          const card = await ctx.db.get(args.loyaltyCardId);
          if (card) {
            const totalStamps = card.stamps + crepeCount;
            // Berechne Freicrêpes (jeder 5. Stempel ist gratis!)
            const redemptions = Math.floor(totalStamps / 5);
            const remainingStamps = totalStamps % 5;

            // Wenn wir einen Freicrêpe verdient haben, ziehen wir ihn vom Preis des teuersten Crêpes ab
            if (redemptions > 0) {
              const crepeItems = [];
              const nonCrepeItems = [];
              
              for (const item of orderItems) {
                if (item.category === "Crepes") {
                  for (let i = 0; i < item.quantity; i++) {
                    crepeItems.push({
                      ...item,
                      quantity: 1,
                    });
                  }
                } else {
                  nonCrepeItems.push(item);
                }
              }

              // Sortiere Crêpes nach Preis absteigend (um den teuersten gratis zu machen)
              crepeItems.sort((a, b) => b.priceAtOrder - a.priceAtOrder);

              // Wende den Rabatt auf die entsprechende Anzahl von Freicrêpes an
              for (let i = 0; i < Math.min(redemptions, crepeItems.length); i++) {
                crepeItems[i].priceAtOrder = 0.00;
                crepeItems[i].productName = crepeItems[i].productName + " (Treue-Rabatt: Gratis! 🎁)";
              }

              finalOrderItems = [...crepeItems, ...nonCrepeItems];
            }

            // Aktualisiere Stempelkarte
            await ctx.db.patch(card._id, {
              stamps: remainingStamps,
              redeemedCount: card.redeemedCount + redemptions,
              updatedAt: now,
            });

            stampsAdded = crepeCount;

            // Holt Registrierungen für Apple Wallet Pushes
            const registrations = await ctx.db
              .query("passRegistrations")
              .withIndex("by_serial", (q) => q.eq("serialNumber", card._id))
              .collect();
            pushTokens = registrations.map((r) => r.pushToken);
          }
        } catch (err) {
          console.error("Fehler bei der automatischen Stempelvergabe:", err);
        }
      }
    }

    // Get the next sequential order number
    const lastOrder = await ctx.db
      .query("orders")
      .order("desc")
      .first();
    const orderNumber = lastOrder && lastOrder.orderNumber ? lastOrder.orderNumber + 1 : 1;

    const newOrderId = await ctx.db.insert("orders", {
      id: code,
      orderNumber,
      deviceId: args.deviceId,
      loyaltyCardId: args.loyaltyCardId,
      customerName: args.customerName,
      customerClass: args.customerClass || "",
      status: "Neu",
      type: args.type,
      deliveryMethod: args.deliveryMethod || "Abholung",
      createdAt: now,
      updatedAt: now,
      items: finalOrderItems,
    });

    const orderDoc = await ctx.db.get(newOrderId);
    return {
      ...orderDoc,
      pushTokens,
      stampsAdded,
    };
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

// Update the status of a single item within an order
export const updateOrderItemStatus = mutation({
  args: {
    password: v.string(),
    ticketCode: v.string(),
    itemIndex: v.number(),
    status: v.string(), // "Neu" | "Zubereitung" | "Fertig"
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

    const items = [...order.items];
    if (args.itemIndex < 0 || args.itemIndex >= items.length) {
      throw new Error("Ungültiger Index.");
    }

    items[args.itemIndex] = {
      ...items[args.itemIndex],
      status: args.status,
      assignedTo: args.status === "Neu" ? undefined : items[args.itemIndex].assignedTo
    };

    // Calculate order's overall status based on item statuses
    let newStatus = order.status;
    
    // We check all items
    const itemStatuses = items.map(item => item.status || "Neu");
    const allFinished = itemStatuses.every(s => s === "Fertig");
    const anyPreparingOrFinished = itemStatuses.some(s => s === "Zubereitung" || s === "Fertig");

    if (allFinished) {
      newStatus = "Fertig";
    } else if (anyPreparingOrFinished) {
      newStatus = "Zubereitung";
    } else {
      newStatus = "Neu";
    }

    // Keep "Ausgeliefert" status if it was already checked out
    if (order.status === "Ausgeliefert") {
      newStatus = "Ausgeliefert";
    }

    await ctx.db.patch(order._id, {
      items,
      status: newStatus,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(order._id);
  },
});

// Claim a single item by an iPad station device
export const claimOrderItem = mutation({
  args: {
    password: v.string(),
    ticketCode: v.string(),
    itemIndex: v.number(),
    deviceId: v.string(),
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

    const items = [...order.items];
    if (args.itemIndex < 0 || args.itemIndex >= items.length) {
      throw new Error("Ungültiger Index.");
    }

    const item = items[args.itemIndex];
    if (item.assignedTo && item.assignedTo !== args.deviceId) {
      throw new Error("Dieses Produkt wird bereits an einer anderen Station zubereitet.");
    }

    items[args.itemIndex] = {
      ...item,
      status: "Zubereitung",
      assignedTo: args.deviceId
    };

    // Recalculate overall order status
    let newStatus = order.status;
    const itemStatuses = items.map(i => i.status || "Neu");
    const allFinished = itemStatuses.every(s => s === "Fertig");
    const anyPreparingOrFinished = itemStatuses.some(s => s === "Zubereitung" || s === "Fertig");

    if (allFinished) {
      newStatus = "Fertig";
    } else if (anyPreparingOrFinished) {
      newStatus = "Zubereitung";
    } else {
      newStatus = "Neu";
    }

    if (order.status === "Ausgeliefert") {
      newStatus = "Ausgeliefert";
    }

    await ctx.db.patch(order._id, {
      items,
      status: newStatus,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(order._id);
  },
});

// Send iPad device heartbeat to keep it active
export const heartbeat = mutation({
  args: {
    deviceId: v.string(),
    station: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("activeDevices")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .unique();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        lastSeen: now,
        station: args.station,
      });
    } else {
      await ctx.db.insert("activeDevices", {
        deviceId: args.deviceId,
        station: args.station,
        lastSeen: now,
      });
    }
    return { success: true };
  },
});

// Remove offline iPads (>20s stale) and release their tasks back to queue
export const releaseStaleTasks = mutation({
  args: { password: v.string() },
  handler: async (ctx, args) => {
    if (args.password !== "crepes2026") {
      throw new Error("Nicht autorisiert.");
    }

    const now = Date.now();
    const threshold = now - 20000; // 20 seconds stale threshold

    // Get all stale devices
    const staleDevices = await ctx.db
      .query("activeDevices")
      .collect();
    
    const staleDeviceIds = staleDevices
      .filter((d) => d.lastSeen < threshold)
      .map((d) => d.deviceId);

    if (staleDeviceIds.length === 0) {
      return { releasedCount: 0 };
    }

    // Get all active orders (Neu, Zubereitung, Fertig)
    const activeOrders = await ctx.db
      .query("orders")
      .collect();
    
    let releasedCount = 0;

    for (const order of activeOrders) {
      let orderModified = false;
      const updatedItems = order.items.map((item) => {
        if (item.assignedTo && staleDeviceIds.includes(item.assignedTo)) {
          orderModified = true;
          releasedCount++;
          return {
            ...item,
            status: "Neu", // Reset item back to queue
            assignedTo: undefined, // Clear assignment
          };
        }
        return item;
      });

      if (orderModified) {
        // Recalculate order's overall status based on item statuses
        let newStatus = order.status;
        const itemStatuses = updatedItems.map((item) => item.status || "Neu");
        const allFinished = itemStatuses.every((s) => s === "Fertig");
        const anyPreparingOrFinished = itemStatuses.some((s) => s === "Zubereitung" || s === "Fertig");

        if (allFinished) {
          newStatus = "Fertig";
        } else if (anyPreparingOrFinished) {
          newStatus = "Zubereitung";
        } else {
          newStatus = "Neu";
        }

        if (order.status === "Ausgeliefert") {
          newStatus = "Ausgeliefert";
        }

        await ctx.db.patch(order._id, {
          items: updatedItems,
          status: newStatus,
          updatedAt: now,
        });
      }
    }

    // Delete stale devices from activeDevices table
    const staleDeviceDocs = staleDevices.filter((d) => d.lastSeen < threshold);
    for (const doc of staleDeviceDocs) {
      await ctx.db.delete(doc._id);
    }

    return { releasedCount };
  },
});

// Release all tasks assigned to a specific device immediately (e.g. on exit)
export const releaseDeviceTasks = mutation({
  args: {
    password: v.string(),
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.password !== "crepes2026") {
      throw new Error("Nicht autorisiert.");
    }

    const now = Date.now();
    const activeOrders = await ctx.db.query("orders").collect();
    let releasedCount = 0;

    for (const order of activeOrders) {
      let orderModified = false;
      const updatedItems = order.items.map((item) => {
        if (item.assignedTo === args.deviceId) {
          orderModified = true;
          releasedCount++;
          return {
            ...item,
            status: "Neu",
            assignedTo: undefined,
          };
        }
        return item;
      });

      if (orderModified) {
        let newStatus = order.status;
        const itemStatuses = updatedItems.map((item) => item.status || "Neu");
        const allFinished = itemStatuses.every((s) => s === "Fertig");
        const anyPreparingOrFinished = itemStatuses.some((s) => s === "Zubereitung" || s === "Fertig");

        if (allFinished) {
          newStatus = "Fertig";
        } else if (anyPreparingOrFinished) {
          newStatus = "Zubereitung";
        } else {
          newStatus = "Neu";
        }

        if (order.status === "Ausgeliefert") {
          newStatus = "Ausgeliefert";
        }

        await ctx.db.patch(order._id, {
          items: updatedItems,
          status: newStatus,
          updatedAt: now,
        });
      }
    }

    // Delete device from activeDevices table
    const existing = await ctx.db
      .query("activeDevices")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return { releasedCount };
  },
});


