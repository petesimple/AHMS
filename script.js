// ===========================================================
// AHMS Client Script (drop-in)
// RAW receipt-safe formatting to Epson via Node server
// ===========================================================

// 🔧 Your Node print server endpoint:
const PRINT_SERVER_URL = "http://192.168.1.2:3000/print"; // keep /print route

// ---- Fixed-width receipt helpers (48-col default) ----
const RECEIPT_WIDTH = 48;

function padRight(str = "", len = RECEIPT_WIDTH) {
  const s = String(str);
  return s.length >= len ? s.slice(0, len) : s + " ".repeat(len - s.length);
}
function padLeft(str = "", len = RECEIPT_WIDTH) {
  const s = String(str);
  return s.length >= len ? s.slice(0, len) : " ".repeat(len - s.length) + s;
}
function center(str = "", len = RECEIPT_WIDTH) {
  const s = String(str).slice(0, len);
  const space = Math.max(0, len - s.length);
  const left = Math.floor(space / 2);
  const right = space - left;
  return " ".repeat(left) + s + " ".repeat(right);
}

// 48-col split: Player(18) | 7 game cells @4 each (28) | fits ≤ 48
const PLAYER_COL = 18;
const GAME_COL = 4;
const GAME_COUNT = 7;

function makeGameHeader() {
  const gameNums = Array.from({ length: GAME_COUNT }, (_, i) =>
    padLeft(String(i + 1), GAME_COL)
  ).join("");
  return padRight("Player", PLAYER_COL) + gameNums;
}

function makePlayerRow(name = "") {
  const clean = (name || "").trim();
  const cells = Array.from({ length: GAME_COUNT }, () => padLeft("[  ]", GAME_COL)).join("");
  return padRight(clean, PLAYER_COL) + cells;
}

function makeDivider(char = "-") {
  return char.repeat(RECEIPT_WIDTH);
}

// Build a clean, fixed-width receipt independent of the HTML table
function buildReceiptLines() {
  const matchNum = document.getElementById("matchNum").value || "";
  const tableNum = document.getElementById("tableNum").value || "";
  const refName  = document.getElementById("refName").value || "";
  const playerA  = document.getElementById("playerA").value || "";
  const playerB  = document.getElementById("playerB").value || "";

  const lines = [];
  lines.push(center("AIRHOCKEY MATCH SHEET", RECEIPT_WIDTH));
  lines.push(center(`Match ${matchNum}`, RECEIPT_WIDTH));
  lines.push(makeDivider());
  lines.push(padRight(`Table: ${tableNum}`));
  lines.push(padRight(`Ref:   ${refName}`));
  lines.push(makeDivider());
  lines.push(makeGameHeader());
  lines.push(makeDivider());
  lines.push(makePlayerRow(playerA));
  lines.push(makePlayerRow(playerB));
  lines.push(makeDivider());
  lines.push("Notes:");
  lines.push("");
  lines.push("");
  lines.push("");
  lines.push("");

  return { title: `AIRHOCKEY MATCH SHEET - Match ${matchNum}`.trim(), lines };
}

// Kept for preview/table rendering on the page (unused by print)
function buildPrintPayloadRaw() {
  const text = document.getElementById("output").innerText
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const lines = text.split("\n");
  const matchNum = document.getElementById("matchNum").value || "";
  return {
    title: `AIRHOCKEY MATCH SHEET - Match ${matchNum}`.trim(),
    lines
  };
}

