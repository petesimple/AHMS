/* ===========================================================
   AHMS script.js
   ESC/POS version with safer startup, diagnostics,
   scoreboard QR code support, and browser previews that
   better match printed output.

   Browser app sends structured JSON to Raspberry Pi bridge:

     POST http://<PI_IP>:3000/print-match

   Raspberry Pi bridge uses Node ESC/POS to print to Epson T88.
=========================================================== */

// If AHMS is served from the Pi, this auto points to the same Pi on port 3000.
// Example: AHMS opened at http://192.168.1.181:8080
// Bridge becomes http://192.168.1.181:3000
const PRINT_SERVER_URL = "http://192.168.1.181:3000";

const SCOREBOARD_BASE_URL = "https://petesimple.github.io/airhockey-score-system/";
const QR_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js";

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
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      mode: "cors"
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}

function loadScriptOnce(src){
  return new Promise((resolve, reject) => {
    if(window.QRCode){
      resolve();
      return;
    }

    const existing = document.querySelector(`script[src="${src}"]`);

    if(existing){
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error(`Could not load ${src}`)));
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });
}

function buildScoreboardUrl({ matchNum, tableNum, refName, playerA, playerB, matchId }){
  const params = new URLSearchParams();

  params.set("p1", playerA || "");
  params.set("p2", playerB || "");
  params.set("match", matchNum || "2");

  if(matchId) params.set("matchid", matchId);
  if(tableNum) params.set("table", tableNum);
  if(refName) params.set("ref", refName);

  return `${SCOREBOARD_BASE_URL}?${params.toString()}`;
}

function getMatchId(){
  const fromUrl = getParam("matchid");

  if(fromUrl){
    return fromUrl;
  }

  const matchNum = $("matchNum")?.value || "";
  const tableNum = $("tableNum")?.value || "";
  const playerA = $("playerA")?.value || "";
  const playerB = $("playerB")?.value || "";

  const seed = `${matchNum}-${tableNum}-${playerA}-${playerB}`.trim();

  if(!seed){
    return "";
  }

  const randomId = Math.random().toString(36).substring(2, 6).toUpperCase();
  const yyyymmdd = new Date().toISOString().slice(0, 10);

  return `ahms${randomId}-${yyyymmdd}`;
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

function safePreviewText(value, fallback = "") {
  return String(value || fallback).replace(/[^\x20-\x7E\n\r\t]/g, "");
}

function shortRankName(name) {
  const clean = safePreviewText(name || "").trim().replace(/\s+/g, " ");
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
  const clean = safePreviewText(value || "");
  if (clean.length >= width) return clean.slice(0, width);
  return clean + " ".repeat(width - clean.length);
}

function buildRankSetBlockHTML(setNum, playerA, playerB) {
  const a = escapeHtml(padRight(shortRankName(playerA), 7));
  const b = escapeHtml(padRight(shortRankName(playerB), 7));

  return `
    <div class="rank-set-block">
      <div class="rank-set-title">SET ${setNum}</div>
      <pre>Player   1  2  3  4  5  6  7
${a} [_][_][_][_][_][_][_]
${b} [_][_][_][_][_][_][_]</pre>
    </div>
  `;
}

async function renderScoreboardQr(scoreboardUrl){
  const canvas = $("scoreboardQr");

  if(!canvas || !scoreboardUrl){
    return;
  }

  try{
    await loadScriptOnce(QR_SCRIPT_URL);

    if(!window.QRCode){
      throw new Error("QRCode library unavailable.");
    }

    QRCode.toCanvas(canvas, scoreboardUrl, {
      width: 145,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#ffffff"
      }
    }, function(error){
      if(error){
        console.error("QR render failed:", error);
      }
    });
  }catch(err){
    console.warn("Could not render QR code:", err);

    const holder = $("scoreboardQrHolder");

    if(holder){
      holder.innerHTML = `
        <div style="font-weight:bold;">SCAN TO SCORE</div>
        <p style="font-size:12px; word-break:break-all;">${escapeHtml(scoreboardUrl)}</p>
      `;
    }
  }
}

