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

function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

function shortenBreed(breed) {
  if (!breed) return 'Mixed Breed';
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

// Calculate human-readable duration between two dates
function formatDuration(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end - start;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks !== 1 ? 's' : ''}`;
  }
  const months = Math.floor(diffDays / 30);
  return `${months} month${months !== 1 ? 's' : ''}`;
}

// Format date as M/DD/YY
function formatShortDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
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
            const shelterMatch = text.match(/Shelter:\s*([A-Z\s\.]+?)\s+Age:/i);
            if (shelterMatch) {
              shelter = truncateText(shelterMatch[1].trim(), 100);
            }
            if (SOUTH_LA_ONLY && !shelter.includes('SOUTH')) {
              return;
            }
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
            let name = truncateText(animalId, 100);
            const nameMatch = html.match(/<strong><u>([^<]+)<\/u><\/strong>/i);
            if (nameMatch) {
              name = truncateText(nameMatch[1].trim(), 100);
            }
            let breed = 'Mixed Breed';
            const breedMatch = text.match(/A\d{7}\s*-\s*(?:NEUTERED|SPAYED)?\s*(?:MALE|FEMALE),?\s*([^\n\.]+?)(?:Shelter:|$)/is);
            if (breedMatch) {
              breed = breedMatch[1].trim().replace(/\s+/g, ' ');
              breed = shortenBreed(breed);
            }
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
            let age = 'Unknown';
            const ageMatch = text.match(/Age:\s*([^\n]+?)(?:Weight:|$)/i);
            if (ageMatch) {
              age = truncateText(ageMatch[1].trim(), 50);
            }
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

            // ── RESCUE ONLY ──
            // "This animal is only available to a rescue: Yes"
            let rescue_only = false;
            // Normalize whitespace in text for more reliable matching
            const normalizedText = text.replace(/\s+/g, ' ');
            // PetHarbor text runs together: "rescue: YesThis animal..." with no space
            // So we match Yes or No at the START of whatever follows the colon
            const rescueMatch = normalizedText.match(/only available to a rescue:\s*(Yes|No)/i);
            if (rescueMatch) {
              const val = rescueMatch[1].trim().toLowerCase();
              rescue_only = (val === 'yes');
              console.log(`🔍 Rescue only: "${rescueMatch[0]}" → ${rescue_only}`);
            }

            // ── INTAKE DATE ──
            // "This animal has been at the shelter since 01/24/2026 and on this list since 02/13/2026"
            let intake_date = null;
            let list_date = null;
            const intakeMatch = text.match(/at the shelter since\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
            if (intakeMatch) {
              const [, m, d, y] = intakeMatch;
              intake_date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
            const listMatch = text.match(/on this list since\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
            if (listMatch) {
              const [, m, d, y] = listMatch;
              list_date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }

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
              goal_amount: 500.00,
              rescue_only,
              intake_date,
              list_date
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
      if (a.shelterPriority !== b.shelterPriority) return a.shelterPriority - b.shelterPriority;
      return a.daysUntil - b.daysUntil;
    });

    const shelterCounts = {};
    dogs.forEach(dog => {
      shelterCounts[dog.shelter] = (shelterCounts[dog.shelter] || 0) + 1;
    });
    console.log('📊 Dogs by shelter:', shelterCounts);

    let addedCount = 0;
    for (const dog of dogs) {
      try {
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
              photo_url, petharbor_url, description, source, category, goal_amount,
              rescue_only, intake_date, list_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
            [
              dog.name, dog.breed, dog.age, dog.gender, dog.shelter,
              dog.shelter_id, dog.deadline, localPhotoUrl, dog.petharbor_url,
              dog.description, dog.source, dog.category, dog.goal_amount,
              dog.rescue_only, dog.intake_date, dog.list_date
            ]
          );
          addedCount++;
          console.log(`➕ ${dog.name} (${dog.shelter_id}) - ${dog.shelter} - ${dog.daysUntil} days${dog.rescue_only ? ' - RESCUE ONLY' : ''}`);
        } else {
          console.log(`✏️ UPDATE ${dog.shelter_id} ${dog.name} rescue_only=${dog.rescue_only} (type: ${typeof dog.rescue_only})`);
          await db.query(
            `UPDATE dogs SET 
              name = $1, breed = $2, age = $3, gender = $4, shelter = $5,
              deadline = $6, photo_url = $7, description = $8,
              rescue_only = $9, intake_date = $10, list_date = $11
            WHERE shelter_id = $12`,
            [
              dog.name, dog.breed, dog.age, dog.gender, dog.shelter,
              dog.deadline, localPhotoUrl, dog.description,
              dog.rescue_only, dog.intake_date, dog.list_date,
              dog.shelter_id
            ]
          );
        }
      } catch (err) {
        console.error(`❌ Error adding ${dog.name}:`, err.message);
      }
    }
    console.log(`✨ Added ${addedCount} new dogs to database`);

    // Remove dogs no longer on euth list
    const scrapedIds = dogs.map(d => d.shelter_id);
    if (scrapedIds.length > 0) {
      const placeholders = scrapedIds.map((_, i) => `$${i + 1}`).join(',');
      const deleteResult = await db.query(
        `DELETE FROM dogs WHERE source = 'petharbor' AND shelter_id NOT IN (${placeholders})`,
        scrapedIds
      );
      if (deleteResult.rowCount > 0) {
        console.log(`🗑️ Removed ${deleteResult.rowCount} dogs no longer on euth list`);
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
