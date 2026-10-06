// Minimal Google Sheets API v4 client for Cloudflare Workers.
// Cloudflare Workers doesn't support the Node `googleapis` package, so this
// signs its own service-account JWT with Web Crypto and talks to the Sheets
// REST API directly with fetch.

function base64url(input) {
  let bytes;
  if (typeof input === "string") {
    bytes = new TextEncoder().encode(input);
  } else {
    bytes = new Uint8Array(input);
  }
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem) {
  const normalized = pem.replace(/\\n/g, "\n");
  const b64 = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

let cachedToken = null; // { token, expiresAt } — reused across requests within an isolate

async function getAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - 60 > now) {
    return cachedToken.token;
  }

  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(env.GOOGLE_PRIVATE_KEY),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput)
  );
  const jwt = `${signingInput}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  cachedToken = { token: data.access_token, expiresAt: now + data.expires_in };
  return cachedToken.token;
}

async function sheetsFetch(env, path, options = {}) {
  const token = await getAccessToken(env);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Sheets API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// tab: sheet/tab name, e.g. "DailyLogs". row: array of cell values, in column order.
// Uses RAW (not USER_ENTERED) so Sheets stores values exactly as given —
// otherwise it "smart-parses" input like a human typed it, which silently
// converts long numeric strings (Discord IDs are 18-19 digits) into actual
// numbers and loses precision, breaking every later string comparison.
export async function appendRow(env, tab, row) {
  return sheetsFetch(
    env,
    `/values/${encodeURIComponent(tab)}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values: [row] }) }
  );
}

// Returns { header: string[], rows: string[][] } — rows are raw values, no header row.
export async function getRows(env, tab) {
  const data = await sheetsFetch(env, `/values/${encodeURIComponent(tab)}`);
  const values = data.values || [];
  return { header: values[0] || [], rows: values.slice(1) };
}

// Overwrites a single row by 1-based sheet row number (header is row 1, so
// first data row is 2). row: array of cell values, in column order. RAW for
// the same reason as appendRow above.
export async function updateRow(env, tab, rowNumber, row) {
  return sheetsFetch(
    env,
    `/values/${encodeURIComponent(tab)}!A${rowNumber}?valueInputOption=RAW`,
    { method: "PUT", body: JSON.stringify({ values: [row] }) }
  );
}

// Convenience: find rows where column `key` equals `value`. Returns rows with
// their 1-based sheet row number attached as `_row`, and named fields per header.
export async function findRows(env, tab, key, value) {
  const { header, rows } = await getRows(env, tab);
  const idx = header.indexOf(key);
  if (idx === -1) throw new Error(`Column "${key}" not found in tab "${tab}"`);
  return rows
    .map((r, i) => ({ _row: i + 2, header, values: r }))
    .filter((r) => r.values[idx] === value);
}

export function rowToObject(header, values) {
  const obj = {};
  header.forEach((h, i) => (obj[h] = values[i] ?? ""));
  return obj;
}