// ============ ESC/POS bridge send ============
async function sendMatchToEscposBridge(payload){
  console.log("Sending to print bridge:", `${PRINT_SERVER_URL}/print-match`);
  console.log("Payload:", payload);

  const res = await fetchWithTimeout(`${PRINT_SERVER_URL}/print-match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }, 12000);

  const text = await res.text();
  let data = null;

  try {
    data = JSON.parse(text);
  } catch {}

  console.log("Print bridge response:", res.status, text);

  if(!res.ok){
    throw new Error((data && data.error) ? data.error : (text || `Printer error (${res.status})`));
  }

  if(data && data.ok === false){
    throw new Error(data.error || "Printer server returned ok:false");
  }

  return true;
}

// ============ Diagnostic bridge test ============
async function testBridge(){
  const res = await fetchWithTimeout(`${PRINT_SERVER_URL}/`, {
    method: "GET"
  }, 5000);

  const text = await res.text();

  if(!res.ok){
    throw new Error(`Bridge test failed: ${res.status} ${text}`);
  }

  return text;
}

// ============ Preview HTML builders ============
function showAllButtons(){
  $("printBtn")?.classList.remove("hidden");
  $("printBrowserBtn")?.classList.remove("hidden");
  $("downloadBtn")?.classList.remove("hidden");
}

function setOutput(html, scoreboardUrl = ""){
  const output = $("output");

  if(!output){
    alert("Missing #output element in HTML.");
    return;
  }

  output.innerHTML = html;
  output.classList.remove("hidden");
  showAllButtons();

  if(scoreboardUrl){
    renderScoreboardQr(scoreboardUrl);
  }
}

function buildScoreboardQrHTML(scoreboardUrl){
  if(!scoreboardUrl){
    return "";
  }

  return `
    <div id="scoreboardQrHolder" class="preview-qr-box">
      <div class="preview-qr-title">SCAN TO SCORE</div>
      <canvas id="scoreboardQr" width="145" height="145"></canvas>
    </div>
  `;
}

function buildPreviewStyle(){
  return `
    <style>
      .ahms-print-preview {
        box-sizing: border-box;
        width: 760px;
        max-width: 100%;
        min-height: 576px;
        margin: 18px auto;
        padding: 28px 32px;
        background: #fff;
        color: #000;
        font-family: Arial, Helvetica, sans-serif;
        text-align: left;
        border: 2px solid #000;
      }

      .ahms-print-preview h2 {
        margin: 0 0 28px 0;
        font-size: 30px;
        line-height: 1.1;
      }

      .preview-top-line {
        font-size: 22px;
        margin-bottom: 22px;
      }

      .preview-player-lines {
        font-size: 22px;
        line-height: 1.45;
        margin-bottom: 18px;
      }

      .preview-match-id {
        font-size: 14px;
        margin-bottom: 18px;
      }

      .preview-main-row {
        display: flex;
        align-items: flex-start;
        gap: 16px;
      }

      .preview-score-table {
        width: 500px;
        border-collapse: collapse;
        table-layout: fixed;
        font-size: 20px;
      }

      .preview-score-table th,
      .preview-score-table td {
        border: 2px solid #000;
        height: 58px;
        text-align: center;
        vertical-align: middle;
      }

      .preview-score-table th:first-child,
      .preview-score-table td:first-child {
        width: 250px;
        text-align: left;
        padding-left: 16px;
        font-weight: bold;
      }

      .preview-score-table th:not(:first-child),
      .preview-score-table td:not(:first-child) {
        width: 34px;
      }

      .preview-qr-box {
        width: 170px;
        height: 170px;
        box-sizing: border-box;
        border: 2px solid #000;
        background: #fff;
        text-align: center;
        padding-top: 12px;
      }

      .preview-qr-title {
        font-size: 13px;
        font-weight: bold;
        margin-bottom: 4px;
      }

      .preview-qr-box canvas {
        width: 145px;
        height: 145px;
      }

      .preview-notes {
        margin-top: 38px;
        font-size: 22px;
      }

      .preview-note-line {
        border-bottom: 2px solid #000;
        height: 34px;
      }

      .rank-preview {
        box-sizing: border-box;
        width: 420px;
        max-width: 100%;
        margin: 18px auto;
        padding: 18px;
        background: #fff;
        color: #000;
        font-family: "Courier New", monospace;
        text-align: left;
        border: 2px solid #000;
      }

      .rank-preview h2 {
        text-align: center;
        margin: 0 0 10px 0;
        font-family: Arial, Helvetica, sans-serif;
      }

      .rank-preview p {
        margin: 4px 0;
      }

      .rank-line {
        border-top: 2px solid #000;
        margin: 10px 0;
      }

      .rank-fill-line {
        border-bottom: 1px solid #000;
        height: 18px;
        margin: 5px 0;
      }

      .rank-player-label {
        font-weight: bold;
        margin-top: 8px;
      }

      .rank-set-block {
        margin: 12px 0;
      }

      .rank-set-title {
        font-weight: bold;
        margin-bottom: 2px;
      }

      .rank-set-block pre {
        margin: 0;
        font-size: 13px;
        line-height: 1.35;
        white-space: pre;
      }
    </style>
  `;
}

function buildMatchPreviewHTML({ matchNum, tableNum, refName, playerA, playerB, matchId }){
  const scoreboardUrl = buildScoreboardUrl({
    matchNum,
    tableNum,
    refName,
    playerA,
    playerB,
    matchId
  });

  return `
    ${buildPreviewStyle()}
    <div class="ahms-print-preview">
      <h2>AIRHOCKEY MATCH SHEET - Match ${escapeHtml(matchNum || "_____")}</h2>

      <div class="preview-top-line">
        <strong>Table #:</strong> ${escapeHtml(tableNum || "______")}
        &nbsp;&nbsp;&nbsp;
        <strong>Ref:</strong> ${escapeHtml(refName || "____________")}
      </div>

      <div class="preview-player-lines">
        <strong>Player A:</strong> ${escapeHtml(playerA || "____________________")}
        <br>
        <strong>Player B:</strong> ${escapeHtml(playerB || "____________________")}
      </div>

      ${matchId ? `
        <div class="preview-match-id">
          <strong>Match ID:</strong> ${escapeHtml(matchId)}
        </div>
      ` : ""}

      <div class="preview-main-row">
        <table class="preview-score-table">
          <tr>
            <th>Player</th>
            <th>1</th>
            <th>2</th>
            <th>3</th>
            <th>4</th>
            <th>5</th>
            <th>6</th>
            <th>7</th>
          </tr>
          <tr>
            <td>${escapeHtml(playerA || "")}</td>
            <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
          </tr>
          <tr>
            <td>${escapeHtml(playerB || "")}</td>
            <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
          </tr>
        </table>

        ${buildScoreboardQrHTML(scoreboardUrl)}
      </div>

      <div class="preview-notes">
        <strong>Notes:</strong>
        <div class="preview-note-line"></div>
        <div class="preview-note-line"></div>
        <div class="preview-note-line"></div>
      </div>
    </div>
  `;
}

function buildBlankPreviewHTML(){
  return `
    ${buildPreviewStyle()}
    <div class="ahms-print-preview">
      <h2>AIRHOCKEY MATCH SHEET - Match _____</h2>

      <div class="preview-top-line">
        <strong>Table #:</strong> ______
        &nbsp;&nbsp;&nbsp;
        <strong>Ref:</strong> ____________
      </div>

      <div class="preview-player-lines">
        <strong>Player A:</strong> ____________________
        <br>
        <strong>Player B:</strong> ____________________
      </div>

      <div class="preview-main-row">
        <table class="preview-score-table">
          <tr>
            <th>Player</th>
            <th>1</th>
            <th>2</th>
            <th>3</th>
            <th>4</th>
            <th>5</th>
            <th>6</th>
            <th>7</th>
          </tr>
          <tr>
            <td></td>
            <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
          </tr>
          <tr>
            <td></td>
            <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
          </tr>
        </table>
      </div>

      <div class="preview-notes">
        <strong>Notes:</strong>
        <div class="preview-note-line"></div>
        <div class="preview-note-line"></div>
        <div class="preview-note-line"></div>
      </div>
    </div>
  `;
}

function buildRankPreviewHTML({ matchNum = "", tableNum = "", refName = "", playerA = "", playerB = "" } = {}){
  const printedAt = formatPrintedAt();
  const sets = Array.from({ length: 7 }, (_, i) => buildRankSetBlockHTML(i + 1, playerA, playerB)).join("");

  return `
    ${buildPreviewStyle()}
    <div class="rank-preview">
      <h2>RANK MATCH</h2>

      <div class="rank-line"></div>

      <p><strong>Date/Time:</strong> ${escapeHtml(printedAt)}</p>
      <p><strong>Location:</strong> ____________________________</p>
      <p><strong>Match:</strong> ${escapeHtml(matchNum || "__________")}</p>
      <p><strong>Table:</strong> ${escapeHtml(tableNum || "__________")}</p>
      <p><strong>Ref:</strong> ${escapeHtml(refName || "______________")}</p>

      <p><strong>Wit(s) | Alt Ref(s)</strong></p>
      <div class="rank-fill-line"></div>
      <div class="rank-fill-line"></div>

      <div class="rank-line"></div>

      <p class="rank-player-label">Player A:</p>
      <p>${escapeHtml(playerA || "____________________")}</p>
      <p>Nat#: ____ &nbsp; Reg#: ____ &nbsp; Loc#: ____</p>

      <p class="rank-player-label">Player B:</p>
      <p>${escapeHtml(playerB || "____________________")}</p>
      <p>Nat#: ____ &nbsp; Reg#: ____ &nbsp; Loc#: ____</p>

      <div class="rank-line"></div>

      <p><strong>Sets & Games</strong></p>
      <p>___ OUT OF ____ GAMES/SET</p>
      <p>____ OUT OF ____ SETS/MATCH</p>

      <div class="rank-line"></div>

      ${sets}

      <div class="rank-line"></div>

      <p><strong>Rank Changes:</strong></p>
      <div class="rank-fill-line"></div>

      <p><strong>Notes:</strong></p>
      <div class="rank-fill-line"></div>
      <div class="rank-fill-line"></div>
      <div class="rank-fill-line"></div>
    </div>
  `;
}

let CURRENT_MODE = "match";
let CURRENT_MATCH_ID = "";

function getCurrentPrintPayload(){
  const matchNum = $("matchNum")?.value || "";
  const tableNum = $("tableNum")?.value || "";
  const refName  = $("refName")?.value  || "";
  const playerA  = $("playerA")?.value  || "";
  const playerB  = $("playerB")?.value  || "";

  if(!CURRENT_MATCH_ID){
    CURRENT_MATCH_ID = getMatchId();
  }

  const scoreboardUrl = buildScoreboardUrl({
    matchNum,
    tableNum,
    refName,
    playerA,
    playerB,
    matchId: CURRENT_MATCH_ID
  });

  if(CURRENT_MODE === "rank"){
    return {
      mode: "rank",
      matchNum,
      tableNum,
      refName,
      playerA,
      playerB,
      matchId: CURRENT_MATCH_ID,
      scoreboardUrl
    };
  }

  if(CURRENT_MODE === "blank"){
    return {
      mode: "blank",
      matchNum: "",
      tableNum: "",
      refName: "",
      playerA: "",
      playerB: "",
      matchId: "",
      scoreboardUrl: ""
    };
  }

  return {
    mode: "match",
    matchNum,
    tableNum,
    refName,
    playerA,
    playerB,
    matchId: CURRENT_MATCH_ID,
    scoreboardUrl
  };
}

function initAHMS(){
  console.log("AHMS script loaded.");
  console.log("Print bridge URL:", PRINT_SERVER_URL);

  const matchForm = $("matchForm");
  const printBtn = $("printBtn");
  const printBrowserBtn = $("printBrowserBtn");
  const printBlankBtn = $("printBlankBtn");
  const printRankMatchBtn = $("printRankMatchBtn");
  const downloadBtn = $("downloadBtn");

  if(!matchForm) console.warn("Missing #matchForm");
  if(!printBtn) console.warn("Missing #printBtn");
  if(!printBrowserBtn) console.warn("Missing #printBrowserBtn");
  if(!printBlankBtn) console.warn("Missing #printBlankBtn");
  if(!printRankMatchBtn) console.warn("Missing #printRankMatchBtn");
  if(!downloadBtn) console.warn("Missing #downloadBtn");

  matchForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    CURRENT_MODE = "match";

    const matchNum = $("matchNum")?.value || "";
    const tableNum = $("tableNum")?.value || "";
    const refName  = $("refName")?.value  || "";
    const playerA  = $("playerA")?.value  || "";
    const playerB  = $("playerB")?.value  || "";

    CURRENT_MATCH_ID = getParam("matchid") || CURRENT_MATCH_ID || getMatchId();

    const scoreboardUrl = buildScoreboardUrl({
      matchNum,
      tableNum,
      refName,
      playerA,
      playerB,
      matchId: CURRENT_MATCH_ID
    });

    setOutput(buildMatchPreviewHTML({
      matchNum,
      tableNum,
      refName,
      playerA,
      playerB,
      matchId: CURRENT_MATCH_ID
    }), scoreboardUrl);
  });

  printBtn?.addEventListener("click", async () => {
    try{
      const payload = getCurrentPrintPayload();

      await sendMatchToEscposBridge(payload);

      alert("🖨️ Printed via ESC/POS!");
    }catch(err){
      console.error("AHMS print failed:", err);

      alert(
        "⚠️ Could not print via ESC/POS bridge.\n\n" +
        "Bridge URL:\n" +
        PRINT_SERVER_URL + "\n\n" +
        "Error:\n" +
        (err?.message || String(err))
      );
    }
  });

  printBrowserBtn?.addEventListener("click", () => window.print());

  printBlankBtn?.addEventListener("click", () => {
    CURRENT_MODE = "blank";
    CURRENT_MATCH_ID = "";
    setOutput(buildBlankPreviewHTML());
  });

  printRankMatchBtn?.addEventListener("click", () => {
    CURRENT_MODE = "rank";

    const matchNum = $("matchNum")?.value || "";
    const tableNum = $("tableNum")?.value || "";
    const refName  = $("refName")?.value  || "";
    const playerA  = $("playerA")?.value  || "";
    const playerB  = $("playerB")?.value  || "";

    setOutput(buildRankPreviewHTML({
      matchNum,
      tableNum,
      refName,
      playerA,
      playerB
    }));
  });

  downloadBtn?.addEventListener("click", () => {
    const outputText = $("output")?.innerText || "";
    const payload = getCurrentPrintPayload();

    const textWithScoreboard = payload.scoreboardUrl
      ? `${outputText}\n\nScan to Score Match:\n${payload.scoreboardUrl}\n`
      : outputText;

    const blob = new Blob([textWithScoreboard], { type: "text/plain" });
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

  window.addEventListener("load", () => {
    const matchNum = getParam("match");
    const tableNum = getParam("table");
    const refName  = getParam("ref");
    const playerA  = getParam("playerA");
    const playerB  = getParam("playerB");
    const matchId  = getParam("matchid");

    if(matchId){
      CURRENT_MATCH_ID = matchId;
    }

    if(matchNum || playerA || playerB){
      if($("matchNum")) $("matchNum").value = matchNum;
      if($("tableNum")) $("tableNum").value = tableNum;
      if($("refName"))  $("refName").value  = refName;
      if($("playerA"))  $("playerA").value  = playerA;
      if($("playerB"))  $("playerB").value  = playerB;

      if(matchNum && tableNum && refName && playerA && playerB){
        matchForm?.dispatchEvent(new Event("submit"));
      }
    }
  });

  testBridge()
    .then((msg) => console.log("Bridge test OK:", msg))
    .catch((err) => console.warn("Bridge test failed:", err));
}

document.addEventListener("DOMContentLoaded", initAHMS);