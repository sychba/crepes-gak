import { NextResponse } from "next/server";

// POST: Apple Wallet sendet Debug-Logs an diesen Endpoint
export async function POST(request) {
  try {
    const body = await request.json();
    console.warn("APPLE WALLET DEVICE LOGS:", JSON.stringify(body, null, 2));
    return new Response("Empfangen", { status: 200 });
  } catch (err) {
    console.error("Fehler beim Verarbeiten des Apple-Logs:", err);
    return new Response("OK", { status: 200 }); // Immer 200 zurückliefern, um Apple-Fehlerschleifen zu vermeiden
  }
}
