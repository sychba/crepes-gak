import fs from "fs";
import path from "path";
import crypto from "crypto";
import JSZip from "jszip";
import forge from "node-forge";

// Hilfsfunktion zur Erstellung der SHA-1 Hashes für das Manifest
function sha1Hash(data) {
  return crypto.createHash("sha1").update(data).digest("hex");
}

// Hilfsfunktion zur PKCS#7-Signierung des Manifests mittels node-forge
function signManifest(manifestContent, certificatePem, privateKeyPem, wwdrPem) {
  try {
    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(manifestContent, "utf8");

    const certObj = forge.pki.certificateFromPem(certificatePem);
    const keyObj = forge.pki.privateKeyFromPem(privateKeyPem);
    const wwdrObj = forge.pki.certificateFromPem(wwdrPem);

    p7.addCertificate(certObj);
    p7.addCertificate(wwdrObj);

    p7.addSigner({
      key: keyObj,
      certificate: certObj,
      digestAlgorithm: forge.pki.oids.sha1,
      authenticatedAttributes: [
        {
          type: forge.pki.oids.contentType,
          value: forge.pki.oids.data,
        },
        {
          type: forge.pki.oids.messageDigest,
        },
        {
          type: forge.pki.oids.signingTime,
          value: new Date(),
        },
      ],
    });

    p7.sign();
    const asn1 = p7.toAsn1();
    const der = forge.asn1.toDer(asn1).getBytes();
    return Buffer.from(der, "binary");
  } catch (err) {
    console.error("Fehler bei der Signierung des Manifests:", err);
    throw err;
  }
}

/**
 * Generiert die binäre PkPass-Datei (.zip) für die Apple Wallet
 */
export async function generatePass({ cardId, customerName, stamps, authToken, baseUrl }) {
  const zip = new JSZip();

  // 1. pass.json zusammenstellen
  const passTypeIdentifier = process.env.APPLE_PASS_TYPE_ID || "pass.com.crepes.loyalty";
  const teamIdentifier = process.env.APPLE_TEAM_ID || "GAKTEAM123";
  
  // Apple Wallet Web Service URL (ohne abschließenden Slash, Apple hängt /v1/... an)
  const webServiceURL = `${baseUrl}/api/passes`;

  // Loyalty QR-Code Link
  const qrCodeLink = `${baseUrl}/loyalty?id=${cardId}`;

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: passTypeIdentifier,
    serialNumber: cardId,
    teamIdentifier: teamIdentifier,
    webServiceURL: webServiceURL,
    authenticationToken: authToken,
    barcode: {
      message: qrCodeLink,
      format: "PKBarcodeFormatQR",
      messageEncoding: "iso-8859-1",
      altText: `ID: ${cardId}`,
    },
    organizationName: "Crêpes GAK",
    description: "Crêpes GAK Treuekarte",
    logoText: "Crêpes GAK",
    foregroundColor: "rgb(255, 255, 255)",      // Weißer Text
    backgroundColor: "rgb(42, 24, 16)",         // Dunkelbrauner Hintergrund
    labelColor: "rgb(218, 165, 32)",            // Goldene Labels
    storeCard: {
      primaryFields: [
        {
          key: "stamps",
          label: "Stempel",
          value: stamps === 10 ? "🎁 Voll!" : `${stamps} von 10`,
        },
      ],
      secondaryFields: [
        {
          key: "customerName",
          label: "Kunde",
          value: customerName,
        },
      ],
      auxiliaryFields: [
        {
          key: "status",
          label: "Status",
          value: stamps === 10 ? "Gratis Crêpe einlösen!" : "Sammeln...",
        },
      ],
      backFields: [
        {
          key: "terms",
          label: "Nutzungsbedingungen",
          value: "Für jeden gekauften Crêpe am Crêpes-GAK-Stand gibt es einen Stempel. Bei 10 Stempeln erhältst du deinen 10. (oder nächsten) Crêpe gratis. Nach dem Einlösen wird die Karte automatisch wieder auf 0 gesetzt.",
        },
        {
          key: "contact",
          label: "Bestellungen & Info",
          value: `Deine Treuekarten-ID: ${cardId}\nBesuche uns online unter ${baseUrl} für Bestellungen und Standorte.`,
        },
      ],
    },
  };

  const passJsonBuffer = Buffer.from(JSON.stringify(passJson, null, 2), "utf8");
  zip.file("pass.json", passJsonBuffer);

  // 2. Bilder einlesen
  const publicPassDir = path.join(process.cwd(), "public", "pass");
  
  const filesToHash = {
    "pass.json": passJsonBuffer,
  };

  const imageFiles = ["icon.png", "logo.png", "strip.png"];
  
  for (const filename of imageFiles) {
    const filePath = path.join(publicPassDir, filename);
    if (fs.existsSync(filePath)) {
      const fileBuffer = fs.readFileSync(filePath);
      zip.file(filename, fileBuffer);
      filesToHash[filename] = fileBuffer;

      // Optional: @2x Versionen kopieren falls vorhanden
      const doubleName = filename.replace(".png", "@2x.png");
      const doublePath = path.join(publicPassDir, doubleName);
      if (fs.existsSync(doublePath)) {
        const doubleBuffer = fs.readFileSync(doublePath);
        zip.file(doubleName, doubleBuffer);
        filesToHash[doubleName] = doubleBuffer;
      }
    }
  }

  // 3. manifest.json erstellen (SHA-1 aller Dateien)
  const manifest = {};
  for (const [filename, buffer] of Object.entries(filesToHash)) {
    manifest[filename] = sha1Hash(buffer);
  }

  const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2), "utf8");
  zip.file("manifest.json", manifestBuffer);

  // 4. Signatur erstellen (wenn Zertifikate vorhanden sind)
  const cert = process.env.APPLE_PASS_CERTIFICATE;
  const key = process.env.APPLE_PASS_PRIVATE_KEY;
  const wwdr = process.env.APPLE_PASS_WWDR_CERTIFICATE;

  if (!cert || !key || !wwdr) {
    const missing = [];
    if (!cert) missing.push("APPLE_PASS_CERTIFICATE");
    if (!key) missing.push("APPLE_PASS_PRIVATE_KEY");
    if (!wwdr) missing.push("APPLE_PASS_WWDR_CERTIFICATE");
    throw new Error(`Zertifikate fehlen: [${missing.join(", ")}]. Ohne diese Zertifikate verweigert iOS das Hinzufügen der Karte zur Apple Wallet App.`);
  }

  try {
    const signatureBuffer = signManifest(manifestBuffer, cert, key, wwdr);
    zip.file("signature", signatureBuffer);
  } catch (err) {
    throw new Error(`Fehler bei der kryptografischen Signierung des Manifests: ${err.message}. Bitte überprüfe das Format deiner PEM-Zertifikate (Zertifikat-Header, Zeilenumbrüche etc.).`);
  }

  // 5. ZIP generieren
  return await zip.generateAsync({ type: "nodebuffer" });
}