// Send JSON to Node print server (/print → RAW 9100 downstream)
async function sendToPrinterRAW(payload) {
  try {
    const res = await fetch(PRINT_SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const msg = await res.text();
    if (!res.ok) throw new Error(msg || "Printer server error");
    console.log("✅", msg);
    alert("🖨️ Print sent!");
  } catch (err) {
    console.error("❌ Print failed:", err);
    alert("⚠️ Could not connect to printer.\n" + err.message);
  }
}

// ===========================================================
// Form submission: build HTML preview of the match sheet
// (unchanged visual preview for the page)
// ===========================================================
document.getElementById("matchForm").addEventListener("submit", function(e) {
  e.preventDefault();

  const matchNum = document.getElementById("matchNum").value;
  const tableNum = document.getElementById("tableNum").value;
  const refName = document.getElementById("refName").value;
  const playerA = document.getElementById("playerA").value;
  const playerB = document.getElementById("playerB").value;

  const output = document.getElementById("output");
  output.innerHTML = `
    <h2>AIRHOCKEY MATCH SHEET - Match ${matchNum || "_____"}</h2>
    <p><strong>Table #:</strong> ${tableNum || "_______"} &nbsp; | &nbsp; <strong>Ref:</strong> ${refName || "____________"}</p>
    <table>
      <tr><th>Player</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th></tr>
      <tr><td>${playerA || "<span style='display:inline-block;width:85%;'>&nbsp;</span><hr/>"}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
      <tr><td>${playerB || "<span style='display:inline-block;width:85%;'>&nbsp;</span><hr/>"}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    </table>
  `;

  output.classList.remove("hidden");
  document.getElementById("printBtn").classList.remove("hidden");
  document.getElementById("printBrowserBtn").classList.remove("hidden");
  document.getElementById("downloadBtn").classList.remove("hidden");
});

// ===========================================================
// Print buttons
// ===========================================================

// ✅ Print uses the fixed-width receipt lines from your snippet
document.getElementById("printBtn").addEventListener("click", () => {
  const payload = buildReceiptLines(); // receipt-safe text
  sendToPrinterRAW(payload);
});

// Browser print (unchanged)
document.getElementById("printBrowserBtn").addEventListener("click", () => {
  window.print();
});

// Blank sheet (unchanged preview)
document.getElementById("printBlankBtn").addEventListener("click", () => {
  const output = document.getElementById("output");
  output.innerHTML = `
    <h2>AIRHOCKEY MATCH SHEET - Match _____</h2>
    <p><strong>Table #:</strong> ______ &nbsp; | &nbsp; <strong>Ref:</strong> ____________</p>
    <table>
      <tr><th>Player</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th></tr>
      <tr><td>_______________________</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
      <tr><td>_______________________</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    </table>
  `;
  output.classList.remove("hidden");
  document.getElementById("printBtn").classList.remove("hidden");
  document.getElementById("printBrowserBtn").classList.remove("hidden");
  document.getElementById("downloadBtn").classList.remove("hidden");
});

// Rank Match (unchanged preview only)
document.getElementById("printRankMatchBtn").addEventListener("click", () => {
  const output = document.getElementById("output");
  output.innerHTML = `
    <div class="receipt">
      <h2>RANK MATCH</h2>
      <p><strong>Match:</strong> __________</p>
      <p><strong>Table:</strong> __________</p>
      <p><strong>Ref:</strong> ______________</p>
      <p><strong>Wit(s):</strong> ______________</p>
      <p>______________________________</p>
      <p>______________________________</p>

      <hr>

      <p><strong>Player A:</strong> ____________________</p>
      <p>Nat#: ____ Reg#: ____ Loc#: ____</p>

      <p><strong>Player B:</strong> ____________________</p>
      <p>Nat#: ____ Reg#: ____ Loc#: ____</p>

      <hr>

      <p><strong>Sets & Games:</strong></p>
      <p>___OUT OF____GAMES/SET : ____OUT OF____ SETS/MATCH</p>
      <pre>
Set 1: [_____] [_____] [_____] [_____] [_____] [_____] [_____]
Set 2: [_____] [_____] [_____] [_____] [_____] [_____] [_____]
Set 3: [_____] [_____] [_____] [_____] [_____] [_____] [_____]
Set 4: [_____] [_____] [_____] [_____] [_____] [_____] [_____]
Set 5: [_____] [_____] [_____] [_____] [_____] [_____] [_____]
Set 6: [_____] [_____] [_____] [_____] [_____] [_____] [_____]
Set 7: [_____] [_____] [_____] [_____] [_____] [_____] [_____]
      </pre>

      <p><strong>Rank Changes:</strong> ____________________</p>

      <p><strong>Notes:</strong></p>
      <p>______________________________</p>
    </div>
  `;
  output.classList.remove("hidden");
  document.getElementById("printBtn").classList.remove("hidden");
  document.getElementById("printBrowserBtn").classList.remove("hidden");
  document.getElementById("downloadBtn").classList.remove("hidden");
});

// Download (unchanged)
document.getElementById("downloadBtn").addEventListener("click", () => {
  const outputText = document.getElementById("output").innerText;
  const blob = new Blob([outputText], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;

  const matchNum = document.getElementById("matchNum")?.value || "";
  const filename = `Match_${matchNum || "Blank"}_${Date.now()}.txt`;
  link.download = filename;

  link.click();
  URL.revokeObjectURL(url);

  alert(`✅ Match card downloaded as "${filename}"!

🖨️ To print from Terminal (macOS/Linux):
lp path/to/${filename}

🖨️ To print from CMD (Windows):
notepad /p path\\to\\${filename}`);
});

// ===========================================================
// URL param auto-fill (unchanged)
// ===========================================================
function getParam(name) {
  return new URLSearchParams(window.location.search).get(name) || "";
}

window.addEventListener("load", () => {
  const matchNum = getParam("match");
  const tableNum = getParam("table");
  const refName = getParam("ref");
  const playerA = getParam("playerA");
  const playerB = getParam("playerB");

  if (matchNum || playerA || playerB) {
    document.getElementById("matchNum").value = matchNum;
    document.getElementById("tableNum").value = tableNum;
    document.getElementById("refName").value = refName;
    document.getElementById("playerA").value = playerA;
    document.getElementById("playerB").value = playerB;

    if (matchNum && tableNum && refName && playerA && playerB) {
      document.getElementById("matchForm").dispatchEvent(new Event("submit"));
      if (typeof showAllButtons === "function") showAllButtons();
    }
  }
});
