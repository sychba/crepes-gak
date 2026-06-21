import { NextResponse } from "next/server";
import http2 from "http2";

// Helper zum Senden einer HTTP/2 Push-Anforderung an APNs
function sendApnsPush(pushToken, certPem, keyPem, topic, useSandbox = true) {
  return new Promise((resolve, reject) => {
    const host = useSandbox
      ? "api.development.push.apple.com"
      : "api.push.apple.com";

    try {
      const client = http2.connect(`https://${host}:443`, {
        key: keyPem,
        cert: certPem,
      });

      client.on("error", (err) => {
        console.error("APNs Client Verbindungsfehler:", err);
        resolve({ success: false, token: pushToken, error: err.message });
      });

      // Apple Wallet verlangt einen leeren JSON-Body "{}" für Updates
      const payload = JSON.stringify({});

      const req = client.request({
        ":method": "POST",
        ":path": `/3/device/${pushToken}`,
        "apns-topic": topic,
        "apns-expiration": "0",
        "apns-priority": "10",
        "content-length": Buffer.byteLength(payload),
      });

      let responseData = "";

      req.on("response", (headers) => {
        const status = headers[":status"];
        
        req.on("data", (chunk) => {
          responseData += chunk;
        });

        req.on("end", () => {
          client.close();
          if (status === 200) {
            resolve({ success: true, token: pushToken });
          } else {
            resolve({
              success: false,
              token: pushToken,
              status,
              error: responseData || `HTTP Status ${status}`,
            });
          }
        });
      });

      req.on("error", (err) => {
        client.close();
        resolve({ success: false, token: pushToken, error: err.message });
      });

      req.write(payload);
      req.end();
    } catch (err) {
      resolve({ success: false, token: pushToken, error: err.message });
    }
  });
}

// POST /api/passes/push
// Wird vom Scanner aufgerufen, wenn Stempel geupdatet wurden
export async function POST(request) {
  try {
    const body = await request.json();
    const { pushTokens } = body;

    if (!pushTokens || !Array.isArray(pushTokens) || pushTokens.length === 0) {
      return NextResponse.json({ error: "pushTokens erforderlich (Array)" }, { status: 400 });
    }

    const cert = process.env.APPLE_PASS_CERTIFICATE;
    const key = process.env.APPLE_PASS_PRIVATE_KEY;
    const topic = process.env.APPLE_PASS_TYPE_ID || "pass.com.crepes.loyalty";

    if (!cert || !key) {
      console.warn(
        "Zertifikate fehlen. Überspringe echten APNs Push (Entwicklungs-/Mock-Modus)."
      );
      return NextResponse.json({
        message: "Pushes übersprungen (Zertifikate fehlen), Mock-Modus aktiv.",
        pushedCount: 0,
      });
    }

    const useSandbox = process.env.NODE_ENV !== "production";
    
    // Sende Pushes parallel an alle registrierten Geräte des Kunden
    const pushPromises = pushTokens.map((token) =>
      sendApnsPush(token, cert, key, topic, useSandbox)
    );

    const results = await Promise.all(pushPromises);
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    console.log(`APNs Pushes gesendet. Erfolgreich: ${successful.length}, Fehlgeschlagen: ${failed.length}`);
    if (failed.length > 0) {
      console.warn("APNs Fehlerdetails:", failed);
    }

    return NextResponse.json({
      success: true,
      pushedCount: successful.length,
      failedCount: failed.length,
      results,
    });
  } catch (err) {
    console.error("Fehler beim Verarbeiten des Pushes:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
