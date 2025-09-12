// ===========================================================
// AHMS Client Script (drop-in)
// Prints a CANVAS IMAGE to Epson via Node server (/print-image)
// Browser preview & other buttons remain unchanged
// ===========================================================

// 🔧 Your Node print server base:
const PRINT_SERVER_URL = "http://192.168.1.2:3000";

// ============ Canvas drawing (matches the card layout) ============
function drawMatchCardCanvas({ matchNum, tableNum, refName }) {
  // 80mm Epson typically ~576 dots wide at 203 dpi
  const W = 576;
  const H = 520; // grows if needed
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // helpers
  const BLACK = "#000000";
  const GRAY = "#000000";
  const P = 20; // outer padding
  const LINE = 2; // line thickness

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = BLACK;
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = LINE;

  // Title
  const title = `AIRHOCKEY MATCH SHEET - Match ${matchNum || "_____"}`;
  ctx.font = "bold 40px Arial";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  const titleX = P;
  let y = P;
  ctx.fillText(title, titleX, y);
  y += 54;

  // Info row
  ctx.font = "bold 26px Arial";
  const infoL = `Table #: ${tableNum || "______"}`;
  const infoR = `Ref: ${refName || "____________"}`;

  ctx.fillText(infoL, P, y);
  ctx.textAlign = "right";
  ctx.fillText(infoR, W - P, y);
  ctx.textAlign = "left";
  y += 30;

  // Table box geometry
  y += 18;
  const boxX = P;
  const boxY = y;
  const boxW = W - P * 2;
  const rowH = 56;
  const headH = 46;
  const rows = 3; // header + two player rows
  const boxH = headH + rowH * 2;

  // Outer box
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  // Vertical columns: Player | 1..7
  const playerColW = Math.round(boxW * 0.58); // visually like your image
  const gameCols = 7;
  const gameColW = Math.floor((boxW - playerColW) / gameCols);

  // Header row line
  ctx.beginPath();
  ctx.moveTo(boxX, boxY + headH);
  ctx.lineTo(boxX + boxW, boxY + headH);
  ctx.stroke();

  // Row separator (between players)
  ctx.beginPath();
  ctx.moveTo(boxX, boxY + headH + rowH);
  ctx.lineTo(boxX + boxW, boxY + headH + rowH);
  ctx.stroke();

  // Vertical line after "Player" column
  ctx.beginPath();
  ctx.moveTo(boxX + playerColW, boxY);
  ctx.lineTo(boxX + playerColW, boxY + boxH);
  ctx.stroke();

  // Vertical grid lines for 7 game columns
  for (let i = 1; i < gameCols; i++) {
    const x = boxX + playerColW + i * gameColW;
    ctx.beginPath();
    ctx.moveTo(x, boxY + headH);
    ctx.lineTo(x, boxY + boxH);
    ctx.stroke();
  }

  // Header labels
  ctx.font = "bold 24px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Player", boxX + playerColW / 2, boxY + (headH - 24) / 2 + 4);

  for (let i = 0; i < gameCols; i++) {
    const cx = boxX + playerColW + i * gameColW + gameColW / 2;
    ctx.fillText(String(i + 1), cx, boxY + (headH - 24) / 2 + 4);
  }
  ctx.textAlign = "left";

  // Player name underlines in first column (two rows)
  ctx.strokeStyle = GRAY;
  ctx.lineWidth = 2;
  const underlineInset = 20;
  const u1y = boxY + headH + Math.floor(rowH * 0.5);
  const u2y = boxY + headH + rowH + Math.floor(rowH * 0.5);
  const uL = boxX + underlineInset;
  const uR = boxX + playerColW - underlineInset;

  ctx.beginPath();
  ctx.moveTo(uL, u1y);
  ctx.lineTo(uR, u1y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(uL, u2y);
  ctx.lineTo(uR, u2y);
  ctx.stroke();

  // Notes label
  y = boxY + boxH + 28;
  ctx.fillStyle = BLACK;
  ctx.font = "bold 26px Arial";
  ctx.fillText("Notes:", P, y);

  // return PNG data URL
  return canvas.toDataURL("image/png");
}

// ============ Send image to server ============
async function sendImageToPrinter({ pngDataUrl, title }) {
  try {
    const res = await fetch(`${PRINT_SERVER_URL}/print-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title || "AIRHOCKEY MATCH SHEET",
        imageBase64: pngDataUrl.split(",")[1] // strip data URL prefix
      })
    });
    const msg = await res.text();
    if (!res.ok) throw new Error(msg || "Printer server error");
    alert("🖨️ Printed!");
  } catch (err) {
    console.error(err);
    alert("⚠️ Could not connect to printer.\n" + err.message);
  }
}

// ============ Existing preview (unchanged) ============
document.getElementById("matchForm").addEventListener("submit", function (e) {
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

// ============ Print (now uses canvas→image) ============
document.getElementById("printBtn").addEventListener("click", () => {
  const matchNum = document.getElementById("matchNum").value || "";
  const tableNum = document.getElementById("tableNum").value || "";
  const refName  = document.getElementById("refName").value  || "";

  const png = drawMatchCardCanvas({ matchNum, tableNum, refName });
  const title = `AIRHOCKEY MATCH SHEET - Match ${matchNum || ""}`;
  sendImageToPrinter({ pngDataUrl: png, title });
});

// ============ Other buttons unchanged ============
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
// URL params (unchanged)
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
