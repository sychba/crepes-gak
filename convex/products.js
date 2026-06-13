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
      return { success: true, message: "Products already seeded" };
    }

    const defaultProducts = [
      { id: 'crepe-nutella', name: 'Crepe Nutella', price: 3.00, category: 'Crepes Süß', description: 'Mit leckerem original Nutella-Aufstrich.', available: true },
      { id: 'crepe-zimt-zucker', name: 'Crepe Zimt & Zucker', price: 2.50, category: 'Crepes Süß', description: 'Der Klassiker mit Zimt und feinem Zucker.', available: true },
      { id: 'crepe-apfelmus', name: 'Crepe Apfelmus', price: 3.00, category: 'Crepes Süß', description: 'Mit fruchtigem Apfelmus.', available: true },
      { id: 'crepe-banane-nutella', name: 'Crepe Banane & Nutella', price: 3.50, category: 'Crepes Süß', description: 'Süße Bananenscheiben mit viel Nutella.', available: true },
      { id: 'crepe-kaese', name: 'Crepe Käse', price: 3.00, category: 'Crepes Herzhaft', description: 'Geschmolzener geriebener Käse.', available: true },
      { id: 'crepe-schinken-kaese', name: 'Crepe Schinken & Käse', price: 3.50, category: 'Crepes Herzhaft', description: 'Saftiger Vorderschinken mit geschmolzenem Käse.', available: true },
      { id: 'drink-fritz-kola', name: 'Fritz-Kola 0.33l', price: 2.00, category: 'Getränke', description: 'Eiskalte Fritz-Kola für den Koffeinkick.', available: true },
      { id: 'drink-wasser', name: 'Wasser 0.5l', price: 1.50, category: 'Getränke', description: 'Spritziges oder stilles Mineralwasser.', available: true }
    ];

    for (const prod of defaultProducts) {
      await ctx.db.insert("products", prod);
    }

    return { success: true, message: "Products seeded successfully" };
  },
});
