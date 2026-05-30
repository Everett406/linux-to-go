const pngToIco = require('png-to-ico').default;
const fs = require('fs');
const path = require('path');

async function createIco() {
  try {
    const iconPath = path.join(__dirname, '../assets/icon.png');
    const icoPath = path.join(__dirname, '../assets/icon.ico');

    if (!fs.existsSync(iconPath)) {
      console.error('icon.png not found');
      process.exit(1);
    }

    const buf = await pngToIco(iconPath);
    fs.writeFileSync(icoPath, buf);
    console.log('Created assets/icon.ico');
  } catch (err) {
    console.error('Failed to create icon:', err);
    process.exit(1);
  }
}

createIco();
