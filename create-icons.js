/**
 * Create multiple icon sizes from the main icon.png
 * Run: node create-icons.js
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const iconsDir = path.join(__dirname, 'extension', 'icons');
const sourceIcon = path.join(iconsDir, 'icon.png');

const sizes = [16, 48, 128];

async function createIcons() {
    console.log('Creating icons from:', sourceIcon);

    // Check if source exists
    if (!fs.existsSync(sourceIcon)) {
        console.error('Source icon not found:', sourceIcon);
        process.exit(1);
    }

    for (const size of sizes) {
        const outputPath = path.join(iconsDir, `icon${size}.png`);

        await sharp(sourceIcon)
            .resize(size, size, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .png()
            .toFile(outputPath);

        console.log(`✅ Created: icon${size}.png (${size}x${size})`);
    }

    console.log('\n🎉 All icons created successfully!');
    console.log('Update manifest.json to use these icons.');
}

createIcons().catch(err => {
    console.error('Error creating icons:', err);
    process.exit(1);
});
