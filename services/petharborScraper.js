const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const db = require('../config/database');
const { downloadAndSaveImage } = require('./imageDownloader');

const BASE_URL = 'https://petharbor.com/results.asp?WHERE=type_DOG&searchtype=ALL&friends=1&samaritans=1&nosuccess=0&rows=100&imght=120&imgres=Detail&tWidth=200&view=sysadm.v_lact_alert_euth&bgcolor=white&text=blue&alink=000000&vlink=FF6600&fontface=arial&fontsize=10&col_hdr_bg=e6e6e6&col_bg=white&col_bg2=e6e6e6&SBG=e6e6e6&SHELTERLIST=%27LACT%27,%27LACT1%27,%27LACT4%27,%27LACT3%27,%27LACT2%27,%27LACT5%27,%27LACT6%27&OrderBy=shelter';

const SOUTH_LA_ONLY = false;

const SHELTER_PRIORITY = {
  'SOUTH L.A.': 1,
  'SOUTH LA': 1,
  'WEST L.A.': 2,
  'WEST LA': 2,
  'NORTH CENTRAL': 3,
  'EAST VALLEY': 4,
  'WEST VALLEY': 5,
  'HARBOR': 6
};

// Helper function to truncate text safely
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Helper function to shorten breed names
function shortenBreed(breed) {
  if (!breed) return 'Mixed Breed';
  
  // Common abbreviations
  const abbreviations = {
    'AMERICAN STAFFORDSHIRE TERRIER': 'Am. Staff',
    'STAFFORDSHIRE': 'Staff',
    'TERRIER': 'Terrier',
    'SHEPHERD': 'Shepherd',
    'RETRIEVER': 'Retriever',
    'AND': '/',
    '  ': ' '
  };
  
  let shortened = breed;
  Object.keys(abbreviations).forEach(key => {
    shortened = shortened.replace(new RegExp(key, 'gi'), abbreviations[key]);
  });
  
  return truncateText(shortened, 200);
}

