import http from "http";
import crypto from "crypto";
import { exec } from "child_process";

/* =======================
   CONFIG
======================= */
const PORT          = 9000;
const SECRET        = "bumpy-webhook-secret";   // gleiches Secret wie in GitHub eintragen
const REPO_DIR      = "/home/ubuntu/bumpy-cloud";
const PM2_APP_NAME  = "bumpy-cloud";

/* =======================
   HELPER
======================= */
function verifySignature(body, signature) {
  const hmac = crypto.createHmac("sha256", SECRET);
  hmac.update(body);
  const expected = "sha256=" + hmac.digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}

function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: REPO_DIR }, (err, stdout, stderr) => {
      if (err) { reject(stderr || err.message); return; }
      resolve(stdout);
    });
  });
}

/* =======================
   WEBHOOK SERVER
======================= */
const server = http.createServer((req, res) => {

  if (req.method !== "POST" || req.url !== "/webhook") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  let body = "";
  req.on("data", chunk => body += chunk);

  req.on("end", async () => {
    const signature = req.headers["x-hub-signature-256"] || "";

    if (!verifySignature(body, signature)) {
      console.warn("⚠️ Invalid webhook signature");
      res.writeHead(401);
      res.end("Unauthorized");
      return;
    }

    let event;
    try {
      event = JSON.parse(body);
    } catch {
      res.writeHead(400);
      res.end("Bad request");
      return;
    }

    // Nur push auf main
    if (event.ref !== "refs/heads/main") {
      console.log("ℹ️ Push auf anderen Branch – ignoriert");
      res.writeHead(200);
      res.end("Ignored");
      return;
    }

    console.log("🚀 Push auf main erkannt → deploying...");
    res.writeHead(200);
    res.end("OK");

    try {
      const pull = await run("git pull origin main");
      console.log("✅ git pull:\n", pull);

      const install = await run("npm install");
      console.log("✅ npm install:\n", install);

      const restart = await run(`pm2 restart ${PM2_APP_NAME}`);
      console.log("✅ pm2 restart:\n", restart);

      console.log("🎉 Deploy erfolgreich");
    } catch (err) {
      console.error("❌ Deploy fehlgeschlagen:", err);
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🔗 Webhook server läuft auf Port ${PORT}`);
});
