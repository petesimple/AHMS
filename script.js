document.getElementById("matchForm").addEventListener("submit", function(e) {
  e.preventDefault();

  const matchNum = document.getElementById("matchNum").value;
  const tableNum = document.getElementById("tableNum").value;
  const refName = document.getElementById("refName").value;
  const playerA = document.getElementById("playerA").value;
  const playerB = document.getElementById("playerB").value;

  const output = document.getElementById("output");
  output.innerHTML = `
    <h2>2025 AIRHOCKEY WORLD TOURNAMENT SINGLES BRACKET - Match ${matchNum}</h2>
    <p><strong>Table #:</strong> ${tableNum} &nbsp; | &nbsp; <strong>Ref:</strong> ${refName}</p>
    <table>
      <tr><th>Player</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th></tr>
      <tr><td>64 | ${playerA}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
      <tr><td>65 | ${playerB}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    </table>
  `;

  output.classList.remove("hidden");
  document.getElementById("printBtn").classList.remove("hidden");
});

document.getElementById("printBtn").addEventListener("click", () => {
  window.print();
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
