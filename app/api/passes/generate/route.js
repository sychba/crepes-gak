import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { generatePass } from "@/src/lib/passGenerator";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "https://knowing-gazelle-93.convex.cloud");

// Hilfsfunktion zur Darstellung einer schönen HTML-Fehlerseite auf Mobilgeräten
function htmlError(message, details = "") {
  return new Response(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Wallet Pass Fehler</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background: #23120b;
          color: #f7ebe1;
          text-align: center;
          padding: 2rem 1rem;
          margin: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 90vh;
        }
        .card {
          background: #2f1d15;
          border: 1px solid rgba(218, 165, 32, 0.25);
          padding: 2.5rem 1.5rem;
          border-radius: 16px;
          max-width: 440px;
          width: 100%;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          box-sizing: border-box;
        }
        .icon {
          font-size: 3rem;
          margin-bottom: 1rem;
          display: inline-block;
          animation: pulse 2s infinite;
        }
        h1 {
          color: #daa520;
          font-size: 1.4rem;
          margin: 0 0 1rem;
          font-weight: 800;
        }
        p {
          color: #cbb4a6;
          font-size: 0.95rem;
          line-height: 1.5;
          margin: 0 0 1.5rem;
        }
        .details {
          font-family: monospace;
          background: rgba(0, 0, 0, 0.3);
          padding: 0.85rem;
          border-radius: 8px;
          font-size: 0.78rem;
          color: #ff6b6b;
          text-align: left;
          word-break: break-all;
          white-space: pre-wrap;
          border-left: 3px solid #ff4a4a;
          margin-bottom: 1.5rem;
        }
        .btn {
          display: inline-block;
          background: #daa520;
          color: #23120b;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          text-decoration: none;
          font-weight: bold;
          font-size: 0.9rem;
          box-shadow: 0 4px 10px rgba(218, 165, 32, 0.2);
          transition: all 0.2s ease;
        }
        .btn:active {
          transform: scale(0.98);
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">⚠️</div>
        <h1>Pass-Erstellung fehlgeschlagen</h1>
        <p>${message}</p>
        ${details ? `<div class="details">${details}</div>` : ""}
        <a href="/loyalty" class="btn">Zurück zur Treuekarte</a>
      </div>
    </body>
    </html>
  `, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
    status: 200 // Return 200 so Safari redirects and displays the page correctly
  });
}

// GET /api/passes/generate?id=CARD_ID
// Generiert und liefert das .pkpass File für Apple Wallet
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const cardId = searchParams.get("id");
  const host = request.headers.get("host") || "localhost:3000";
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const baseUrl = `${protocol}://${host}`;

  if (!cardId) {
    return htmlError("Fehlende Karten-ID in der URL.", "Stelle bitte sicher, dass du die Treuekarte direkt über das Kunden-Dashboard geöffnet hast.");
  }

  try {
    // Hole Karte aus Convex
    const card = await convex.query(api.loyalty.getCard, { cardId });
    if (!card) {
      return htmlError("Die Treuekarte konnte im System nicht gefunden werden.", `Karten-ID: ${cardId}`);
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
    return htmlError(
      "Bei der Erstellung deines Apple Wallet Passes ist ein Fehler aufgetreten. Die Zertifikate auf dem Server sind wahrscheinlich nicht korrekt hinterlegt.",
      err.message
    );
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
