const express = require('express');
const router = express.Router();
const db = require('../config/database');

// ONE-TIME route to fix all photo URLs
router.get('/fix-all-photos', async (req, res) => {
  try {
    console.log('🔧 Fixing all photo URLs...');
    
    // Update all dogs to use local photo paths
    const result = await db.query(`
      UPDATE dogs 
      SET photo_url = '/dog-images/' || shelter_id || '.jpg'
      WHERE photo_url NOT LIKE '/dog-images/%'
      RETURNING id, shelter_id, photo_url
    `);
    
    console.log(`✅ Updated ${result.rows.length} dog photos`);
    
    res.json({
      success: true,
      message: `Updated ${result.rows.length} dog photo URLs`,
      updated: result.rows
    });
    
  } catch (error) {
    console.error('❌ Error fixing photos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
