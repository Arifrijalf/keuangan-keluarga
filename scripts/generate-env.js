const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env");
const outputPath = path.join(__dirname, "..", "public", "env-config.js");

if (!fs.existsSync(envPath)) {
  console.error(
    "File .env tidak ditemukan! Buat file .env terlebih dahulu (copy dari .env.example)."
  );
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, "utf-8");
const lines = envContent.split("\n");

const envVars = {};

for (const line of lines) {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) continue;

  const eqIndex = trimmed.indexOf("=");
  if (eqIndex === -1) continue;

  const key = trimmed.slice(0, eqIndex).trim();
  let value = trimmed.slice(eqIndex + 1).trim();

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  envVars[key] = value;
}

if (envVars.ADMIN_EMAILS) {
  envVars.ADMIN_EMAILS = envVars.ADMIN_EMAILS.split(",").map((e) => e.trim());
}

if (envVars.FAMILY_EMAILS) {
  envVars.FAMILY_EMAILS = envVars.FAMILY_EMAILS.split(",").map((e) => e.trim());
}

const firebaseConfig = {
  apiKey: envVars.FIREBASE_API_KEY,
  authDomain: envVars.FIREBASE_AUTH_DOMAIN,
  projectId: envVars.FIREBASE_PROJECT_ID,
  storageBucket: envVars.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envVars.FIREBASE_MESSAGING_SENDER_ID,
  appId: envVars.FIREBASE_APP_ID,
};

const padJson = (json, padding) =>
  json.replace(/\n/g, "\n" + padding);

const jsonConfig = padJson(JSON.stringify(firebaseConfig, null, 2), "    ");
const jsonAdmin = padJson(JSON.stringify(envVars.ADMIN_EMAILS, null, 2), "    ");
const jsonFamily = padJson(JSON.stringify(envVars.FAMILY_EMAILS, null, 2), "    ");

const output = `// Generated from .env — DO NOT EDIT
window.__ENV__ = {
  FIREBASE_CONFIG: ${jsonConfig},
  ADMIN_EMAILS: ${jsonAdmin},
  FAMILY_EMAILS: ${jsonFamily},
};
`;

fs.writeFileSync(outputPath, output, "utf-8");
console.log("env-config.js berhasil dibuat di public/env-config.js");