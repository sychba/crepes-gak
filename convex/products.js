import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("products").collect();
  },
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("products").first();
    if (existing) {
      // If products exist but are old, let's delete them and re-seed
      // This is helpful for migrations!
      const all = await ctx.db.query("products").collect();
      for (const p of all) {
        await ctx.db.delete(p._id);
      }
    }

    const defaultProducts = [
      { id: 'base-crepe', name: 'Crepe', price: 2.00, category: 'Crepes', description: 'Frisch gebackener Crepe. Wähle deine Toppings selbst!', available: true },
      { id: 'base-waffel', name: 'Waffel', price: 2.00, category: 'Waffeln', description: 'Frische warme Herzwaffel. Wähle deine Toppings selbst!', available: true },
      { id: 'sandwich-cheese-ham', name: 'Käse-Schinken Sandwich', price: 3.00, category: 'Sandwiches', description: 'Knusprig getoastetes Sandwich mit viel geschmolzenem Käse und saftigem Schinken.', available: true },
      { id: 'drink-fritz-kola', name: 'Fritz-Kola 0.33l', price: 2.00, category: 'Getränke', description: 'Eiskalte Fritz-Kola für den Koffeinkick.', available: true },
      { id: 'drink-wasser', name: 'Wasser 0.5l', price: 1.50, category: 'Getränke', description: 'Spritziges oder stilles Mineralwasser.', available: true }
    ];

    for (const prod of defaultProducts) {
      await ctx.db.insert("products", prod);
    }

    return { success: true, message: "Products seeded successfully" };
  },
});
export const resetProducts = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("products").collect();
    for (const p of all) {
      await ctx.db.delete(p._id);
    }
    return { success: true };
  }
});
