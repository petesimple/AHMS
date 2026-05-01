/* ===========================================================
   AHMS script.js
   ESC/POS version with safer startup, diagnostics,
   and scoreboard QR code support

   Browser app sends structured JSON to Raspberry Pi bridge:

     POST http://<PI_IP>:3000/print-match

   Raspberry Pi bridge uses Node ESC/POS to print to Epson T88.

   New:
   AHMS now builds a QR code that points to the live
   airhockey-score-system scoreboard so a ref or player can
   scan the printed match card and score the match by phone.
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

async function renderScoreboardQr(scoreboardUrl){
  const canvas = $("scoreboardQr");
  const textEl = $("scoreboardQrText");

  if(textEl){
    textEl.textContent = scoreboardUrl || "";
  }

  if(!canvas || !scoreboardUrl){
    return;
  }

  try{
    await loadScriptOnce(QR_SCRIPT_URL);

    if(!window.QRCode){
      throw new Error("QRCode library unavailable.");
    }

    QRCode.toCanvas(canvas, scoreboardUrl, {
      width: 150,
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
        <p><strong>Scan to Score Match:</strong></p>
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
    <div id="scoreboardQrHolder" style="text-align:center; margin: 12px 0;">
      <p style="margin-bottom:6px;"><strong>Scan to Score Match</strong></p>
      <canvas id="scoreboardQr" width="150" height="150" style="background:#fff; padding:4px;"></canvas>
      <p id="scoreboardQrText" style="font-size:10px; line-height:1.2; word-break:break-all; margin-top:6px;">
        ${escapeHtml(scoreboardUrl)}
      </p>
    </div>
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
    <h2>AIRHOCKEY MATCH SHEET - Match ${escapeHtml(matchNum || "_____")}</h2>
    <p>
      <strong>Table #:</strong> ${escapeHtml(tableNum || "_______")}
      &nbsp; | &nbsp;
      <strong>Ref:</strong> ${escapeHtml(refName || "____________")}
    </p>

    ${matchId ? `
      <p>
        <strong>Match ID:</strong> ${escapeHtml(matchId)}
      </p>
    ` : ""}

    ${playerA || playerB ? `
      <p>
        <strong>Player A:</strong> ${escapeHtml(playerA || "____________________")}
        <br>
        <strong>Player B:</strong> ${escapeHtml(playerB || "____________________")}
      </p>
    ` : ""}

    ${buildScoreboardQrHTML(scoreboardUrl)}

    <table>
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
        <td>
          ${escapeHtml(playerA || "")}
          <span style="display:inline-block;width:85%;">&nbsp;</span>
          <hr/>
        </td>
        <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
      </tr>
      <tr>
        <td>
          ${escapeHtml(playerB || "")}
          <span style="display:inline-block;width:85%;">&nbsp;</span>
          <hr/>
        </td>
        <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
      </tr>
    </table>

    <p><strong>Notes:</strong></p>
    <p>______________________________</p>
    <p>______________________________</p>
    <p>______________________________</p>
  `;
}

function buildBlankPreviewHTML(){
  return `
    <h2>AIRHOCKEY MATCH SHEET - Match _____</h2>
    <p><strong>Table #:</strong> ______ &nbsp; | &nbsp; <strong>Ref:</strong> ____________</p>
    <table>
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
        <td><span style="display:inline-block;width:85%;">&nbsp;</span><hr/></td>
        <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
      </tr>
      <tr>
        <td><span style="display:inline-block;width:85%;">&nbsp;</span><hr/></td>
        <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
      </tr>
    </table>

    <p><strong>Notes:</strong></p>
    <p>______________________________</p>
    <p>______________________________</p>
    <p>______________________________</p>
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
      <p>______________________________</p>
      <p>______________________________</p>
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
    setOutput(buildRankPreviewHTML());
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
