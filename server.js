/* ===========================================================
   AHMS Local App + ESC/POS Print Server
   Raspberry Pi 400 -> Epson TM-T88 Network Printer

   What this does:
   1. Serves your AHMS app from /public
   2. Receives JSON at POST /print-match
   3. Prints normal and blank match sheets as raster images
   4. Prints rank matches as text ESC/POS
=========================================================== */

const fs = require("fs");
const os = require("os");
const path = require("path");
const sharp = require("sharp");

const express = require("express");
const cors = require("cors");
const escpos = require("escpos");

escpos.Network = require("escpos-network");

const app = express();

const SERVER_PORT = 3000;

// Change this to your Epson T88 IP
const PRINTER_IP = "192.168.1.229";
const PRINTER_PORT = 9100;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// If you put index.html, script.js, style.css in ./public,
// this will serve the AHMS app at http://PI_IP:3000
app.use(express.static(path.join(__dirname, "public")));

function safeText(value, fallback = "") {
  return String(value || fallback).replace(/[^\x20-\x7E\n\r\t]/g, "");
}

function line(char = "-", count = 42) {
  return char.repeat(count);
}

function xmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function printWithEscpos(jobFn) {
  return new Promise((resolve, reject) => {
    const device = new escpos.Network(PRINTER_IP, PRINTER_PORT);
    const printer = new escpos.Printer(device, {
      encoding: "GB18030"
    });

    device.open((err) => {
      if (err) {
        reject(err);
        return;
      }

      try {
        jobFn(printer);

        printer
          .feed(3)
          .cut()
          .close();

        resolve();
      } catch (jobErr) {
        try {
          printer.close();
        } catch {}
        reject(jobErr);
      }
    });
  });
}

function makeMatchSheetSvg(data, options = {}) {
  const isBlank = !!options.blank;

  const matchNum = xmlEscape(isBlank ? "_____" : (data.matchNum || "_____"));
  const tableNum = xmlEscape(isBlank ? "______" : (data.tableNum || "______"));
  const refName = xmlEscape(isBlank ? "____________" : (data.refName || "____________"));
  const playerA = xmlEscape(isBlank ? "" : (data.playerA || ""));
  const playerB = xmlEscape(isBlank ? "" : (data.playerB || ""));

  return `
<svg width="576" height="760" viewBox="0 0 576 760" xmlns="http://www.w3.org/2000/svg">
  <rect width="576" height="760" fill="white"/>

  <style>
    .title { font-family: Arial, Helvetica, sans-serif; font-size: 30px; font-weight: 700; }
    .text { font-family: Arial, Helvetica, sans-serif; font-size: 22px; }
    .bold { font-family: Arial, Helvetica, sans-serif; font-size: 22px; font-weight: 700; }
    .cell { font-family: Arial, Helvetica, sans-serif; font-size: 22px; font-weight: 700; text-anchor: middle; dominant-baseline: middle; }
    .nameLeft { font-family: Arial, Helvetica, sans-serif; font-size: 21px; dominant-baseline: middle; }
    .line { stroke: black; stroke-width: 2; fill: none; }
    .thin { stroke: black; stroke-width: 1.5; fill: none; }
  </style>

  <text x="28" y="58" class="title">AIRHOCKEY MATCH SHEET - Match ${matchNum}</text>

  <text x="32" y="108" class="bold">Table #:</text>
  <text x="124" y="108" class="text">${tableNum}</text>

  <text x="190" y="108" class="bold">Ref:</text>
  <text x="245" y="108" class="text">${refName}</text>

  <text x="32" y="152" class="bold">Player A:</text>
  <text x="132" y="152" class="text">${playerA}</text>

  <text x="32" y="182" class="bold">Player B:</text>
  <text x="132" y="182" class="text">${playerB}</text>

  <!-- Main score table -->
  <rect x="32" y="220" width="512" height="190" class="line"/>

  <!-- Horizontal dividers -->
  <line x1="32" y1="265" x2="544" y2="265" class="line"/>
  <line x1="32" y1="330" x2="544" y2="330" class="thin"/>

  <!-- Player column divider -->
  <line x1="286" y1="220" x2="286" y2="410" class="line"/>

  <!-- Score column dividers -->
  <line x1="323" y1="220" x2="323" y2="410" class="thin"/>
  <line x1="360" y1="220" x2="360" y2="410" class="thin"/>
  <line x1="397" y1="220" x2="397" y2="410" class="thin"/>
  <line x1="434" y1="220" x2="434" y2="410" class="thin"/>
  <line x1="471" y1="220" x2="471" y2="410" class="thin"/>
  <line x1="508" y1="220" x2="508" y2="410" class="thin"/>

  <!-- Header labels -->
  <text x="159" y="243" class="cell">Player</text>
  <text x="304.5" y="243" class="cell">1</text>
  <text x="341.5" y="243" class="cell">2</text>
  <text x="378.5" y="243" class="cell">3</text>
  <text x="415.5" y="243" class="cell">4</text>
  <text x="452.5" y="243" class="cell">5</text>
  <text x="489.5" y="243" class="cell">6</text>
  <text x="526.5" y="243" class="cell">7</text>

  <!-- Player names -->
  <text x="46" y="297" class="nameLeft">${playerA}</text>
  <text x="46" y="365" class="nameLeft">${playerB}</text>

  <!-- Notes -->
  <text x="32" y="455" class="bold">Notes:</text>

  <line x1="48" y1="505" x2="300" y2="505" class="thin"/>
  <line x1="48" y1="555" x2="300" y2="555" class="thin"/>
  <line x1="48" y1="605" x2="300" y2="605" class="thin"/>
</svg>
`;
}

