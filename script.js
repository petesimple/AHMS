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
});

document.getElementById("printBtn").addEventListener("click", () => {
  const outputText = document.getElementById("output").innerText;
  const cleanText = outputText
    .replace(/\s+\n/g, '\n')   // Trim spaces before line breaks
    .replace(/\n{3,}/g, '\n\n'); // Avoid extra empty lines

  sendToEpson(cleanText);
});

  

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

    // Auto-generate if all required
    if (matchNum && tableNum && refName && playerA && playerB) {
      document.getElementById("matchForm").dispatchEvent(new Event("submit"));
    }
  }
});

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
});

function sendToEpson(text) {
  const printerIP = "192.168.1.19"; // <-- Replace with your printer's IP
  const ePosDev = new epson.ePOSDevice();

  ePosDev.connect(printerIP, 8008, status => {
    if (status === 'OK' || status === 'SSL_CONNECT_OK') {
      ePosDev.createDevice(
        'local_printer',
        ePosDev.DEVICE_TYPE_PRINTER,
        { crypto: false, buffer: false },
        device => {
          if (!device) {
            alert('Printer device creation failed.');
            return;
          }

          device
            .addText(text + '\n')
            .addCut()
            .send(result => {
              if (result.success) {
                console.log("✅ Printed successfully!");
              } else {
                console.warn("⚠️ Print failed:", result.code);
              }
            });
        }
      );
    } else {
      alert('Connection to printer failed: ' + status);
    }
  });
}
