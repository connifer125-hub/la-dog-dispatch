const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const db = require('../config/database');

// Base URL for PetHarbor LA County euthanasia list  
const BASE_URL = 'https://petharbor.com/results.asp?WHERE=type_DOG&searchtype=ALL&friends=1&samaritans=1&nosuccess=0&rows=100&imght=120&imgres=thumb&view=sysadm.v_lact_alert_euth&bgcolor=white&text=blue&alink=000000&vlink=FF6600&fontface=arial&fontsize=10&start=3&col_hdr_bg=e6e6e6&col_bg2=e6e6e6&col_bg=white&SBG=e6e6e6&SHELTERLIST=%27LACT%27,%27LACT1%27,%27LACT4%27,%27LACT3%27,%27LACT2%27,%27LACT5%27,%27LACT6%27&OrderBy=shelter';

async function scrapePetHarbor() {
  try {
    console.log('🔍 Scraping PetHarbor for urgent dogs...');
    
    const dogs = [];
    
    // Scrape multiple pages (up to 5 pages or 500 dogs max)
    for (let page = 1; page <= 5; page++) {
      const pageUrl = `${BASE_URL}&PAGE=${page}`;
      
      try {
        const response = await axios.get(pageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 10000
        });

        const $ = cheerio.load(response.data);
        let foundOnPage = 0;
        
        // PetHarbor uses tables with bgcolor="white" for each dog
        $('table[bgcolor="white"]').each((i, table) => {
          try {
            const $table = $(table);
            const text = $table.text();
            
            // Skip if not an animal entry
            if (!text.includes('Age:') || !text.includes('Shelter:')) return;
            
            // Extract ID (A followed by 7 digits)
            const idMatch = text.match(/A\d{7}/);
            if (!idMatch) return;
            const animalId = idMatch[0];
            
            // Extract photo
            const img = $table.find('img[src*="petharbor"]').first();
            let photoUrl = img.attr('src');
            if (photoUrl && !photoUrl.startsWith('http')) {
              photoUrl = 'https://petharbor.com' + photoUrl;
            }
            
            // Extract name
            let name = 'Unknown';
            const nameMatch = text.match(/([A-Z][A-Z\s]+)\s*A\d{7}/);
            if (nameMatch) {
              name = nameMatch[1].trim();
              if (name.length > 20 || name.includes('NEUTERED') || name.includes('SPAYED')) {
                name = animalId;
              }
            } else {
              name = animalId;
            }
            
            // Extract breed  
            let breed = 'Mixed Breed';
            const breedMatch = text.match(/([A-Z\s,]+)\s*BREED/i);
            if (breedMatch) {
              breed = breedMatch[1].trim();
            }
            
            // Extract age
            let age = 'Unknown';
            const ageMatch = text.match(/Age:\s*([^\n\r]+)/);
            if (ageMatch) {
              age = ageMatch[1].trim();
            }
            
            // Extract gender
            let gender = 'Unknown';
            if (text.match(/NEUTERED\s*MALE/i) || text.match(/MALE/i)) {
              gender = 'Male';
            } else if (text.match(/SPAYED\s*FEMALE/i) || text.match(/FEMALE/i)) {
              gender = 'Female';
            }
            
            // Extract shelter
            let shelter = 'LA County Shelter';
            const shelterMatch = text.match(/Shelter:\s*([^\n\r\.]+)/);
            if (shelterMatch) {
              shelter = shelterMatch[1].trim();
            }
            
            // Extract euthanasia date
            let deadline = null;
            const euthMatch = text.match(/(?:Scheduled\s*)?Euthanasia\s*Date:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
            if (euthMatch) {
              const [, month, day, year] = euthMatch;
              deadline = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
            
            // Default deadline if not found
            if (!deadline) {
              const futureDate = new Date();
              futureDate.setDate(futureDate.getDate() + 3);
              deadline = futureDate.toISOString().split('T')[0];
            }
            
            // Calculate urgency for sorting
            const daysUntil = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
            
            dogs.push({
              name,
              breed,
              age,
              gender,
              shelter,
              shelter_id: animalId,
              deadline,
              daysUntil,
              photo_url: photoUrl || 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',
              petharbor_url: `https://petharbor.com/pet.asp?uaid=${animalId.replace('A', '')}`,
              description: `${name} is on the euthanasia list at ${shelter}. Urgent rescue needed by ${deadline}.`,
              source: 'petharbor',
              category: 'general',
              goal_amount: 500.00
            });
            
            foundOnPage++;
          } catch (err) {
            console.error('Error parsing entry:', err.message);
          }
        });

        console.log(`📄 Page ${page}: Found ${foundOnPage} dogs`);
        
        if (foundOnPage === 0) break;
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (pageError) {
        console.error(`Error on page ${page}:`, pageError.message);
        break;
      }
    }

    console.log(`✅ Total: ${dogs.length} urgent dogs`);

    // SORT BY URGENCY - most urgent first
    dogs.sort((a, b) => a.daysUntil - b.daysUntil);

    // Add to database
    let addedCount = 0;
    for (const dog of dogs) {
      try {
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
          addedCount++;
          console.log(`➕ ${dog.name} (${dog.shelter_id}) - ${dog.daysUntil} days`);
        } else {
          await db.query(
            'UPDATE dogs SET deadline = $1 WHERE shelter_id = $2',
            [dog.deadline, dog.shelter_id]
          );
        }
      } catch (err) {
        console.error(`❌ Error adding ${dog.name}:`, err.message);
      }
    }

    console.log(`✨ Added ${addedCount} new dogs`);
    return dogs;
    
  } catch (error) {
    console.error('❌ Scraping error:', error.message);
    return [];
  }
}

function startScraper() {
  const intervalMinutes = process.env.PETHARBOR_SCRAPE_INTERVAL || 60;
  
  // Run 5 seconds after startup
  setTimeout(() => {
    scrapePetHarbor();
  }, 5000);
  
  // Then every hour
  cron.schedule(`*/${intervalMinutes} * * * *`, () => {
    scrapePetHarbor();
  });
  
  console.log(`⏰ Scraper runs every ${intervalMinutes} minutes`);
}

module.exports = {
  scrapePetHarbor,
  startScraper
};
