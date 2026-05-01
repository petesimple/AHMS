/* ===========================================================
   AHMS ESC/POS Print Bridge
   Raspberry Pi 400 -> Epson TM-T88 Network Printer

   Browser AHMS app sends JSON to:
   POST http://PI_IP:3000/print-match

   Printer receives ESC/POS over port 9100.
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

// Change this to your Epson T88 IP.
const PRINTER_IP = "192.168.1.229";
const PRINTER_PORT = 9100;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

function safeText(value, fallback = "") {
  return String(value || fallback).replace(/[^\x20-\x7E\n\r\t]/g, "");
}

function line(char = "-", count = 42) {
  return char.repeat(count);
}

function centerText(text, width = 42) {
  text = safeText(text);
  if (text.length >= width) return text;
  const pad = Math.floor((width - text.length) / 2);
  return " ".repeat(pad) + text;
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

function printStandardMatch(printer, data) {
  const matchNum = safeText(data.matchNum, "_____");
  const tableNum = safeText(data.tableNum, "______");
  const refName = safeText(data.refName, "____________");
  const playerA = safeText(data.playerA, "____________________");
  const playerB = safeText(data.playerB, "____________________");

  printer
    .align("ct")
    .style("b")
    .size(1, 1)
    .text("AIRHOCKEY MATCH SHEET")
    .style("normal")
    .size(0, 0)
    .text(`Match ${matchNum}`)
    .align("lt")
    .text(line("="))
    .text(`Table #: ${tableNum}`)
    .text(`Ref: ${refName}`)
    .text(line("-"))
    .style("b")
    .text("Player                 1 2 3 4 5 6 7")
    .style("normal")
    .text(line("-"))
    .text(`${playerA.padEnd(22).slice(0, 22)} _ _ _ _ _ _ _`)
    .text("")
    .text(`${playerB.padEnd(22).slice(0, 22)} _ _ _ _ _ _ _`)
    .text(line("-"))
    .text("Notes:")
    .text("________________________________________")
    .text("________________________________________")
    .text("________________________________________")
    .text("");
}

function printBlankMatch(printer) {
  printer
    .align("ct")
    .style("b")
    .size(1, 1)
    .text("AIRHOCKEY MATCH SHEET")
    .style("normal")
    .size(0, 0)
    .text("Match _____")
    .align("lt")
    .text(line("="))
    .text("Table #: ______")
    .text("Ref: ____________")
    .text(line("-"))
    .style("b")
    .text("Player                 1 2 3 4 5 6 7")
    .style("normal")
    .text(line("-"))
    .text("____________________   _ _ _ _ _ _ _")
    .text("")
    .text("____________________   _ _ _ _ _ _ _")
    .text(line("-"))
    .text("Notes:")
    .text("________________________________________")
    .text("________________________________________")
    .text("________________________________________")
    .text("");
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

    await printWithEscpos((printer) => {
      if (mode === "rank") {
        printRankMatch(printer, data);
      } else if (mode === "blank") {
        printBlankMatch(printer);
      } else {
        printStandardMatch(printer, data);
      }
    });

    res.json({ ok: true, message: "Printed via ESC/POS" });
  } catch (err) {
    console.error("Print error:", err);
    res.status(500).json({
      ok: false,
      error: err.message || String(err)
    });
  }
});

app.get("/", (req, res) => {
  res.send("AHMS ESC/POS bridge is running.");
});

app.listen(SERVER_PORT, "0.0.0.0", () => {
  console.log(`AHMS ESC/POS bridge running on port ${SERVER_PORT}`);
  console.log(`Printer target: ${PRINTER_IP}:${PRINTER_PORT}`);
});
