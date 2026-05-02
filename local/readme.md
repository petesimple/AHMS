cat > README.md <<'EOF'
# AHMS ESC/POS Bridge

Local Raspberry Pi app and print bridge for Air Hockey Match Sheets.

This package serves the AHMS local web app and prints match cards to an Epson TM-T88 network printer using ESC/POS.

## What it does

1. Runs a local web app at:

http://PI_IP:3000

2. Receives print jobs at:

POST http://PI_IP:3000/print-match

3. Prints landscape match cards through an Epson TM-T88 printer.

4. Adds a QR code to the match card so a player or ref can scan the card and open the Air Hockey Score System scoring app on their phone.

## Required hardware

Raspberry Pi  
Epson TM-T88 network printer  
Both devices on the same network

## Required software

Node.js and npm

## Install

Unzip this folder onto the Pi.

Then from inside the folder:

npm install

## Configure printer IP

Open server.js and update this line if needed:

const PRINTER_IP = "192.168.1.229";

Use the actual IP address of the Epson printer.

## Start the app

From inside this folder:

node server.js

Then open:

http://PI_IP:3000

Example:

http://192.168.1.181:3000

## Stop the app

Press:

CTRL+C

## Optional PM2 setup

Install PM2:

npm install -g pm2

Start the bridge:

pm2 start server.js --name ahms

Restart after changes:

pm2 restart ahms

Show logs:

pm2 logs ahms

Make it start on boot:

pm2 startup
pm2 save

## Folder notes

server.js is the local Node/Express bridge and print server.

public/index.html is the local AHMS page.

public/script.js controls the AHMS browser app.

public/style.css controls the page styling if present.

node_modules is not included in the zip. Run npm install after unzipping.

## Current network notes

Pi IP used during testing:

192.168.1.181

Printer IP used during testing:

192.168.1.229

## Air Hockey Score System QR

The printed match card QR code points to:

https://petesimple.github.io/airhockey-score-system/

with the player names, table, ref, match length, and match ID passed in the URL.
EOF
