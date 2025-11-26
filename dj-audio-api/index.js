// index.js
//
// Einfache Audio-API für dein DJ Script.
//
// POST /resolve  { "url": "<original-url>" }
//   -> { "audio_url": "<direkt-abspielbare-audio-url>" }
//
// GET /stream?url=<YouTube-URL>
//   -> streamt nur den Audioteil des YouTube-Videos

const express = require("express");
const cors = require("cors");
const ytdl = require("ytdl-core");

const app = express();

// Render gibt PORT als Umgebungsvariable vor
const PORT = process.env.PORT || 3000;

// optional: einfacher API-Key-Schutz
const API_KEY = process.env.API_KEY || null;

app.use(cors());
app.use(express.json());

// kleines Helper: prüfen, ob URL YouTube ist
function isYouTubeUrl(url) {
  if (!url) return false;
  const u = url.toLowerCase();
  return u.includes("youtube.com") || u.includes("youtu.be");
}

// Middleware: optional API-Key-Check
function checkApiKey(req, res, next) {
  if (!API_KEY) return next(); // kein Key gesetzt -> keine Prüfung

  const key =
    req.headers["x-api-key"] ||
    req.headers["x-authorization"] ||
    req.query.api_key;

  if (!key || key !== API_KEY) {
    return res.status(401).json({ error: "Invalid or missing API key" });
  }

  next();
}

// POST /resolve
// Erwartet: { "url": "..." }
// Gibt zurück: { "audio_url": "..." }
app.post("/resolve", checkApiKey, (req, res) => {
  const url = req.body && req.body.url;

  if (!url) {
    return res.status(400).json({ error: "Missing url in body" });
  }

  // Wenn KEIN YouTube-Link -> einfach unverändert zurückgeben
  if (!isYouTubeUrl(url)) {
    return res.json({ audio_url: url });
  }

  // YouTube-Link -> prüfen ob valide
  if (!ytdl.validateURL(url)) {
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }

  // Wir bauen eine Stream-URL auf Basis derselben Domain:
  // z.B. https://dein-service.onrender.com/stream?url=<encoded>
  const encoded = encodeURIComponent(url);
  const host =
    process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;

  const streamUrl = `${host}/stream?url=${encoded}`;

  return res.json({ audio_url: streamUrl });
});

// GET /stream?url=YOUTUBE_URL
// Streamt nur den Audioteil des YouTube-Videos
app.get("/stream", async (req, res) => {
  const url = req.query.url;

  if (!url) {
    return res.status(400).send("Missing url parameter");
  }

  if (!isYouTubeUrl(url) || !ytdl.validateURL(url)) {
    return res.status(400).send("Invalid YouTube URL");
  }

  try {
    console.log("[DJ-AUDIO-API] Streaming audio for:", url);

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Transfer-Encoding", "chunked");

    const stream = ytdl(url, {
      filter: "audioonly",
      quality: "highestaudio",
      highWaterMark: 1 << 25,
    });

    stream.on("error", (err) => {
      console.error("[DJ-AUDIO-API] Stream error:", err.message);
      if (!res.headersSent) {
        res.status(500).end("Error while streaming");
      } else {
        res.end();
      }
    });

    stream.pipe(res);
  } catch (err) {
    console.error("[DJ-AUDIO-API] Error:", err);
    if (!res.headersSent) {
      res.status(500).send("Internal server error");
    } else {
      res.end();
    }
  }
});

app.get("/", (req, res) => {
  res.send("DJ Audio API is running");
});

app.listen(PORT, () => {
  console.log(`DJ Audio API listening on port ${PORT}`);
});