async function printMatchSheetImage(data, options = {}) {
  const svg = makeMatchSheetSvg(data, options);
  const tmpFile = path.join(os.tmpdir(), `ahms-match-${Date.now()}.png`);

  await sharp(Buffer.from(svg))
    .png()
    .toFile(tmpFile);

  return new Promise((resolve, reject) => {
    const device = new escpos.Network(PRINTER_IP, PRINTER_PORT);
    const printer = new escpos.Printer(device, {
      encoding: "GB18030"
    });

    device.open((err) => {
      if (err) {
        fs.unlink(tmpFile, () => {});
        reject(err);
        return;
      }

      escpos.Image.load(tmpFile, (image) => {
        try {
          printer
            .align("ct")
            .raster(image)
            .feed(3)
            .cut()
            .close();

          fs.unlink(tmpFile, () => {});
          resolve();
        } catch (printErr) {
          fs.unlink(tmpFile, () => {});
          try {
            printer.close();
          } catch {}
          reject(printErr);
        }
      });
    });
  });
}

function printRankMatch(printer, data) {
  const matchNum = safeText(data.matchNum, "__________");
  const tableNum = safeText(data.tableNum, "__________");
  const refName = safeText(data.refName, "______________");

  printer
    .align("ct")
    .style("b")
    .size(1, 1)
    .text("RANK MATCH")
    .style("normal")
    .size(0, 0)
    .align("lt")
    .text(line("="))
    .text(`Match: ${matchNum}`)
    .text(`Table: ${tableNum}`)
    .text(`Ref: ${refName}`)
    .text("Wit(s): ______________")
    .text(line("-"))
    .text("Player A: ____________________")
    .text("Nat#: ____  Reg#: ____  Loc#: ____")
    .text("")
    .text("Player B: ____________________")
    .text("Nat#: ____  Reg#: ____  Loc#: ____")
    .text(line("-"))
    .style("b")
    .text("Sets & Games:")
    .style("normal")
    .text("___ OUT OF ____ GAMES/SET")
    .text("____ OUT OF ____ SETS/MATCH")
    .text("")
    .text("Set 1: [_____] [_____] [_____] [_____] [_____] [_____] [_____]")
    .text("Set 2: [_____] [_____] [_____] [_____] [_____] [_____] [_____]")
    .text("Set 3: [_____] [_____] [_____] [_____] [_____] [_____] [_____]")
    .text("Set 4: [_____] [_____] [_____] [_____] [_____] [_____] [_____]")
    .text("Set 5: [_____] [_____] [_____] [_____] [_____] [_____] [_____]")
    .text("Set 6: [_____] [_____] [_____] [_____] [_____] [_____] [_____]")
    .text("Set 7: [_____] [_____] [_____] [_____] [_____] [_____] [_____]")
    .text("")
    .text("Rank Changes: ____________________")
    .text("")
    .text("Notes:")
    .text("________________________________________")
    .text("________________________________________")
    .text("________________________________________");
}

app.post("/print-match", async (req, res) => {
  try {
    const data = req.body || {};
    const mode = data.mode || "match";

    if (mode === "rank") {
      await printWithEscpos((printer) => {
        printRankMatch(printer, data);
      });
    } else if (mode === "blank") {
      await printMatchSheetImage({}, { blank: true });
    } else {
      await printMatchSheetImage(data);
    }

    res.json({ ok: true, message: "Printed via ESC/POS" });
  } catch (err) {
    console.error("Print error:", err);
    res.status(500).json({
      ok: false,
      error: err.message || String(err)
    });
  }
});

app.get("/ping", (req, res) => {
  res.json({
    ok: true,
    message: "AHMS print server is reachable",
    printerIp: PRINTER_IP,
    printerPort: PRINTER_PORT,
    time: new Date().toISOString()
  });
});

app.listen(SERVER_PORT, "0.0.0.0", () => {
  console.log(`AHMS app + print server running on port ${SERVER_PORT}`);
  console.log(`Printer target: ${PRINTER_IP}:${PRINTER_PORT}`);
});