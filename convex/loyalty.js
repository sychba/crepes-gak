import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Erstellt eine neue Treuekarte für einen Kunden
export const createCard = mutation({
  args: {
    customerName: v.string(),
    authToken: v.string(),
  },
  handler: async (ctx, args) => {
    const cardId = await ctx.db.insert("loyaltyCards", {
      customerName: args.customerName,
      stamps: 0,
      authToken: args.authToken,
      redeemedCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return cardId;
  },
});

// Holt eine Treuekarte über ihre ID
export const getCard = query({
  args: { cardId: v.id("loyaltyCards") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.cardId);
  },
});

// Holt eine Treuekarte über ihr Auth-Token (zur Verifizierung beim Download)
export const getCardByAuth = query({
  args: { authToken: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("loyaltyCards")
      .withIndex("by_token", (q) => q.eq("authToken", args.authToken))
      .unique();
  },
});

// Fügt einer Karte einen Stempel hinzu (+1)
export const addStamp = mutation({
  args: { cardId: v.id("loyaltyCards") },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (!card) {
      throw new Error("Stempelkarte nicht gefunden");
    }
    if (card.stamps >= 10) {
      throw new Error("Karte ist bereits voll (10 Stempel). Bitte erst einlösen.");
    }

    const newStamps = card.stamps + 1;
    await ctx.db.patch(args.cardId, {
      stamps: newStamps,
      updatedAt: Date.now(),
    });

    // Holt registrierte Apple-Geräte für diese Karte, um Pushes auszulösen
    const registrations = await ctx.db
      .query("passRegistrations")
      .withIndex("by_serial", (q) => q.eq("serialNumber", args.cardId))
      .collect();

    return {
      cardId: args.cardId,
      stamps: newStamps,
      pushTokens: registrations.map((r) => r.pushToken),
    };
  },
});

// Löst die Belohnung ein (setzt Stempel auf 0 zurück)
export const redeemCard = mutation({
  args: { cardId: v.id("loyaltyCards") },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (!card) {
      throw new Error("Stempelkarte nicht gefunden");
    }
    if (card.stamps < 10) {
      throw new Error("Karte hat noch keine 10 Stempel.");
    }

    await ctx.db.patch(args.cardId, {
      stamps: 0,
      redeemedCount: card.redeemedCount + 1,
      updatedAt: Date.now(),
    });

    // Holt registrierte Apple-Geräte für diese Karte, um Pushes auszulösen
    const registrations = await ctx.db
      .query("passRegistrations")
      .withIndex("by_serial", (q) => q.eq("serialNumber", args.cardId))
      .collect();

    return {
      cardId: args.cardId,
      stamps: 0,
      pushTokens: registrations.map((r) => r.pushToken),
    };
  },
});

// Registriert ein Apple-Gerät (iOS Web Service API)
export const registerDevice = mutation({
  args: {
    serialNumber: v.string(),
    deviceLibraryIdentifier: v.string(),
    pushToken: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("passRegistrations")
      .withIndex("by_device_and_serial", (q) =>
        q
          .eq("deviceLibraryIdentifier", args.deviceLibraryIdentifier)
          .eq("serialNumber", args.serialNumber)
      )
      .unique();

    if (existing) {
      if (existing.pushToken !== args.pushToken) {
        await ctx.db.patch(existing._id, {
          pushToken: args.pushToken,
        });
      }
      return existing._id;
    }

    return await ctx.db.insert("passRegistrations", {
      serialNumber: args.serialNumber,
      deviceLibraryIdentifier: args.deviceLibraryIdentifier,
      pushToken: args.pushToken,
      createdAt: Date.now(),
    });
  },
});

// Entfernt die Registrierung eines Apple-Geräts
export const unregisterDevice = mutation({
  args: {
    serialNumber: v.string(),
    deviceLibraryIdentifier: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("passRegistrations")
      .withIndex("by_device_and_serial", (q) =>
        q
          .eq("deviceLibraryIdentifier", args.deviceLibraryIdentifier)
          .eq("serialNumber", args.serialNumber)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return true;
    }
    return false;
  },
});

// Liefert alle registrierten Geräte für eine Karte
export const getRegistrations = query({
  args: { serialNumber: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("passRegistrations")
      .withIndex("by_serial", (q) => q.eq("serialNumber", args.serialNumber))
      .collect();
  },
});

// Liefert geänderte Seriennummern für ein Gerät
export const getUpdatedSerials = query({
  args: {
    deviceLibraryIdentifier: v.string(),
    passesUpdatedSince: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const regs = await ctx.db
      .query("passRegistrations")
      .withIndex("by_device", (q) =>
        q.eq("deviceLibraryIdentifier", args.deviceLibraryIdentifier)
      )
      .collect();

    const serialNumbers = [];
    let latestUpdated = 0;

    for (const reg of regs) {
      // Da serialNumber ein string ist (und wir loyaltyCards IDs prüfen)
      try {
        const card = await ctx.db.get(reg.serialNumber);
        if (card) {
          latestUpdated = Math.max(latestUpdated, card.updatedAt);
          if (args.passesUpdatedSince) {
            const sinceTime = parseInt(args.passesUpdatedSince, 10);
            if (isNaN(sinceTime) || card.updatedAt > sinceTime) {
              serialNumbers.push(reg.serialNumber);
            }
          } else {
            serialNumbers.push(reg.serialNumber);
          }
        }
      } catch (err) {
        console.error("Fehler beim Abrufen der Karte:", reg.serialNumber, err);
      }
    }

    return {
      serialNumbers,
      lastUpdated: latestUpdated.toString(),
    };
  },
});
