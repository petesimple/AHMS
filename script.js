// ===========================================================
// AHMS Client Script (drop-in)
// Epson RAW (9100) printing with ASCII table borders
// ===========================================================

// 🔧 Point this at your Mac running the Node print server:
const PRINT_SERVER_URL = "http://192.168.1.2:3000/print";

// ===========================================================
// Fixed-width helpers (48 columns total on 80mm paper)
// Table layout: | Player(18) | 7 × Game(3) |
// Line length = sum(widths) + 9 borders = 48
// ===========================================================
const RECEIPT_WIDTH = 48;
const COLS = [18, 3, 3, 3, 3, 3, 3, 3]; // Player + 1..7

function padLeft(s, w) {
  s = String(s ?? "");
  return s.length >= w ? s.slice(0, w) : " ".repeat(w - s.length) + s;
}
function padRight(s, w) {
  s = String(s ?? "");
  return s.length >= w ? s.slice(0, w) : s + " ".repeat(w - s.length);
}
function padCenter(s, w) {
  s = String(s ?? "").slice(0, w);
  const space = Math.max(0, w - s.length);
  const left = Math.floor(space / 2);
  const right = space - left;
  return " ".repeat(left) + s + " ".repeat(right);
}
function centerLine(s) {
  return padCenter(s, RECEIPT_WIDTH);
}

// +----+---+---+... line
function borderLine() {
  let out = "+";
  for (const w of COLS) out += "-".repeat(w) + "+";
  return out;
}

// | cell | cell | ... line
function rowLine(cells, align = "left") {
  let out = "|";
  for (let i = 0; i < COLS.length; i++) {
    const w = COLS[i];
    const txt = cells[i] ?? "";
    const padded =
      align === "center" ? padCenter(txt, w)
      : align === "right"  ? padLeft(txt, w)
      : padRight(txt, w);
    out += padded + "|";
  }
  return out;
}

// underline inside first cell
function underlineCell(len) {
  const lineLen = Math.max(0, len - 4); // 2-space margins
  return "  " + "_".repeat(lineLen) + "  ";
}

// ===========================================================
// Build receipt text that matches the screenshot
// ===========================================================
function buildReceiptLines() {
  const matchNum = document.getElementById("matchNum").value || "_____";
  const tableNum = document.getElementById("tableNum").value || "______";
  const refName  = document.getElementById("refName").value  || "____________";

  const lines = [];
  lines.push(centerLine(`AIRHOCKEY MATCH SHEET - Match ${matchNum}`));
  lines.push(""); // spacer
  lines.push(padRight(`Table #: ${tableNum}   |   Ref: ${refName}`, RECEIPT_WIDTH));
  lines.push(""); // spacer before table

  // Table header + two rows
  lines.push(borderLine());
  lines.push(rowLine(["Player", "1", "2", "3", "4", "5", "6", "7"], "center"));
  lines.push(borderLine());
  lines.push(rowLine([underlineCell(COLS[0]), "", "", "", "", "", "", ""], "left"));
  lines.push(borderLine());
  lines.push(rowLine([underlineCell(COLS[0]), "", "", "", "", "", "", ""], "left"));
  lines.push(borderLine());

  // tail for clean cut
  lines.push("");
  lines.push("");

  return { title: `AIRHOCKEY MATCH SHEET - Match ${matchNum}`.trim(), lines };
}

// ===========================================================
// Send JSON to Node print server (which sends RAW 9100)
// ===========================================================
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
// Form submission: HTML preview (unchanged)
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
      <tr><td><span style="display:inline-block;width:85%;">&nbsp;</span><hr/></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
      <tr><td><span style="display:inline-block;width:85%;">&nbsp;</span><hr/></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    </table>
  `;

  output.classList.remove("hidden");
  document.getElementById("printBtn").classList.remove("hidden");
  document.getElementById("printBrowserBtn").classList.remove("hidden");
  document.getElementById("downloadBtn").classList.remove("hidden");
});

// ===========================================================
// Print / Browser print / Blank / Rank Match / Download
// ===========================================================
document.getElementById("printBtn").addEventListener("click", () => {
  const payload = buildReceiptLines(); // ASCII-border version
  sendToPrinterRAW(payload);
});

document.getElementById("printBrowserBtn").addEventListener("click", () => {
  window.print();
});

document.getElementById("printBlankBtn").addEventListener("click", () => {
  const output = document.getElementById("output");
  output.innerHTML = `
    <h2>AIRHOCKEY MATCH SHEET - Match _____</h2>
    <p><strong>Table #:</strong> ______ &nbsp; | &nbsp; <strong>Ref:</strong> ____________</p>
    <table>
      <tr><th>Player</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th></tr>
      <tr><td><span style="display:inline-block;width:85%;">&nbsp;</span><hr/></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
      <tr><td><span style="display:inline-block;width:85%;">&nbsp;</span><hr/></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
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
