/* ===========================================================
   AHMS script.js (drop-in)
   - Generates on-screen preview (same as before)
   - Prints a HIGH-QUALITY CANVAS IMAGE via Node bridge: POST /print-image
   - Keeps Browser Print + Blank + Rank Match + Download
   - Works with URL params (match, table, ref, playerA, playerB)

   IMPORTANT:
   Your Node bridge MUST expose:
     POST http://<BRIDGE_IP>:<BRIDGE_PORT>/print-image
   Body (JSON):
     {
       "title": "optional",
       "imageBase64": "<base64 PNG, no data: prefix>",
       "copies": 1
     }

   Set PRINT_SERVER_URL below to your bridge machine IP/port.
=========================================================== */

const PRINT_SERVER_URL = "http://192.168.1.66:5055"; // <- change to your bridge IP:port

// Optional: set to true to also send a text fallback if image printing fails
const ENABLE_TEXT_FALLBACK = false;

// ============ Utility ============
function $(id){ return document.getElementById(id); }

function escapeHtml(str){
  return String(str || "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function getParam(name){
  return new URLSearchParams(window.location.search).get(name) || "";
}

async function fetchWithTimeout(url, options = {}, ms = 8000){
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try{
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

// ============ Canvas drawing (80mm look, crisp) ============
// Notes:
// - 80mm Epson is often 576px wide at 203dpi
// - Keep text black on white, avoid antialias fuzz where possible
function drawMatchCardCanvas({ matchNum, tableNum, refName, playerA, playerB, mode }) {
  const W = 576;
  // slightly taller so "Notes" sits nicely
  const H = mode === "rank" ? 980 : 620;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  const P = 18;       // padding
  const LINE = 2;     // stroke
  const BLACK = "#000";

  ctx.strokeStyle = BLACK;
  ctx.fillStyle = BLACK;
  ctx.lineWidth = LINE;
  ctx.textBaseline = "top";

  let y = P;

  // Header
  const title =
    mode === "rank"
      ? "RANK MATCH"
      : `AIRHOCKEY MATCH SHEET - Match ${matchNum || "_____"}`;

  ctx.font = "bold 34px Arial";
  ctx.textAlign = "left";
  ctx.fillText(title, P, y);
  y += 44;

  // Sub header line
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(P, y);
  ctx.lineTo(W - P, y);
  ctx.stroke();
  y += 12;

  // Info row
  ctx.font = "bold 24px Arial";
  const infoL = `Table #: ${tableNum || "______"}`;
  const infoR = `Ref: ${refName || "____________"}`;

  ctx.textAlign = "left";
  ctx.fillText(infoL, P, y);

  ctx.textAlign = "right";
  ctx.fillText(infoR, W - P, y);

  ctx.textAlign = "left";
  y += 34;

  if(mode === "rank"){
    // Rank match receipt style (text heavy, looks great on thermal)
    ctx.font = "bold 22px Arial";
    const lines = [
      "",
      "Match: __________",
      "Table: __________",
      "Ref: ______________",
      "Wit(s): ______________",
      "--------------------------------",
      "Player A: ____________________",
      "Nat#: ____  Reg#: ____  Loc#: ____",
      "",
      "Player B: ____________________",
      "Nat#: ____  Reg#: ____  Loc#: ____",
      "--------------------------------",
      "Sets & Games:",
      "___OUT OF____GAMES/SET : ____OUT OF____ SETS/MATCH",
      "",
      "Set 1: [_____] [_____] [_____] [_____] [_____] [_____] [_____]",
      "Set 2: [_____] [_____] [_____] [_____] [_____] [_____] [_____]",
      "Set 3: [_____] [_____] [_____] [_____] [_____] [_____] [_____]",
      "Set 4: [_____] [_____] [_____] [_____] [_____] [_____] [_____]",
      "Set 5: [_____] [_____] [_____] [_____] [_____] [_____] [_____]",
      "Set 6: [_____] [_____] [_____] [_____] [_____] [_____] [_____]",
      "Set 7: [_____] [_____] [_____] [_____] [_____] [_____] [_____]",
      "",
      "Rank Changes: ____________________",
      "",
      "Notes:",
      "______________________________",
      "______________________________",
      "______________________________"
    ];

    ctx.textAlign = "left";
    for(const line of lines){
      ctx.fillText(line, P, y);
      y += 28;
      if(y > H - 30) break;
    }

    // Footer feed space
    return canvas.toDataURL("image/png");
  }

  // Match sheet grid
  y += 10;

  const boxX = P;
  const boxY = y;
  const boxW = W - P * 2;

  const headH = 44;
  const rowH = 64;
  const boxH = headH + rowH * 2;

  // Outer box
  ctx.lineWidth = 2;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  // Columns: Player | 1..7
  const playerColW = Math.round(boxW * 0.56);
  const gameCols = 7;
  const gameColW = Math.floor((boxW - playerColW) / gameCols);

  // Header divider
  ctx.beginPath();
  ctx.moveTo(boxX, boxY + headH);
  ctx.lineTo(boxX + boxW, boxY + headH);
  ctx.stroke();

  // Row divider
  ctx.beginPath();
  ctx.moveTo(boxX, boxY + headH + rowH);
  ctx.lineTo(boxX + boxW, boxY + headH + rowH);
  ctx.stroke();

  // Vertical after Player
  ctx.beginPath();
  ctx.moveTo(boxX + playerColW, boxY);
  ctx.lineTo(boxX + playerColW, boxY + boxH);
  ctx.stroke();

  // Game verticals
  for(let i = 1; i < gameCols; i++){
    const x = boxX + playerColW + i * gameColW;
    ctx.beginPath();
    ctx.moveTo(x, boxY + headH);
    ctx.lineTo(x, boxY + boxH);
    ctx.stroke();
  }

  // Header labels
  ctx.font = "bold 22px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Player", boxX + playerColW / 2, boxY + 10);

  for(let i = 0; i < gameCols; i++){
    const cx = boxX + playerColW + i * gameColW + gameColW / 2;
    ctx.fillText(String(i + 1), cx, boxY + 10);
  }

  // Player lines and optional names lightly printed
  ctx.textAlign = "left";
  ctx.font = "bold 22px Arial";

  const namePadL = 14;
  const namePadR = 14;

  const nameAreaL = boxX + namePadL;
  const nameAreaR = boxX + playerColW - namePadR;

  // faint names (optional)
  const drawName = (name, rowIndex) => {
    if(!name) return;
    const ny = boxY + headH + rowIndex * rowH + 10;
    ctx.fillText(name, nameAreaL, ny);
  };

  drawName(playerA, 0);
  drawName(playerB, 1);

  // underline
  const underlineY1 = boxY + headH + Math.floor(rowH * 0.70);
  const underlineY2 = boxY + headH + rowH + Math.floor(rowH * 0.70);

  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(nameAreaL, underlineY1);
  ctx.lineTo(nameAreaR, underlineY1);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(nameAreaL, underlineY2);
  ctx.lineTo(nameAreaR, underlineY2);
  ctx.stroke();

  // Notes label + lines
  y = boxY + boxH + 22;
  ctx.font = "bold 24px Arial";
  ctx.textAlign = "left";
  ctx.fillText("Notes:", P, y);
  y += 34;

  ctx.lineWidth = 2;
  for(let i = 0; i < 3; i++){
    ctx.beginPath();
    ctx.moveTo(P, y + i * 34);
    ctx.lineTo(W - P, y + i * 34);
    ctx.stroke();
  }

  return canvas.toDataURL("image/png");
}

// ============ Printer send (image) ============
async function sendImageToPrinter({ pngDataUrl, title, copies = 1 }){
  const imageBase64 = pngDataUrl.split(",")[1];
  const payload = { title: title || "AHMS", imageBase64, copies };

  const res = await fetchWithTimeout(`${PRINT_SERVER_URL}/print-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }, 12000);

  // Bridge may respond json or text
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}

  if(!res.ok){
    throw new Error((data && data.error) ? data.error : (text || `Printer error (${res.status})`));
  }
  if(data && data.ok === false){
    throw new Error(data.error || "Printer server returned ok:false");
  }
  return true;
}

// Optional text fallback (only if your bridge has /print)
async function sendTextToPrinter(text){
  const res = await fetchWithTimeout(`${PRINT_SERVER_URL}/print`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: text
  }, 8000);

  const textRes = await res.text();
  let data = null;
  try { data = JSON.parse(textRes); } catch {}

  if(!res.ok){
    throw new Error((data && data.error) ? data.error : (textRes || `Print failed (${res.status})`));
  }
  if(data && data.ok === false){
    throw new Error(data.error || "Bridge returned ok:false");
  }
}

// ============ Preview HTML builders ============
function showAllButtons(){
  $("printBtn")?.classList.remove("hidden");
  $("printBrowserBtn")?.classList.remove("hidden");
  $("downloadBtn")?.classList.remove("hidden");
}

function setOutput(html){
  const output = $("output");
  output.innerHTML = html;
  output.classList.remove("hidden");
  showAllButtons();
}

function buildMatchPreviewHTML({ matchNum, tableNum, refName }){
  return `
    <h2>AIRHOCKEY MATCH SHEET - Match ${escapeHtml(matchNum || "_____")}</h2>
    <p><strong>Table #:</strong> ${escapeHtml(tableNum || "_______")}
    &nbsp; | &nbsp; <strong>Ref:</strong> ${escapeHtml(refName || "____________")}</p>
    <table>
      <tr><th>Player</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th></tr>
      <tr><td><span style="display:inline-block;width:85%;">&nbsp;</span><hr/></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
      <tr><td><span style="display:inline-block;width:85%;">&nbsp;</span><hr/></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    </table>
  `;
}

function buildBlankPreviewHTML(){
  return `
    <h2>AIRHOCKEY MATCH SHEET - Match _____</h2>
    <p><strong>Table #:</strong> ______ &nbsp; | &nbsp; <strong>Ref:</strong> ____________</p>
    <table>
      <tr><th>Player</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th></tr>
      <tr><td><span style="display:inline-block;width:85%;">&nbsp;</span><hr/></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
      <tr><td><span style="display:inline-block;width:85%;">&nbsp;</span><hr/></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    </table>
  `;
}

function buildRankPreviewHTML(){
  return `
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
}

// Track what is currently shown so the Print button knows what to render
let CURRENT_MODE = "match"; // "match" | "blank" | "rank"

// ============ Events ============

// Generate Sheet
$("matchForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  CURRENT_MODE = "match";

  const matchNum = $("matchNum")?.value || "";
  const tableNum = $("tableNum")?.value || "";
  const refName  = $("refName")?.value  || "";

  setOutput(buildMatchPreviewHTML({ matchNum, tableNum, refName }));
});

// Print to Epson (IMAGE)
$("printBtn")?.addEventListener("click", async () => {
  const matchNum = $("matchNum")?.value || "";
  const tableNum = $("tableNum")?.value || "";
  const refName  = $("refName")?.value  || "";
  const playerA  = $("playerA")?.value  || "";
  const playerB  = $("playerB")?.value  || "";

  try{
    let png, title;

    if(CURRENT_MODE === "rank"){
      png = drawMatchCardCanvas({ matchNum, tableNum, refName, playerA, playerB, mode: "rank" });
      title = "RANK MATCH";
    } else if(CURRENT_MODE === "blank"){
      png = drawMatchCardCanvas({ matchNum: "", tableNum: "", refName: "", playerA: "", playerB: "", mode: "blank" });
      title = "AIRHOCKEY MATCH SHEET";
    } else {
      png = drawMatchCardCanvas({ matchNum, tableNum, refName, playerA, playerB, mode: "match" });
      title = `AIRHOCKEY MATCH SHEET - Match ${matchNum || ""}`.trim();
    }

    await sendImageToPrinter({ pngDataUrl: png, title, copies: 1 });
    alert("🖨️ Printed (image)!");
  }catch(err){
    console.error(err);

    if(ENABLE_TEXT_FALLBACK){
      try{
        const text = ($("output")?.innerText || "").trim();
        await sendTextToPrinter(text + "\n\n\n");
        alert("🖨️ Printed (text fallback)!");
        return;
      }catch(e2){
        console.error(e2);
      }
    }

    alert("⚠️ Could not print.\n" + (err?.message || String(err)));
  }
});

// Print to Browser
$("printBrowserBtn")?.addEventListener("click", () => window.print());

// Blank card
$("printBlankBtn")?.addEventListener("click", () => {
  CURRENT_MODE = "blank";
  setOutput(buildBlankPreviewHTML());
});

// Rank match
$("printRankMatchBtn")?.addEventListener("click", () => {
  CURRENT_MODE = "rank";
  setOutput(buildRankPreviewHTML());
});

// Download
$("downloadBtn")?.addEventListener("click", () => {
  const outputText = $("output")?.innerText || "";
  const blob = new Blob([outputText], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const matchNum = $("matchNum")?.value || "";
  const filename = `Match_${matchNum || "Blank"}_${Date.now()}.txt`;

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);

  alert(
`✅ Match card downloaded as "${filename}"!

🖨️ Terminal printing examples:
macOS:
lp path/to/${filename}

Windows CMD:
notepad /p path\\to\\${filename}`
  );
});

// URL params bootstrap
window.addEventListener("load", () => {
  const matchNum = getParam("match");
  const tableNum = getParam("table");
  const refName  = getParam("ref");
  const playerA  = getParam("playerA");
  const playerB  = getParam("playerB");

  if(matchNum || playerA || playerB){
    if($("matchNum")) $("matchNum").value = matchNum;
    if($("tableNum")) $("tableNum").value = tableNum;
    if($("refName"))  $("refName").value  = refName;
    if($("playerA"))  $("playerA").value  = playerA;
    if($("playerB"))  $("playerB").value  = playerB;

    // Auto-generate preview if all are present
    if(matchNum && tableNum && refName && playerA && playerB){
      $("matchForm")?.dispatchEvent(new Event("submit"));
    }
  }
});
