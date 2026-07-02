const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("path");
const express = require("express");
const cors = require("cors");

let mainWindow;
let server;
const PORT = 49152;

// ── Build API app ─────────────────────────────────────────────────────────
function buildApiApp() {
  const api = express();
  api.use(express.json());
  api.use(cors());

  const COUNTRY_MAP = {
    NL: { flag: "🇳🇱", name: "Нидерланды",      city: "Amsterdam"  },
    PL: { flag: "🇵🇱", name: "Польша",           city: "Warsaw"     },
    FI: { flag: "🇫🇮", name: "Финляндия",        city: "Helsinki"   },
    FR: { flag: "🇫🇷", name: "Франция",          city: "Paris"      },
    DE: { flag: "🇩🇪", name: "Германия",         city: "Frankfurt"  },
    SE: { flag: "🇸🇪", name: "Швеция",           city: "Stockholm"  },
    US: { flag: "🇺🇸", name: "США",              city: "New York"   },
    GB: { flag: "🇬🇧", name: "Великобритания",   city: "London"     },
    JP: { flag: "🇯🇵", name: "Япония",           city: "Tokyo"      },
    SG: { flag: "🇸🇬", name: "Сингапур",         city: "Singapore"  },
    CA: { flag: "🇨🇦", name: "Канада",           city: "Toronto"    },
    AU: { flag: "🇦🇺", name: "Австралия",        city: "Sydney"     },
    CH: { flag: "🇨🇭", name: "Швейцария",        city: "Zurich"     },
    AT: { flag: "🇦🇹", name: "Австрия",          city: "Vienna"     },
    TR: { flag: "🇹🇷", name: "Турция",           city: "Istanbul"   },
    RU: { flag: "🇷🇺", name: "Россия",           city: "Moscow"     },
    BR: { flag: "🇧🇷", name: "Бразилия",         city: "São Paulo"  },
    IN: { flag: "🇮🇳", name: "Индия",            city: "Mumbai"     },
    KR: { flag: "🇰🇷", name: "Южная Корея",      city: "Seoul"      },
    HK: { flag: "🇭🇰", name: "Гонконг",          city: "Hong Kong"  },
  };

  function detectCountry(text) {
    const upper = text.toUpperCase();
    for (const [code, info] of Object.entries(COUNTRY_MAP)) {
      if (upper.includes(code) || upper.includes(info.city.toUpperCase())) {
        return { flag: info.flag, country: info.name, city: info.city };
      }
    }
    return { flag: "🌐", country: "Сервер", city: "" };
  }

  function detectProtocol(line) {
    if (line.startsWith("vless://")) {
      const parts = [];
      if (line.includes("grpc") || line.includes("gRPC")) parts.push("gRPC");
      if (line.includes("ws") || line.includes("websocket")) parts.push("WS");
      if (line.includes("reality") || line.includes("Reality")) parts.push("Reality");
      if (line.includes("xtls") || line.includes("vision")) parts.push("XTLS");
      return "VLESS" + (parts.length ? " | " + parts.join(" | ") : "");
    }
    if (line.startsWith("vmess://")) return "VMess";
    if (line.startsWith("ss://"))    return "Shadowsocks";
    if (line.startsWith("trojan://")) return "Trojan";
    if (line.startsWith("hy2://") || line.startsWith("hysteria2://")) return "Hysteria2";
    return "Unknown";
  }

  function parseContent(content) {
    let lines = [];
    try {
      const decoded = Buffer.from(content.trim(), "base64").toString("utf-8");
      if (decoded.includes("://")) lines = decoded.split(/\r?\n/).filter(Boolean);
    } catch {}
    if (!lines.length) lines = content.split(/\r?\n/).filter(l => l.includes("://"));

    return lines.map((line, i) => {
      line = line.trim();
      if (!line || line.startsWith("#")) return null;
      let remark = "";
      try {
        const hi = line.lastIndexOf("#");
        if (hi !== -1) remark = decodeURIComponent(line.slice(hi + 1));
      } catch {}
      const geo = detectCountry(remark || line);
      return {
        id: `srv-${i}`,
        flag: geo.flag,
        country: geo.country || remark || `Server ${i + 1}`,
        city: geo.city,
        protocol: detectProtocol(line),
        ping: Math.floor(Math.random() * 400 + 50),
        raw: line,
      };
    }).filter(Boolean);
  }

  api.post("/api/subscription/fetch", async (req, res) => {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: "url required" });
    try {
      let fetch;
      try {
        fetch = (await import("node-fetch")).default;
      } catch {
        fetch = global.fetch;
      }

      const response = await fetch(url, {
        headers: { "User-Agent": "V2RayNG/1.8.0" },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) return res.status(502).json({ error: `Upstream ${response.status}` });
      const text = await response.text();
      const servers = parseContent(text);

      let trafficUsed = 0, trafficTotal = 0, expiresAt = null;
      const sui = response.headers.get("subscription-userinfo") || "";
      const um = sui.match(/upload=(\d+).*?download=(\d+)/);
      const tm = sui.match(/total=(\d+)/);
      const em = sui.match(/expire=(\d+)/);
      if (um) trafficUsed = (parseInt(um[1]) + parseInt(um[2])) / 1073741824;
      if (tm) trafficTotal = parseInt(tm[1]) / 1073741824;
      if (em) expiresAt = parseInt(em[1]) * 1000;

      res.json({
        servers,
        trafficUsed: Math.round(trafficUsed * 10) / 10,
        trafficTotal: trafficTotal ? Math.round(trafficTotal * 10) / 10 : null,
        expiresAt
      });
    } catch (e) {
      console.error("Subscription fetch error:", e);
      res.status(502).json({ error: e.message });
    }
  });

  return api;
}

// ── Start server ──────────────────────────────────────────────────────────
function startServer() {
  const apiApp = buildApiApp();
  const combined = express();

  combined.use(apiApp);
  combined.use(express.static(path.join(__dirname, "public")));
  combined.get("*", (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

  server = combined.listen(PORT, "localhost", () => {
    console.log(`[Server] Listening on http://localhost:${PORT}`);
  });
}

// ── Create window ─────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 800,
    minHeight: 560,
    title: "blowvpn",
    backgroundColor: "#0a0f1e",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  // Remove default menu bar
  Menu.setApplicationMenu(null);

  // Dev tools (remove in production)
  // mainWindow.webContents.openDevTools();
}

// ── App lifecycle ─────────────────────────────────────────────────────────
app.whenReady().then(() => {
  startServer();
  setTimeout(createWindow, 500);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (server) server.close();
  if (process.platform !== "darwin") app.quit();
});
