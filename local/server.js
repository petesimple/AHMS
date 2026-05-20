/* ===========================================================
   AHMS Local App + ESC/POS Print Server
   Raspberry Pi 400 -> Epson TM-T88 Network Printer

   Browser AHMS app sends JSON to:
   POST http://PI_IP:3000/print-match

   Normal match sheets, blank cards, and Photon cards print
   as landscape raster images.

   Rank matches print as regular ESC/POS text.

   QR support:
   If scoreboardUrl is included in the print payload, the match sheet
   prints a large QR code in a dedicated right side column.

   Custom logo support:
   If customLogoDataUrl is included in the print payload, the logo
   prints above the QR code.

   Room map support:
   If roomMapDataUrl is included in the print payload, a simplified
   room map prints above the QR code with GO TO TABLE text above it.

   Bracket support:
   If matchNum, bracketMatchId, and bracketLane are included, matchNum
   is treated as the tournament call number shown on the printed card.

   Fix:
   Match ID prints only once at the bottom left of the card.
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
const PRINTER_IP = "192.168.1.29";
const PRINTER_PORT = 9100;

app.use(cors());
app.use(express.json({ limit: "8mb" }));

// If you put index.html, script.js, style.css in ./public,
// this will serve the AHMS app at http://PI_IP:3000
app.use(express.static(path.join(__dirname, "public")));

function safeText(value, fallback = "") {
  return String(value || fallback).replace(/[^\x20-\x7E\n\r\t]/g, "");
}

function getDisplayMatchLabel(data = {}) {
  const matchNum = safeText(data.matchNum || "").trim();
  const bracketMatchId = safeText(data.bracketMatchId || "").trim();
  const bracketLane = safeText(data.bracketLane || "").trim();

  if (matchNum) {
    return `Match ${matchNum}`;
  }

  if (bracketLane && bracketMatchId) {
    return `${bracketLane} ${bracketMatchId}`;
  }

  if (bracketMatchId) {
    return bracketMatchId;
  }

  return "Match _____";
}

function getBracketInfoLine(data = {}) {
  const bracketMatchId = safeText(data.bracketMatchId || "").trim();
  const bracketLane = safeText(data.bracketLane || "").trim();

  if (bracketLane && bracketMatchId) {
    return `${bracketLane} ${bracketMatchId}`;
  }

  return bracketMatchId;
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

function sanitizeDataImage(value) {
  const clean = String(value || "").trim();

  if (!clean) return "";

  if (!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(clean)) {
    return "";
  }

  return clean;
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

function makeQrBlock({
  qrDataUrl,
  customLogoDataUrl,
  roomMapDataUrl,
  roomMapLabel = "",
  x = 548,
  y = 230,
  withLogoY = 190,
  roomMapY = 138
}) {
  const customLogoHref = xmlEscape(customLogoDataUrl || "");
  const roomMapHref = xmlEscape(roomMapDataUrl || "");
  const roomLabel = xmlEscape(roomMapLabel || "ROOM MAP");

  const hasQr = !!qrDataUrl;
  const hasLogo = !!customLogoDataUrl;
  const hasRoomMap = !!roomMapDataUrl;

  if (!hasQr && !hasRoomMap) {
    return "";
  }

  const roomMapBlock = hasRoomMap ? `
    <text x="${x + 2}" y="${roomMapY - 6}" class="roomMapLabel">${roomLabel}</text>
    <rect x="${x}" y="${roomMapY}" width="170" height="86" fill="white" stroke="black" stroke-width="2"/>
    <image href="${roomMapHref}" x="${x}" y="${roomMapY}" width="170" height="86" preserveAspectRatio="xMidYMid meet"/>
  ` : "";

  if (hasQr && hasRoomMap && hasLogo) {
    return `
    ${roomMapBlock}
    <rect x="${x}" y="${y}" width="170" height="170" fill="white" stroke="black" stroke-width="2"/>
    <image href="${customLogoHref}" x="${x + 15}" y="${y + 7}" width="140" height="28" preserveAspectRatio="xMidYMid meet"/>
    <text x="${x + 85}" y="${y + 48}" class="qrTitle">SCAN TO SCORE</text>
    <image href="${qrDataUrl}" x="${x + 19}" y="${y + 54}" width="132" height="132"/>
    `;
  }

  if (hasQr && hasRoomMap) {
    return `
    ${roomMapBlock}
    <rect x="${x}" y="${y}" width="170" height="170" fill="white" stroke="black" stroke-width="2"/>
    <text x="${x + 85}" y="${y + 18}" class="qrTitle">SCAN TO SCORE</text>
    <image href="${qrDataUrl}" x="${x + 12}" y="${y + 25}" width="145" height="145"/>
    `;
  }

  if (hasQr && hasLogo) {
    return `
    <rect x="${x}" y="${withLogoY}" width="170" height="210" fill="white" stroke="black" stroke-width="2"/>
    <image href="${customLogoHref}" x="${x + 15}" y="${withLogoY + 8}" width="140" height="38" preserveAspectRatio="xMidYMid meet"/>
    <text x="${x + 85}" y="${withLogoY + 54}" class="qrTitle">SCAN TO SCORE</text>
    <image href="${qrDataUrl}" x="${x + 12}" y="${withLogoY + 60}" width="145" height="145"/>
    `;
  }

  if (hasQr) {
    return `
    <rect x="${x}" y="${y}" width="170" height="170" fill="white" stroke="black" stroke-width="2"/>
    <text x="${x + 85}" y="${y + 18}" class="qrTitle">SCAN TO SCORE</text>
    <image href="${qrDataUrl}" x="${x + 12}" y="${y + 25}" width="145" height="145"/>
    `;
  }

  return roomMapBlock;
}

async function makeMatchSheetSvg(data, options = {}) {
  const isBlank = !!options.blank;

  const rawTableNum = isBlank ? "" : String(data.tableNum || "").trim();

  const displayMatchLabel = xmlEscape(isBlank ? "Match _____" : getDisplayMatchLabel(data));
  const bracketInfoLine = xmlEscape(isBlank ? "" : getBracketInfoLine(data));

  const tableNum = xmlEscape(isBlank ? "______" : (data.tableNum || "______"));
  const refName = xmlEscape(isBlank ? "____________" : (data.refName || "____________"));
  const playerA = xmlEscape(isBlank ? "" : (data.playerA || ""));
  const playerB = xmlEscape(isBlank ? "" : (data.playerB || ""));
  const matchId = xmlEscape(isBlank ? "" : (data.matchId || ""));
  const scoreboardUrl = isBlank ? "" : String(data.scoreboardUrl || "").trim();
  const customLogoDataUrl = isBlank ? "" : sanitizeDataImage(data.customLogoDataUrl);
  const roomMapDataUrl = isBlank ? "" : sanitizeDataImage(data.roomMapDataUrl);
  const roomMapLabel = rawTableNum ? `GO TO TABLE ${rawTableNum}` : "ROOM MAP";

  const qrDataUrl = await makeQrDataUrl(scoreboardUrl);
  const qrBlock = makeQrBlock({
    qrDataUrl,
    customLogoDataUrl,
    roomMapDataUrl,
    roomMapLabel,
    x: 548,
    y: 230,
    withLogoY: 190,
    roomMapY: 138
  });

  const bracketInfoBlock = bracketInfoLine ? `
    <text x="32" y="126" class="smallBold">Bracket ID:</text>
    <text x="125" y="126" class="smallText">${bracketInfoLine}</text>
  ` : "";

  const matchIdBlock = matchId ? `
    <text x="32" y="552" class="tinyBold">Match ID:</text>
    <text x="92" y="552" class="tinyText">${matchId}</text>
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
    .tinyText { font-family: Arial, Helvetica, sans-serif; font-size: 11px; }
    .tinyBold { font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 700; }
    .cell { font-family: Arial, Helvetica, sans-serif; font-size: 22px; font-weight: 700; text-anchor: middle; dominant-baseline: middle; }
    .nameLeft { font-family: Arial, Helvetica, sans-serif; font-size: 21px; dominant-baseline: middle; }
    .qrTitle { font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: 700; text-anchor: middle; }
    .roomMapLabel { font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: 700; }
    .line { stroke: black; stroke-width: 2; fill: none; }
    .thin { stroke: black; stroke-width: 1.5; fill: none; }
  </style>

  <text x="30" y="55" class="title">AIRHOCKEY MATCH SHEET - ${displayMatchLabel}</text>

  <text x="32" y="102" class="bold">Table #:</text>
  <text x="125" y="102" class="text">${tableNum}</text>

  <text x="220" y="102" class="bold">Ref:</text>
  <text x="275" y="102" class="text">${refName}</text>

  ${bracketInfoBlock}

  <text x="32" y="148" class="bold">Player A:</text>
  <text x="135" y="148" class="text">${playerA}</text>

  <text x="32" y="180" class="bold">Player B:</text>
  <text x="135" y="180" class="text">${playerB}</text>

  ${qrBlock}

  <rect x="32" y="230" width="500" height="170" class="line"/>

  <line x1="32" y1="270" x2="532" y2="270" class="line"/>
  <line x1="32" y1="335" x2="532" y2="335" class="thin"/>

  <line x1="292" y1="230" x2="292" y2="400" class="line"/>

  <line x1="326" y1="230" x2="326" y2="400" class="thin"/>
  <line x1="360" y1="230" x2="360" y2="400" class="thin"/>
  <line x1="394" y1="230" x2="394" y2="400" class="thin"/>
  <line x1="428" y1="230" x2="428" y2="400" class="thin"/>
  <line x1="462" y1="230" x2="462" y2="400" class="thin"/>
  <line x1="496" y1="230" x2="496" y2="400" class="thin"/>

  <text x="162" y="250" class="cell">Player</text>
  <text x="309" y="250" class="cell">1</text>
  <text x="343" y="250" class="cell">2</text>
  <text x="377" y="250" class="cell">3</text>
  <text x="411" y="250" class="cell">4</text>
  <text x="445" y="250" class="cell">5</text>
  <text x="479" y="250" class="cell">6</text>
  <text x="514" y="250" class="cell">7</text>

  <text x="50" y="302" class="nameLeft">${playerA}</text>
  <text x="50" y="367" class="nameLeft">${playerB}</text>

  <text x="32" y="445" class="bold">Notes:</text>
  <line x1="110" y1="445" x2="728" y2="445" class="thin"/>
  <line x1="32" y1="490" x2="728" y2="490" class="thin"/>
  <line x1="32" y1="535" x2="728" y2="535" class="thin"/>

  ${matchIdBlock}
</svg>
`;
}

async function makePhotonSheetSvg(data) {
  const rawTableNum = String(data.tableNum || "").trim();

  const displayMatchLabel = xmlEscape(getDisplayMatchLabel(data));
  const bracketInfoLine = xmlEscape(getBracketInfoLine(data));

  const tableNum = xmlEscape(data.tableNum || "______");
  const refName = xmlEscape(data.refName || "____________");
  const playerA = xmlEscape(data.playerA || "");
  const playerB = xmlEscape(data.playerB || "");
  const matchId = xmlEscape(data.matchId || "");
  const scoreboardUrl = String(data.scoreboardUrl || "").trim();
  const customLogoDataUrl = sanitizeDataImage(data.customLogoDataUrl);
  const roomMapDataUrl = sanitizeDataImage(data.roomMapDataUrl);
  const roomMapLabel = rawTableNum ? `GO TO TABLE ${rawTableNum}` : "ROOM MAP";

  const qrDataUrl = await makeQrDataUrl(scoreboardUrl);
  const qrBlock = makeQrBlock({
    qrDataUrl,
    customLogoDataUrl,
    roomMapDataUrl,
    roomMapLabel,
    x: 548,
    y: 275,
    withLogoY: 235,
    roomMapY: 154
  });

  const bracketInfoBlock = bracketInfoLine ? `
    <text x="32" y="126" class="smallBold">Bracket ID:</text>
    <text x="125" y="126" class="smallText">${bracketInfoLine}</text>
  ` : "";

  const matchIdBlock = matchId ? `
    <text x="32" y="552" class="tinyBold">Match ID:</text>
    <text x="92" y="552" class="tinyText">${matchId}</text>
  ` : "";

  return `
<svg width="760" height="576" viewBox="0 0 760 576" xmlns="http://www.w3.org/2000/svg">
  <rect width="760" height="576" fill="white"/>

  <style>
    .title { font-family: Arial, Helvetica, sans-serif; font-size: 31px; font-weight: 700; }
    .text { font-family: Arial, Helvetica, sans-serif; font-size: 22px; }
    .bold { font-family: Arial, Helvetica, sans-serif; font-size: 22px; font-weight: 700; }
    .smallText { font-family: Arial, Helvetica, sans-serif; font-size: 14px; }
    .smallBold { font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: 700; }
    .tinyText { font-family: Arial, Helvetica, sans-serif; font-size: 11px; }
    .tinyBold { font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 700; }
    .helper { font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: 700; letter-spacing: .6px; }
    .cell { font-family: Arial, Helvetica, sans-serif; font-size: 25px; font-weight: 700; text-anchor: middle; dominant-baseline: middle; }
    .nameLeft { font-family: Arial, Helvetica, sans-serif; font-size: 21px; font-weight: 700; dominant-baseline: middle; }
    .qrTitle { font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: 700; text-anchor: middle; }
    .roomMapLabel { font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: 700; }
    .line { stroke: black; stroke-width: 3; fill: none; }
    .thin { stroke: black; stroke-width: 2; fill: none; }
  </style>

  <text x="30" y="55" class="title">PHOTON DOUBLES SHEET - ${displayMatchLabel}</text>

  <text x="32" y="102" class="bold">Table #:</text>
  <text x="125" y="102" class="text">${tableNum}</text>

  <text x="220" y="102" class="bold">Ref:</text>
  <text x="275" y="102" class="text">${refName}</text>

  ${bracketInfoBlock}

  <text x="32" y="152" class="bold">Player A:</text>
  <text x="135" y="152" class="text">${playerA}</text>

  <text x="32" y="190" class="bold">Player B:</text>
  <text x="135" y="190" class="text">${playerB}</text>

  <text x="32" y="246" class="helper">BIG BOX SCORECARD FOR BEST OF 1 OR BEST OF 3</text>

  ${qrBlock}

  <rect x="32" y="255" width="500" height="200" class="line"/>

  <line x1="32" y1="301" x2="532" y2="301" class="line"/>
  <line x1="32" y1="379" x2="532" y2="379" class="thin"/>

  <line x1="307" y1="255" x2="307" y2="455" class="line"/>
  <line x1="382" y1="255" x2="382" y2="455" class="thin"/>
  <line x1="457" y1="255" x2="457" y2="455" class="thin"/>

  <text x="169" y="278" class="cell">Player / Team</text>
  <text x="344" y="278" class="cell">G1</text>
  <text x="419" y="278" class="cell">G2</text>
  <text x="494" y="278" class="cell">G3</text>

  <text x="50" y="340" class="nameLeft">${playerA}</text>
  <text x="50" y="417" class="nameLeft">${playerB}</text>

  <text x="32" y="488" class="bold">Notes:</text>
  <line x1="110" y1="488" x2="728" y2="488" class="thin"/>
  <line x1="32" y1="532" x2="728" y2="532" class="thin"/>

  ${matchIdBlock}
</svg>
`;
}

async function printSheetImageFromSvg(svg, label = "ahms") {
  const tmpFile = path.join(os.tmpdir(), `${label}-${Date.now()}.png`);

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

async function printMatchSheetImage(data, options = {}) {
  const svg = await makeMatchSheetSvg(data, options);
  return printSheetImageFromSvg(svg, "ahms-match");
}

async function printPhotonSheetImage(data) {
  const svg = await makePhotonSheetSvg(data);
  return printSheetImageFromSvg(svg, "ahms-photon");
}

function formatPrintedAt() {
  return new Date().toLocaleString("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

function shortRankName(name) {
  const clean = safeText(name || "").trim().replace(/\s+/g, " ");
  if (!clean) return "Player";

  const parts = clean.split(" ").filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 4);
  }

  const firstInitial = parts[0].charAt(0).toUpperCase();
  const last = parts[parts.length - 1].slice(0, 5);

  return `${firstInitial} ${last}`;
}

function padRight(value, width) {
  const clean = safeText(value || "");
  if (clean.length >= width) return clean.slice(0, width);
  return clean + " ".repeat(width - clean.length);
}

function buildRankSetBlock(setNum, playerA, playerB) {
  const a = padRight(shortRankName(playerA), 7);
  const b = padRight(shortRankName(playerB), 7);

  return [
    `SET ${setNum}`,
    "Player   1  2  3  4  5  6  7",
    `${a} [_][_][_][_][_][_][_]`,
    `${b} [_][_][_][_][_][_][_]`
  ].join("\n");
}

function printRankMatch(printer, data) {
  const printedAt = formatPrintedAt();

  const displayMatchLabel = safeText(getDisplayMatchLabel(data), "Match _____");
  const bracketInfoLine = safeText(getBracketInfoLine(data), "");

  const tableNum = safeText(data.tableNum, "__________");
  const refName = safeText(data.refName, "______________");
  const playerA = safeText(data.playerA, "____________________");
  const playerB = safeText(data.playerB, "____________________");

  const setBlocks = [];

  for (let i = 1; i <= 7; i++) {
    setBlocks.push(buildRankSetBlock(i, playerA, playerB));
  }

  printer
    .align("ct")
    .style("b")
    .size(1, 1)
    .text("RANK MATCH")
    .style("normal")
    .size(0, 0)
    .align("lt")
    .text(line("="))
    .text(`Date/Time: ${printedAt}`)
    .text("Location: ____________________________")
    .text(`Match: ${displayMatchLabel}`);

  if (bracketInfoLine) {
    printer.text(`Bracket ID: ${bracketInfoLine}`);
  }

  printer
    .text(`Table: ${tableNum}`)
    .text(`Ref: ${refName}`)
    .text("Wit(s) | Alt Ref(s)")
    .text("________________________________________")
    .text("________________________________________")
    .text(line("-"))
    .style("b")
    .text("Player A:")
    .style("normal")
    .text(playerA)
    .text("Nat#: ____  Reg#: ____  Loc#: ____")
    .text("")
    .style("b")
    .text("Player B:")
    .style("normal")
    .text(playerB)
    .text("Nat#: ____  Reg#: ____  Loc#: ____")
    .text(line("-"))
    .style("b")
    .text("Sets & Games")
    .style("normal")
    .text("___ OUT OF ____ GAMES/SET")
    .text("____ OUT OF ____ SETS/MATCH")
    .text(line("-"));

  setBlocks.forEach((block, index) => {
    printer.text(block);

    if (index < setBlocks.length - 1) {
      printer.text("");
    }
  });

  printer
    .text(line("-"))
    .text("Rank Changes:")
    .text("________________________________________")
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
      bracketMatchId: data.bracketMatchId,
      bracketLane: data.bracketLane,
      tableNum: data.tableNum,
      refName: data.refName,
      playerA: data.playerA,
      playerB: data.playerB,
      matchId: data.matchId,
      scoreboardUrl: data.scoreboardUrl,
      hasScoreboardUrl: !!data.scoreboardUrl,
      hasCustomLogo: !!data.customLogoDataUrl,
      hasRoomMap: !!data.roomMapDataUrl
    });

    if (mode === "rank") {
      await printWithEscpos((printer) => {
        printRankMatch(printer, data);
      });
    } else if (mode === "blank") {
      await printMatchSheetImage(data, { blank: true });
    } else if (mode === "photon") {
      await printPhotonSheetImage(data);
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
