// =======================================================
// AHMS HTTPS PRINT BRIDGE (Full Production Version)
// Prints raster image to Epson over raw TCP (9100)
// =======================================================

const express = require("express");
const cors = require("cors");
const sharp = require("sharp");
const net = require("net");
const https = require("https");
const fs = require("fs");

// ================= CONFIG =================

const PRINTER_HOST = "192.168.1.229";
const PRINTER_PORT = 9100;

const LISTEN_PORT = 5056;
const PRINTER_MAX_WIDTH = 576; // 80mm Epson

// Adjust darkness (150 darker, 200 lighter)
const THRESH = parseInt(process.env.THRESH || "170", 10);

// Your mkcert files
const keyPath  = "./certs/192.168.1.66+2-key.pem";
const certPath = "./certs/192.168.1.66+2.pem";

// ===========================================

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ================= ESC/POS HELPERS =================

const ESC_INIT        = Buffer.from([0x1B, 0x40]);
const ESC_ALIGN_LEFT  = Buffer.from([0x1B, 0x61, 0x00]);
const ESC_ALIGN_CENTER= Buffer.from([0x1B, 0x61, 0x01]);
const ESC_FEED_3      = Buffer.from([0x1B, 0x64, 0x03]);
const GS_CUT_FULL     = Buffer.from([0x1D, 0x56, 0x00]);

function escposRasterCommand(widthBytes, height) {
  const header = Buffer.from([
    0x1D, 0x76, 0x30, 0x00,
    widthBytes & 0xFF,
    (widthBytes >> 8) & 0xFF,
    height & 0xFF,
    (height >> 8) & 0xFF
  ]);
  return header;
}

// Convert grayscale image buffer to 1-bit raster
function thresholdTo1Bit(buffer, width, height) {
  const widthBytes = Math.ceil(width / 8);
  const output = Buffer.alloc(widthBytes * height);

  for (let y = 0; y < height; y++) {
    for (let xByte = 0; xByte < widthBytes; xByte++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = xByte * 8 + bit;
        if (x >= width) continue;

        const idx = y * width + x;
        const pixel = buffer[idx];

        if (pixel < THRESH) {
          byte |= (1 << (7 - bit));
        }
      }
      output[y * widthBytes + xByte] = byte;
    }
  }

  return { raster: output, widthBytes };
}

// ================= PRINT ROUTE =================

app.post("/print-image", async (req, res) => {
  try {
    const { imageBase64, copies = 1, title = "" } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ ok: false, error: "Missing imageBase64" });
    }

    const imgBuffer = Buffer.from(imageBase64, "base64");

    const { data, info } = await sharp(imgBuffer)
      .resize({
        width: PRINTER_MAX_WIDTH,
        withoutEnlargement: true
      })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { raster, widthBytes } = thresholdTo1Bit(
      data,
      info.width,
      info.height
    );

    const imgCmd = Buffer.concat([
      escposRasterCommand(widthBytes, info.height),
      raster
    ]);

    for (let i = 0; i < copies; i++) {
      await new Promise((resolve, reject) => {
        const socket = new net.Socket();

        socket.on("error", reject);
        socket.on("timeout", () => {
          socket.destroy();
          reject(new Error("Printer timeout"));
        });

        socket.connect(PRINTER_PORT, PRINTER_HOST, () => {
          socket.write(ESC_INIT);
          socket.write(ESC_ALIGN_CENTER);
          socket.write(imgCmd);
          socket.write(ESC_FEED_3);
          socket.write(GS_CUT_FULL);
          socket.end();
          resolve();
        });
      });
    }

    res.json({ ok: true });

  } catch (err) {
    console.error("PRINT ERROR:", err);
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

// ================= HTTPS SERVER =================

https.createServer(
  {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  },
  app
).listen(LISTEN_PORT, "0.0.0.0", () => {
  console.log("=======================================");
  console.log("🔐 AHMS HTTPS Print Bridge Running");
  console.log(`URL: https://192.168.1.66:${LISTEN_PORT}`);
  console.log(`Printer: ${PRINTER_HOST}:${PRINTER_PORT}`);
  console.log(`Threshold: ${THRESH}`);
  console.log("=======================================");
});
