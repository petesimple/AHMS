# 🏒 AHMS - Air Hockey Match Sheet

**AHMS** is a lightweight, installable web app for generating and printing air hockey match sheets. It supports match setup, previewing, and one-tap printing via a local thermal printer.

---

## ✅ Features

- Match form with auto-fill support via URL parameters
- Printable match sheets in multiple formats
- One-tap print to local server using fetch POST
- Works offline (PWA-enabled)
- Optimized for tablets and referees on the go

---

## 🖨️ How to Print

The app prints by sending raw text to a local print server running on your LAN. Here's how to set that up using Node.js on your Mac or Raspberry Pi.

---

### 🛠️ Setup a Print Server (Node.js)

1. **Install Node.js** on the print server device (Mac, PC, Pi).  
   You can check with `node -v` and `npm -v`.

2. **Create a folder**, e.g. `epson-server`, and inside it create `server.js` with this content:

   `const express = require('express'); const { exec } = require('child_process'); const app = express(); const port = 3000; app.use(express.text()); app.post('/print', (req, res) => { const text = req.body; console.log('🖨️ Printing:\n', text); exec(\`echo "${text}" | lp\`, (err, stdout, stderr) => { if (err) { console.error("Print error:", stderr); return res.status(500).send("❌ Print failed."); } res.send("✅ Print successful."); }); }); app.listen(port, () => { console.log(\`🖨️ Print server running at http://localhost:\${port}/print\`); });`

3. In Terminal, run:

   `npm install express && node server.js`

4. **Make sure your printer is shared and working via `lp`** (CUPS printing). Test it by running `lp file.txt`.

---

## 🌐 Connect from AHMS

In your AHMS JavaScript, include this function:

   `function sendToPrinter(text) { fetch("http://192.168.1.4:3000/print", { method: "POST", headers: { "Content-Type": "text/plain" }, body: text }) .then(res => res.text()) .then(msg => { console.log("✅", msg); alert("🖨️ Print sent!"); }) .catch(err => { console.error("❌ Print failed:", err); alert("⚠️ Could not connect to printer at 192.168.1.4."); }); }`

Update the IP address to match your print server.

When a user clicks the "Print" button in AHMS, it sends the form output as text to your server, which pipes it into `lp` to print.

---

## ⚙️ Bonus Features

- Supports Rank Match format and blank sheet printing
- Autofill form using URL params like `?match=3&playerA=Q&playerB=Goran`
- Clean, simple formatting optimized for thermal receipt printers

---

## 📱 PWA-Ready

- Add to Home Screen on mobile
- Works offline once cached
- No internet required at the venue

---

## 🔐 Security

- All printing is LAN-local via HTTP
- No data leaves your network
- You control all backend behavior

---

## 🧠 Author

Pete Lippincott  
[https://petesimple.github.io](https://petesimple.github.io)  
Tournament logistics innovator and napkin-replacement visionary.

---

## ✨ Future Ideas

- QR code support
- Digital signature capture
- Google Sheets integration
- Styled ESC/POS formatting

---

## 🧊 Motto

**_"Because writing scores on napkins is so 1997."_**