async function scrapePetHarbor() {
  try {
    console.log('🔍 Scraping PetHarbor for urgent dogs...');
    if (SOUTH_LA_ONLY) {
      console.log('📍 SOUTH LA ONLY mode enabled');
    }
    
    const dogs = [];
    
    for (let page = 1; page <= 5; page++) {
      const pageUrl = `${BASE_URL}&PAGE=${page}`;
      
      try {
        const response = await axios.get(pageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 15000
        });

        const $ = cheerio.load(response.data);
        let foundOnPage = 0;
        
        $('table.ResultsTable tr').each((rowIndex, row) => {
          try {
            const $row = $(row);
            const $cells = $row.find('td');
            
            if ($cells.length < 2) return;
            
            const $textCell = $cells.eq(1);
            const text = $textCell.text();
            const html = $textCell.html();
            
            const idMatch = text.match(/A\d{7}/);
            if (!idMatch) return;
            const animalId = idMatch[0];
            
            let shelter = 'LA County';
            const shelterMatch = text.match(/Shelter:\s*([A-Z\s\.]+?)(?:\s+Age:)/i);
            if (shelterMatch) {
              shelter = truncateText(shelterMatch[1].trim(), 100);
            }
            
            if (SOUTH_LA_ONLY && !shelter.includes('SOUTH')) {
              return;
            }
            
            // Get photo from PetHarbor
            const $photoCell = $cells.eq(0);
            const img = $photoCell.find('img').first();
            let petharborPhotoUrl = null;
            
            if (img.length > 0) {
              let src = img.attr('src');
              if (src) {
                if (src.startsWith('get_image.asp')) {
                  petharborPhotoUrl = `https://petharbor.com/${src}`;
                } else if (!src.startsWith('http')) {
                  petharborPhotoUrl = `https://petharbor.com${src}`;
                } else {
                  petharborPhotoUrl = src;
                }
              }
            }
            
            // Extract name - truncate to 100 chars
            let name = truncateText(animalId, 100);
            const nameMatch = html.match(/<strong><u>([^<]+)<\/u><\/strong>/i);
            if (nameMatch) {
              name = truncateText(nameMatch[1].trim(), 100);
            }
            
            // Extract and shorten breed
            let breed = 'Mixed Breed';
            const breedMatch = text.match(/A\d{7}\s*-\s*(?:NEUTERED|SPAYED)?\s*(?:MALE|FEMALE),?\s*([^\n\.]+?)(?:Shelter:|$)/is);
            if (breedMatch) {
              breed = breedMatch[1].trim().replace(/\s+/g, ' ');
              breed = shortenBreed(breed);
            }
            
            // Extract gender
            let gender = 'Unknown';
            if (text.match(/NEUTERED\s*MALE/i)) {
              gender = 'Male';
            } else if (text.match(/SPAYED\s*FEMALE/i)) {
              gender = 'Female';  
            } else if (text.match(/(?<!NEUTERED\s)MALE/i)) {
              gender = 'Male';
            } else if (text.match(/(?<!SPAYED\s)FEMALE/i)) {
              gender = 'Female';
            }
            
            // Extract age - truncate to 50 chars
            let age = 'Unknown';
            const ageMatch = text.match(/Age:\s*([^\n]+?)(?:Weight:|$)/i);
            if (ageMatch) {
              age = truncateText(ageMatch[1].trim(), 50);
            }
            
            // Extract deadline
            let deadline = null;
            const euthMatch = text.match(/Scheduled\s+Euthanasia\s+Date:\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i);
            if (euthMatch) {
              let [, month, day, year] = euthMatch;
              if (year.length === 2) year = '20' + year;
              deadline = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
            
            if (!deadline) {
              const futureDate = new Date();
              futureDate.setDate(futureDate.getDate() + 3);
              deadline = futureDate.toISOString().split('T')[0];
            }
            
            // Create concise description - max 200 chars
            const description = truncateText(
              `${name} is on the euthanasia list at ${shelter}. Urgent rescue needed by ${deadline}.`,
              200
            );
            
            const daysUntil = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
            const shelterPriority = SHELTER_PRIORITY[shelter.toUpperCase()] || 99;
            
            dogs.push({
              name,
              breed,
              age,
              gender,
              shelter,
              shelter_id: animalId,
              deadline,
              daysUntil,
              shelterPriority,
              petharborPhotoUrl,
              petharbor_url: `https://petharbor.com/pet.asp?uaid=${animalId.substring(1)}`,
              description,
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

    console.log(`✅ Total found: ${dogs.length} urgent dogs`);

    dogs.sort((a, b) => {
      if (a.shelterPriority !== b.shelterPriority) {
        return a.shelterPriority - b.shelterPriority;
      }
      return a.daysUntil - b.daysUntil;
    });

    const shelterCounts = {};
    dogs.forEach(dog => {
      shelterCounts[dog.shelter] = (shelterCounts[dog.shelter] || 0) + 1;
    });
    console.log('📊 Dogs by shelter:', shelterCounts);

    // Download images and add to database
    let addedCount = 0;
    for (const dog of dogs) {
      try {
        // Download image if we have a PetHarbor URL
        let localPhotoUrl = 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400';
        if (dog.petharborPhotoUrl) {
          localPhotoUrl = await downloadAndSaveImage(dog.petharborPhotoUrl, dog.shelter_id);
        }
        
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
              dog.shelter_id, dog.deadline, localPhotoUrl, dog.petharbor_url,
              dog.description, dog.source, dog.category, dog.goal_amount
            ]
          );
          addedCount++;
          console.log(`➕ ${dog.name} (${dog.shelter_id}) - ${dog.shelter} - ${dog.daysUntil} days`);
        } else {
          await db.query(
            'UPDATE dogs SET deadline = $1, photo_url = $2 WHERE shelter_id = $3',
            [dog.deadline, localPhotoUrl, dog.shelter_id]
          );
        }
      } catch (err) {
        console.error(`❌ Error adding ${dog.name}:`, err.message);
      }
    }

    console.log(`✨ Added ${addedCount} new dogs to database`);
    return dogs;
    
  } catch (error) {
    console.error('❌ PetHarbor scraping error:', error.message);
    return [];
  }
}

function startScraper() {
  const intervalMinutes = process.env.PETHARBOR_SCRAPE_INTERVAL || 60;
  
  setTimeout(() => {
    scrapePetHarbor();
  }, 5000);
  
  cron.schedule(`*/${intervalMinutes} * * * *`, () => {
    scrapePetHarbor();
  });
  
  console.log(`⏰ PetHarbor scraper scheduled to run every ${intervalMinutes} minutes`);
}

module.exports = {
  scrapePetHarbor,
  startScraper
};
