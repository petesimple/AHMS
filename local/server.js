/* ===========================================================
   AHMS Local App + ESC/POS Print Server
   Raspberry Pi 400 -> Epson TM-T88 Network Printer

   Browser AHMS app sends JSON to:
   POST http://PI_IP:3000/print-match

   Normal match sheets and blank cards print as landscape raster images.
   Rank matches print as regular ESC/POS text.

   QR support:
   If scoreboardUrl is included in the print payload, the match sheet
   prints a large QR code in a dedicated right side column, aligned
   with the main score table.
=========================================================== */

const fs = require("fs");
const os = require("os");
const path = require("path");
const sharp = require("sharp");
const QRCode = require("qrcode");

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

async function makeQrDataUrl(scoreboardUrl) {
  const clean = String(scoreboardUrl || "").trim();
  if (!clean) return "";

  try {
    return await QRCode.toDataURL(clean, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 145,
      color: {
        dark: "#000000",
        light: "#ffffff"
      }
    });
  } catch (err) {
    console.warn("QR generation failed:", err);
    return "";
  }
}

async function makeMatchSheetSvg(data, options = {}) {
  const isBlank = !!options.blank;

  const matchNum = xmlEscape(isBlank ? "_____" : (data.matchNum || "_____"));
  const tableNum = xmlEscape(isBlank ? "______" : (data.tableNum || "______"));
  const refName = xmlEscape(isBlank ? "____________" : (data.refName || "____________"));
  const playerA = xmlEscape(isBlank ? "" : (data.playerA || ""));
  const playerB = xmlEscape(isBlank ? "" : (data.playerB || ""));
  const matchId = xmlEscape(isBlank ? "" : (data.matchId || ""));
  const scoreboardUrl = isBlank ? "" : String(data.scoreboardUrl || "").trim();

  const qrDataUrl = await makeQrDataUrl(scoreboardUrl);

  const matchIdBlock = matchId ? `
    <text x="32" y="204" class="smallBold">Match ID:</text>
    <text x="125" y="204" class="smallText">${matchId}</text>
  ` : "";

  const qrBlock = qrDataUrl ? `
    <!-- Large QR block aligned with score table -->
    <rect x="548" y="230" width="170" height="170" fill="white" stroke="black" stroke-width="2"/>
    <text x="633" y="248" class="qrTitle">SCAN TO SCORE</text>
    <image href="${qrDataUrl}" x="560" y="255" width="145" height="145"/>
  ` : "";

  return `
<svg width="760" height="576" viewBox="0 0 760 576" xmlns="http://www.w3.org/2000/svg">
  <rect width="760" height="576" fill="white"/>

  <style>
    .title { font-family: Arial, Helvetica, sans-serif; font-size: 30px; font-weight: 700; }
    .text { font-family: Arial, Helvetica, sans-serif; font-size: 22px; }
    .bold { font-family: Arial, Helvetica, sans-serif; font-size: 22px; font-weight: 700; }
    .smallText { font-family: Arial, Helvetica, sans-serif; font-size: 14px; }
    .smallBold { font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: 700; }
    .cell { font-family: Arial, Helvetica, sans-serif; font-size: 22px; font-weight: 700; text-anchor: middle; dominant-baseline: middle; }
    .nameLeft { font-family: Arial, Helvetica, sans-serif; font-size: 21px; dominant-baseline: middle; }
    .qrTitle { font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: 700; text-anchor: middle; }
    .line { stroke: black; stroke-width: 2; fill: none; }
    .thin { stroke: black; stroke-width: 1.5; fill: none; }
  </style>

  <text x="30" y="55" class="title">AIRHOCKEY MATCH SHEET - Match ${matchNum}</text>

  <text x="32" y="102" class="bold">Table #:</text>
  <text x="125" y="102" class="text">${tableNum}</text>

  <text x="220" y="102" class="bold">Ref:</text>
  <text x="275" y="102" class="text">${refName}</text>

  <text x="32" y="142" class="bold">Player A:</text>
  <text x="135" y="142" class="text">${playerA}</text>

  <text x="32" y="174" class="bold">Player B:</text>
  <text x="135" y="174" class="text">${playerB}</text>

  ${matchIdBlock}
  ${qrBlock}

  <!-- Main score table made narrower to leave room for large QR -->
  <rect x="32" y="230" width="500" height="170" class="line"/>

  <!-- Horizontal dividers -->
  <line x1="32" y1="270" x2="532" y2="270" class="line"/>
  <line x1="32" y1="335" x2="532" y2="335" class="thin"/>

  <!-- Player column divider -->
  <line x1="292" y1="230" x2="292" y2="400" class="line"/>

  <!-- Score column dividers -->
  <line x1="326" y1="230" x2="326" y2="400" class="thin"/>
  <line x1="360" y1="230" x2="360" y2="400" class="thin"/>
  <line x1="394" y1="230" x2="394" y2="400" class="thin"/>
  <line x1="428" y1="230" x2="428" y2="400" class="thin"/>
  <line x1="462" y1="230" x2="462" y2="400" class="thin"/>
  <line x1="496" y1="230" x2="496" y2="400" class="thin"/>

  <!-- Header labels -->
  <text x="162" y="250" class="cell">Player</text>
  <text x="309" y="250" class="cell">1</text>
  <text x="343" y="250" class="cell">2</text>
  <text x="377" y="250" class="cell">3</text>
  <text x="411" y="250" class="cell">4</text>
  <text x="445" y="250" class="cell">5</text>
  <text x="479" y="250" class="cell">6</text>
  <text x="514" y="250" class="cell">7</text>

  <!-- Player names -->
  <text x="50" y="302" class="nameLeft">${playerA}</text>
  <text x="50" y="367" class="nameLeft">${playerB}</text>

  <!-- Notes -->
  <text x="32" y="445" class="bold">Notes:</text>
  <line x1="110" y1="445" x2="728" y2="445" class="thin"/>
  <line x1="32" y1="490" x2="728" y2="490" class="thin"/>
  <line x1="32" y1="535" x2="728" y2="535" class="thin"/>
</svg>
`;
}

