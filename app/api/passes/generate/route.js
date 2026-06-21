import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { generatePass } from "@/src/lib/passGenerator";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "https://knowing-gazelle-93.convex.cloud");

// GET /api/passes/generate?id=CARD_ID
// Generiert und liefert das .pkpass File für Apple Wallet
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const cardId = searchParams.get("id");
  const host = request.headers.get("host") || "localhost:3000";
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const baseUrl = `${protocol}://${host}`;

  if (!cardId) {
    return NextResponse.json({ error: "Fehlende ID" }, { status: 400 });
  }

  try {
    // Hole Karte aus Convex
    const card = await convex.query(api.loyalty.getCard, { cardId });
    if (!card) {
      return NextResponse.json({ error: "Treuekarte nicht gefunden" }, { status: 404 });
    }

    // Generiere das Apple Wallet Pass Binary
    const passBuffer = await generatePass({
      cardId: card._id,
      customerName: card.customerName,
      stamps: card.stamps,
      authToken: card.authToken,
      baseUrl,
    });

    return new Response(passBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="treuekarte.pkpass"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (err) {
    console.error("Fehler bei Pass-Generierung:", err);
    return NextResponse.json({ error: "Interner Fehler bei der Pass-Erstellung" }, { status: 500 });
  }
}

// POST /api/passes/generate
// Erstellt eine neue Treuekarte im Convex Backend
export async function POST(request) {
  try {
    const body = await request.json();
    const { customerName, authToken } = body;

    if (!customerName || !authToken) {
      return NextResponse.json({ error: "Parameter customerName und authToken erforderlich" }, { status: 400 });
    }

    const cardId = await convex.mutation(api.loyalty.createCard, { customerName, authToken });
    return NextResponse.json({ cardId });
  } catch (err) {
    console.error("Fehler beim Erstellen der Treuekarte:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
