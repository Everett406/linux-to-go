const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function resizeIcon() {
  const inputPath = path.join(__dirname, '../assets/icon.png');
  const sizes = [16, 32, 48, 64, 128, 256, 512];

  if (!fs.existsSync(inputPath)) {
    console.error('icon.png not found at', inputPath);
    process.exit(1);
  }

  // Read original image
  const image = sharp(inputPath);
  const metadata = await image.metadata();
  console.log('Original size:', metadata.width, 'x', metadata.height);

  // If original is already >= 256, just copy it to icon.png if needed
  if (metadata.width >= 256 && metadata.height >= 256) {
    console.log('Icon is already large enough');
    return;
  }

  // Upscale to 512 using nearest neighbor for pixel art or lanczos for photos
  const outputPath = path.join(__dirname, '../assets/icon.png');
  await sharp(inputPath)
    .resize(512, 512, { kernel: 'lanczos3' })
    .png()
    .toFile(outputPath + '.tmp');

  fs.renameSync(outputPath + '.tmp', outputPath);
  console.log('Resized icon to 512x512');

  // Also create multi-size ICO
  const icoBuffers = [];
  for (const size of sizes) {
    const buf = await sharp(inputPath)
      .resize(size, size, { kernel: 'lanczos3' })
      .png()
      .toBuffer();
    icoBuffers.push({ size, buf });
  }

  console.log('Created icon sizes:', sizes.join(', '));
}

resizeIcon().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