async function printMatchSheetImage(data, options = {}) {
  const svg = await makeMatchSheetSvg(data, options);
  const tmpFile = path.join(os.tmpdir(), `ahms-match-${Date.now()}.png`);

  await sharp(Buffer.from(svg))
    .rotate(90)
    .grayscale()
    .threshold(180)
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
    .text("Wit(s) | Alt Ref(s)")
    .text("________________________________________")
    .text("________________________________________")
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
    .text("")
    .text("____ OUT OF ____ SETS/MATCH")
    .text("")
    .text("Set 1")
    .text("[___] [___] [___] [___] [___] [___] [___]")
    .text("")
    .text("Set 2")
    .text("[___] [___] [___] [___] [___] [___] [___]")
    .text("")
    .text("Set 3")
    .text("[___] [___] [___] [___] [___] [___] [___]")
    .text("")
    .text("Set 4")
    .text("[___] [___] [___] [___] [___] [___] [___]")
    .text("")
    .text("Set 5")
    .text("[___] [___] [___] [___] [___] [___] [___]")
    .text("")
    .text("Set 6")
    .text("[___] [___] [___] [___] [___] [___] [___]")
    .text("")
    .text("Set 7")
    .text("[___] [___] [___] [___] [___] [___] [___]")
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

    console.log("Print request received:", {
      mode,
      matchNum: data.matchNum,
      tableNum: data.tableNum,
      refName: data.refName,
      playerA: data.playerA,
      playerB: data.playerB,
      matchId: data.matchId,
      hasScoreboardUrl: !!data.scoreboardUrl
    });

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

app.get("/", (req, res, next) => {
  const indexPath = path.join(__dirname, "public", "index.html");
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.send("AHMS ESC/POS bridge is running.");
});

app.listen(SERVER_PORT, "0.0.0.0", () => {
  console.log(`AHMS app + print server running on port ${SERVER_PORT}`);
  console.log(`Printer target: ${PRINTER_IP}:${PRINTER_PORT}`);
});