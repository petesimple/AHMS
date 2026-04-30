/* ===========================================================
   AHMS script.js
   ESC/POS version with safer startup and diagnostics

   Browser app sends structured JSON to Raspberry Pi bridge:

     POST http://<PI_IP>:3000/print-match

   Raspberry Pi bridge uses Node ESC/POS to print to Epson T88.
=========================================================== */

// If AHMS is served from the Pi, this auto points to the same Pi on port 3000.
// Example: AHMS opened at http://192.168.1.181:8080
// Bridge becomes http://192.168.1.181:3000
const PRINT_SERVER_URL =
  window.location.hostname && window.location.hostname !== "localhost"
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : "http://192.168.1.181:3000";

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

function setOutput(html){
  const output = $("output");

  if(!output){
    alert("Missing #output element in HTML.");
    return;
  }

  output.innerHTML = html;
  output.classList.remove("hidden");
  showAllButtons();
}

function buildMatchPreviewHTML({ matchNum, tableNum, refName, playerA, playerB }){
  return `
    <h2>AIRHOCKEY MATCH SHEET - Match ${escapeHtml(matchNum || "_____")}</h2>
    <p>
      <strong>Table #:</strong> ${escapeHtml(tableNum || "_______")}
      &nbsp; | &nbsp;
      <strong>Ref:</strong> ${escapeHtml(refName || "____________")}
    </p>

    ${playerA || playerB ? `
      <p>
        <strong>Player A:</strong> ${escapeHtml(playerA || "____________________")}
        <br>
        <strong>Player B:</strong> ${escapeHtml(playerB || "____________________")}
      </p>
    ` : ""}

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

function getCurrentPrintPayload(){
  const matchNum = $("matchNum")?.value || "";
  const tableNum = $("tableNum")?.value || "";
  const refName  = $("refName")?.value  || "";
  const playerA  = $("playerA")?.value  || "";
  const playerB  = $("playerB")?.value  || "";

  if(CURRENT_MODE === "rank"){
    return {
      mode: "rank",
      matchNum,
      tableNum,
      refName,
      playerA,
      playerB
    };
  }

  if(CURRENT_MODE === "blank"){
    return {
      mode: "blank",
      matchNum: "",
      tableNum: "",
      refName: "",
      playerA: "",
      playerB: ""
    };
  }

  return {
    mode: "match",
    matchNum,
    tableNum,
    refName,
    playerA,
    playerB
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

    setOutput(buildMatchPreviewHTML({
      matchNum,
      tableNum,
      refName,
      playerA,
      playerB
    }));
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
    setOutput(buildBlankPreviewHTML());
  });

  printRankMatchBtn?.addEventListener("click", () => {
    CURRENT_MODE = "rank";
    setOutput(buildRankPreviewHTML());
  });

  downloadBtn?.addEventListener("click", () => {
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
