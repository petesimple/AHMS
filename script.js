// ===========================================================
// AHMS Client Script (Plan A: JSON to Node print server - RAW)
// Paste this whole block into your script.js
// ===========================================================

// 🔧 CHANGE THIS: set to your Mac's LAN IP (where server.js runs), keep /print-raw
// Find your Mac IP: `ipconfig getifaddr en0` (Wi-Fi) or `ipconfig getifaddr en1` (Ethernet)
const PRINT_SERVER_URL = "http://192.168.1.2:3000/print-raw"; // ⬅️ changed to /print-raw

// ✅ Build payload for the RAW endpoint (expects only { title, lines })
function buildPrintPayloadRaw() {
  const matchNum = document.getElementById("matchNum").value;
  const tableNum = document.getElementById("tableNum").value;
  const refName  = document.getElementById("refName").value;
  const playerA  = document.getElementById("playerA").value;
  const playerB  = document.getElementById("playerB").value;

  // Take whatever is in #output, normalize whitespace, split by lines
  const text = document.getElementById("output").innerText
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const lines = text.split("\n");

  return {
    title: `AIRHOCKEY MATCH SHEET - Match ${matchNum || ""}`.trim(),
    lines // ⬅️ RAW route only needs title + lines
  };
}

// ✅ Send JSON to the RAW endpoint
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
// (unchanged)
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
    <h2>AIRHOCKEY MATCH SHEET - Match ${matchNum}</h2>
    <p><strong>Table #:</strong> ${tableNum} &nbsp; | &nbsp; <strong>Ref:</strong> ${refName}</p>
    <table>
      <tr><th>Player</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th></tr>
      <tr><td>${playerA}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
      <tr><td>${playerB}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
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

// ⬅️ Updated: now calls the RAW sender
document.getElementById("printBtn").addEventListener("click", () => {
  const payload = buildPrintPayloadRaw();
  sendToPrinterRAW(payload);
});

// Browser print (unchanged)
document.getElementById("printBrowserBtn").addEventListener("click", () => {
  window.print();
});

// Blank sheet (unchanged)
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

// Rank match (unchanged)
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
