
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const inputPath = path.resolve(__dirname, '../src/app/assets/logo.svg');
const outputPath = path.resolve(__dirname, '../src/app/assets/logo.png');

async function convert() {
  try {
    console.log(`Converting ${inputPath} to ${outputPath}...`);
    await sharp(inputPath)
      .png()
      .toFile(outputPath);
    console.log('Conversion successful!');
  } catch (err) {
    console.error('Error converting file:', err);
    process.exit(1);
  }
}

convert();
