const express = require('express');
const router = express.Router();
const db = require('../config/database');
const fs = require('fs').promises;
const path = require('path');

router.get('/diagnose-photos', async (req, res) => {
  try {
    const dogNames = ['WINTER', 'GAMER', 'WHISKEY', 'DEVO', 'TYSON', 'SUNDAY'];
    const results = [];

    for (const name of dogNames) {
      // Get dog from database
      const dbResult = await db.query(
        'SELECT id, name, shelter_id, photo_url FROM dogs WHERE UPPER(name) = $1',
        [name]
      );

      if (dbResult.rows.length === 0) {
        results.push({
          name,
          status: 'NOT_FOUND_IN_DB',
          message: 'Dog not in database'
        });
        continue;
      }

      const dog = dbResult.rows[0];
      
      // Check if image file exists
      const imagePath = path.join(__dirname, '../public/dog-images', `${dog.shelter_id}.jpg`);
      let fileExists = false;
      try {
        await fs.access(imagePath);
        fileExists = true;
      } catch (err) {
        fileExists = false;
      }

      results.push({
        name: dog.name,
        shelter_id: dog.shelter_id,
        database_photo_url: dog.photo_url,
        expected_file_path: `/dog-images/${dog.shelter_id}.jpg`,
        file_exists_on_server: fileExists,
        status: fileExists ? 'FILE_EXISTS' : 'FILE_MISSING',
        diagnosis: !fileExists 
          ? 'Image file missing - needs to be downloaded again'
          : dog.photo_url !== `/dog-images/${dog.shelter_id}.jpg`
            ? 'Database URL mismatch - needs update'
            : 'Should be working - check frontend'
      });
    }

    res.json({
      timestamp: new Date().toISOString(),
      dogs_checked: results
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
