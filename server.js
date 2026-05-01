/* ===========================================================
   AHMS Local App + ESC/POS Print Server
   Raspberry Pi 400 -> Epson TM-T88 Network Printer

   Browser AHMS app sends JSON to:
   POST http://PI_IP:3000/print-match

   Normal match sheets and blank cards print as landscape raster images.
   Rank matches print as regular ESC/POS text.

   QR support:
   If scoreboardUrl is included in the print payload, the match sheet
   prints a QR code in the upper right of the landscape card.
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
      width: 132,
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

  const qrBlock = qrDataUrl ? `
    <rect x="570" y="24" width="150" height="150" fill="white" stroke="black" stroke-width="2"/>
    <text x="645" y="44" class="qrTitle">SCAN TO SCORE</text>
    <image href="${qrDataUrl}" x="579" y="52" width="132" height="132"/>
  ` : "";

  const matchIdBlock = matchId ? `
    <text x="410" y="102" class="bold">Match ID:</text>
    <text x="520" y="102" class="smallText">${matchId}</text>
  ` : "";

  return `
<svg width="760" height="576" viewBox="0 0 760 576" xmlns="http://www.w3.org/2000/svg">
  <rect width="760" height="576" fill="white"/>

  <style>
    .title { font-family: Arial, Helvetica, sans-serif; font-size: 30px; font-weight: 700; }
    .text { font-family: Arial, Helvetica, sans-serif; font-size: 22px; }
    .smallText { font-family: Arial, Helvetica, sans-serif; font-size: 14px; }
    .bold { font-family: Arial, Helvetica, sans-serif; font-size: 22px; font-weight: 700; }
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

  ${matchIdBlock}

  <text x="32" y="142" class="bold">Player A:</text>
  <text x="135" y="142" class="text">${playerA}</text>

  <text x="32" y="174" class="bold">Player B:</text>
  <text x="135" y="174" class="text">${playerB}</text>

  ${qrBlock}

  <!-- Main score table -->
  <rect x="32" y="210" width="696" height="190" class="line"/>

  <!-- Horizontal dividers -->
  <line x1="32" y1="255" x2="728" y2="255" class="line"/>
  <line x1="32" y1="325" x2="728" y2="325" class="thin"/>

  <!-- Player column divider -->
  <line x1="330" y1="210" x2="330" y2="400" class="line"/>

  <!-- Score column dividers -->
  <line x1="387" y1="210" x2="387" y2="400" class="thin"/>
  <line x1="444" y1="210" x2="444" y2="400" class="thin"/>
  <line x1="501" y1="210" x2="501" y2="400" class="thin"/>
  <line x1="558" y1="210" x2="558" y2="400" class="thin"/>
  <line x1="615" y1="210" x2="615" y2="400" class="thin"/>
  <line x1="672" y1="210" x2="672" y2="400" class="thin"/>

  <!-- Header labels -->
  <text x="181" y="233" class="cell">Player</text>
  <text x="358.5" y="233" class="cell">1</text>
  <text x="415.5" y="233" class="cell">2</text>
  <text x="472.5" y="233" class="cell">3</text>
  <text x="529.5" y="233" class="cell">4</text>
  <text x="586.5" y="233" class="cell">5</text>
  <text x="643.5" y="233" class="cell">6</text>
  <text x="700.5" y="233" class="cell">7</text>

  <!-- Player names -->
  <text x="50" y="290" class="nameLeft">${playerA}</text>
  <text x="50" y="362" class="nameLeft">${playerB}</text>

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