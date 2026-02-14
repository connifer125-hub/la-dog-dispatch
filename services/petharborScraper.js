const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const db = require('../config/database');

const PETHARBOR_URL = 'https://petharbor.com/results.asp?WHERE=type_DOG&PAGE=1&searchtype=ALL&friends=1&samaritans=1&nosuccess=0&rows=100&imght=120&imgres=thumb&view=sysadm.v_lact_alert_euth&bgcolor=white&text=blue&alink=000000&vlink=FF6600&fontface=arial&fontsize=10&start=3&col_hdr_bg=e6e6e6&col_bg2=e6e6e6&col_bg=white&SBG=e6e6e6&SHELTERLIST=%27LACT%27,%27LACT1%27,%27LACT4%27,%27LACT3%27,%27LACT2%27,%27LACT5%27,%27LACT6%27&OrderBy=shelter';

async function scrapePetHarbor() {
  try {
    console.log('🔍 Scraping PetHarbor for urgent dogs...');
    
    const response = await axios.get(PETHARBOR_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const dogs = [];

    // Parse the results table
    $('table[bgcolor="white"] tr').each((i, row) => {
      try {
        const cells = $(row).find('td');
        
        if (cells.length < 4) return;

        // Extract dog information
        const photoCell = $(cells[0]);
        const infoCell = $(cells[1]);
        
        const photoUrl = photoCell.find('img').attr('src');
        if (!photoUrl) return;

        const detailsLink = infoCell.find('a').attr('href');
        const animalId = detailsLink?.match(/ID=([A-Z0-9]+)/)?.[1];
        if (!animalId) return;

        const infoText = infoCell.text();
        
        // Extract name
        const nameMatch = infoText.match(/Name:\s*([^\n]+)/);
        const name = nameMatch ? nameMatch[1].trim() : 'Unknown';

        // Extract breed
        const breedMatch = infoText.match(/Breed:\s*([^\n]+)/);
        const breed = breedMatch ? breedMatch[1].trim() : 'Unknown';

        // Extract age
        const ageMatch = infoText.match(/Age:\s*([^\n]+)/);
        const age = ageMatch ? ageMatch[1].trim() : 'Unknown';

        // Extract gender
        const genderMatch = infoText.match(/Sex:\s*([^\n]+)/);
        const gender = genderMatch ? genderMatch[1].trim() : 'Unknown';

        // Extract shelter
        const shelterMatch = infoText.match(/Location:\s*([^\n]+)/);
        const shelter = shelterMatch ? shelterMatch[1].trim() : 'LA County Shelter';

        // Extract deadline (usually in the "Alert" or "Euth Date" field)
        const deadlineMatch = infoText.match(/(?:Alert|Euth Date):\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
        let deadline = null;
        if (deadlineMatch) {
          const [month, day, year] = deadlineMatch[1].split('/');
          deadline = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        } else {
          // Default to 3 days from now if no deadline specified
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + 3);
          deadline = futureDate.toISOString().split('T')[0];
        }

        dogs.push({
          name,
          breed,
          age,
          gender,
          shelter,
          shelter_id: animalId,
          deadline,
          photo_url: photoUrl.startsWith('http') ? photoUrl : `https://petharbor.com${photoUrl}`,
          petharbor_url: `https://petharbor.com/${detailsLink}`,
          description: `Urgent: ${name} needs rescue immediately. Currently at ${shelter}.`,
          source: 'petharbor',
          category: 'general',
          goal_amount: 500.00
        });
      } catch (err) {
        console.error('Error parsing row:', err);
      }
    });

    console.log(`✅ Found ${dogs.length} urgent dogs on PetHarbor`);

    // Add new dogs to database
    for (const dog of dogs) {
      try {
        // Check if dog already exists
        const existing = await db.query(
          'SELECT id FROM dogs WHERE shelter_id = $1',
          [dog.shelter_id]
        );

        if (existing.rows.length === 0) {
          await db.query(
            `INSERT INTO dogs (
              name, breed, age, gender, shelter, shelter_id, deadline,
              photo_url, petharbor_url, description, source, category, goal_amount
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
              dog.name, dog.breed, dog.age, dog.gender, dog.shelter,
              dog.shelter_id, dog.deadline, dog.photo_url, dog.petharbor_url,
              dog.description, dog.source, dog.category, dog.goal_amount
            ]
          );
          console.log(`➕ Added new dog: ${dog.name} (${dog.shelter_id})`);
          
          // TODO: Send notifications to subscribers
        }
      } catch (err) {
        console.error(`Error adding dog ${dog.name}:`, err);
      }
    }

    return dogs;
  } catch (error) {
    console.error('❌ PetHarbor scraping error:', error.message);
    return [];
  }
}

function startScraper() {
  const intervalMinutes = process.env.PETHARBOR_SCRAPE_INTERVAL || 60;
  
  // Run immediately on startup
  scrapePetHarbor();
  
  // Then run every hour (or configured interval)
  cron.schedule(`*/${intervalMinutes} * * * *`, () => {
    scrapePetHarbor();
  });
  
  console.log(`⏰ PetHarbor scraper scheduled to run every ${intervalMinutes} minutes`);
}

module.exports = {
  scrapePetHarbor,
  startScraper
};
