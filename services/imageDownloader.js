const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Directory to store downloaded images
const IMAGE_DIR = path.join(__dirname, '../public/dog-images');

// Ensure image directory exists
async function ensureImageDir() {
  try {
    await fs.access(IMAGE_DIR);
  } catch {
    await fs.mkdir(IMAGE_DIR, { recursive: true });
    console.log('📁 Created image directory:', IMAGE_DIR);
  }
}

/**
 * Download an image from PetHarbor and save it locally
 * @param {string} petharborUrl - The PetHarbor image URL
 * @param {string} animalId - The animal ID (e.g., A2213834)
 * @returns {string} - Local URL to serve the image
 */
async function downloadAndSaveImage(petharborUrl, animalId) {
  try {
    await ensureImageDir();
    
    // Create filename from animal ID
    const filename = `${animalId}.jpg`;
    const filepath = path.join(IMAGE_DIR, filename);
    
    // Check if image already exists
    try {
      await fs.access(filepath);
      console.log(`✅ Image already exists for ${animalId}`);
      return `/dog-images/${filename}`;
    } catch {
      // Image doesn't exist, download it
    }
    
    // Download image from PetHarbor
    console.log(`📥 Downloading image for ${animalId} from ${petharborUrl}`);
    
    const response = await axios.get(petharborUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    // Save to file
    await fs.writeFile(filepath, response.data);
    console.log(`✅ Saved image for ${animalId}`);
    
    // Return local URL
    return `/dog-images/${filename}`;
    
  } catch (error) {
    console.error(`❌ Failed to download image for ${animalId}:`, error.message);
    // Return fallback image
    return 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400';
  }
}

module.exports = {
  downloadAndSaveImage,
  ensureImageDir
};
