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
      // Base items (hidden helper products for calculations)
      { id: 'base-crepe', name: 'Crepe Basis', price: 2.00, category: 'System', description: 'Basis für Berechnungen.', available: false },
      { id: 'base-waffel', name: 'Waffel Basis', price: 2.00, category: 'System', description: 'Basis für Berechnungen.', available: false },

      // Crepes
      { id: 'crepe-plain', name: 'Crepe Naturell', price: 2.00, category: 'Crepes', description: 'Frisch gebackener Crepe ohne Aufstrich – bereit zum selbst Gestalten mit deinen Wunsch-Toppings.', available: true },
      { id: 'crepe-nutella', name: 'Crepe Nutella', price: 2.50, category: 'Crepes', description: 'Mit leckerem original Nutella-Aufstrich.', available: true },
      { id: 'crepe-zimt-zucker', name: 'Crepe Zimt & Zucker', price: 2.50, category: 'Crepes', description: 'Der Klassiker mit Zimt und feinem Zucker.', available: true },
      { id: 'crepe-puderzucker', name: 'Crepe Puderzucker', price: 2.50, category: 'Crepes', description: 'Mit feinem Puderzucker bestäubt.', available: true },
      { id: 'crepe-apfelmus', name: 'Crepe Apfelmus', price: 2.50, category: 'Crepes', description: 'Frisch gebackener Crepe mit feinem Apfelmus-Aufstrich.', available: true },
      { id: 'crepe-kaese-schinken', name: 'Crepe Käse & Schinken', price: 3.00, category: 'Crepes', description: 'Herzhafter Crepe mit geschmolzenem Käse und saftigem Schinken.', available: true },

      // Waffeln
      { id: 'waffel-plain', name: 'Waffel Naturell', price: 2.00, category: 'Waffeln', description: 'Frische warme Herzwaffel ohne Toppings – bereit zum selbst Gestalten mit deinen Wunsch-Toppings.', available: true },
      { id: 'waffel-nutella', name: 'Waffel Nutella', price: 2.50, category: 'Waffeln', description: 'Warme Herzwaffel mit cremigem Nutella.', available: true },
      { id: 'waffel-zimt-zucker', name: 'Waffel Zimt & Zucker', price: 2.50, category: 'Waffeln', description: 'Warme Herzwaffel mit Zimt und Zucker.', available: true },
      { id: 'waffel-puderzucker', name: 'Waffel Puderzucker', price: 2.50, category: 'Waffeln', description: 'Warme Herzwaffel mit feinem Puderzucker.', available: true },
      { id: 'waffel-apfelmus', name: 'Waffel Apfelmus', price: 2.50, category: 'Waffeln', description: 'Warme Herzwaffel mit feinem Apfelmus.', available: true },

      // Sandwiches
      { id: 'sandwich-cheese', name: 'Käse Sandwich', price: 2.50, category: 'Sandwiches', description: 'Knusprig getoastetes Sandwich mit viel geschmolzenem Käse.', available: true },
      { id: 'sandwich-ham', name: 'Schinken Sandwich', price: 2.50, category: 'Sandwiches', description: 'Knusprig getoastetes Sandwich mit saftigem Schinken.', available: true },
      { id: 'sandwich-cheese-ham', name: 'Käse-Schinken Sandwich', price: 3.00, category: 'Sandwiches', description: 'Knusprig getoastetes Sandwich mit viel geschmolzenem Käse und saftigem Schinken.', available: true },
      { id: 'sandwich-schoko', name: 'Schoko Sandwich', price: 2.50, category: 'Sandwiches', description: 'Knusprig getoastetes Sandwich gefüllt mit cremigem Nutella.', available: true },
      { id: 'sandwich-schoko-banane', name: 'Schoko-Banane Sandwich', price: 3.00, category: 'Sandwiches', description: 'Knusprig getoastetes Sandwich mit warmem Nutella und süßen Bananenscheiben.', available: true }
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
