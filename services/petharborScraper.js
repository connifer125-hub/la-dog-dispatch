const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const db = require('../config/database');
const { downloadAndSaveImage } = require('./imageDownloader');

const BASE_URL = 'https://petharbor.com/results.asp?WHERE=type_DOG&searchtype=ALL&friends=1&samaritans=1&nosuccess=0&rows=100&imght=120&imgres=Detail&tWidth=200&view=sysadm.v_lact_alert_euth&bgcolor=white&text=blue&alink=000000&vlink=FF6600&fontface=arial&fontsize=10&col_hdr_bg=e6e6e6&col_bg=white&col_bg2=e6e6e6&SBG=e6e6e6&SHELTERLIST=%27LACT%27,%27LACT1%27,%27LACT4%27,%27LACT3%27,%27LACT2%27,%27LACT5%27,%27LACT6%27&OrderBy=shelter';

const SOUTH_LA_ONLY = false;

// ── NOTES: max chars to store in notes_short ──────────────────────
const NOTES_SHORT_MAX = 280;

// ── TWILIO SMS ALERTS ──────────────────────────────────────────────
async function sendNewDogAlert(dog) {
  try {
    const now = new Date();
    const hour = parseInt(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false }));
    const alertStart = parseInt(process.env.SMS_ALERT_START_HOUR || '7');
    const alertEnd = parseInt(process.env.SMS_ALERT_END_HOUR || '21');
    if (hour < alertStart || hour >= alertEnd) {
      console.log(`⏰ SMS suppressed (outside alert hours ${alertStart}:00-${alertEnd}:00 PT) — ${dog.name}`);
      return;
    }

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    const adminNumbers = (process.env.ADMIN_PHONE_NUMBERS || '').split(',').map(n => n.trim()).filter(Boolean);

    if (!sid || !token || !fromNumber || !adminNumbers.length) {
      console.log('⚠️ Twilio not configured — skipping SMS alert');
      return;
    }

    const deadline = new Date(dog.deadline);
    const daysLeft = Math.ceil((deadline - new Date()) / 86400000);
    const dlStr = deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const message = [
      `🚨 New dog on euth list: ${dog.name || dog.shelter_id}`,
      `${dog.shelter} · ${dog.breed || 'Mixed'} · ${dog.age || ''}`,
      `Deadline: ${dlStr} (${daysLeft} day${daysLeft !== 1 ? 's' : ''})`,
      dog.rescue_only ? '🔒 Rescue pull only' : '✅ Foster/adopt eligible',
      dog.notes_short ? `⚠️ ${dog.notes_short}` : '',
      `ladogdispatch.com`
    ].filter(Boolean).join('\n');

    const client = require('twilio')(sid, token);
    for (const to of adminNumbers) {
      await client.messages.create({ body: message, from: fromNumber, to });
      console.log(`📱 SMS sent to ${to} for ${dog.name}`);
    }
  } catch (err) {
    console.error('❌ SMS alert failed:', err.message);
  }
}

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

// ── NOTES: extract and clean behavioral notes from Pet Harbor text ─
function parseNotes(text) {
  if (!text) return { notes: null, notes_short: null };

  // Pet Harbor puts notes/comments in a "Comments:" or "Special Needs:" block
  // Try several known label patterns
  const patterns = [
    /Comments?:\s*([^\n]{10,})/i,
    /Special\s+Needs?:\s*([^\n]{5,})/i,
    /Behavior\s+Notes?:\s*([^\n]{5,})/i,
    /Staff\s+Notes?:\s*([^\n]{5,})/i,
    /Notes?:\s*([^\n]{10,})/i,
  ];

  let rawNotes = null;
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      rawNotes = match[1].trim();
      break;
    }
  }

  if (!rawNotes) return { notes: null, notes_short: null };

  // Clean up common shelter shorthand artifacts
  const cleaned = rawNotes
    .replace(/\s+/g, ' ')           // collapse whitespace
    .replace(/[<>]/g, '')           // strip any stray HTML
    .trim();

  if (cleaned.length < 5) return { notes: null, notes_short: null };

  // Full notes saved as-is (no truncation — rescues need complete info)
  const notes = cleaned;

  // notes_short: truncate at word boundary for card/canvas display
  let notes_short = cleaned;
  if (cleaned.length > NOTES_SHORT_MAX) {
    notes_short = cleaned.substring(0, NOTES_SHORT_MAX);
    // Back up to last full word
    const lastSpace = notes_short.lastIndexOf(' ');
    if (lastSpace > NOTES_SHORT_MAX * 0.8) notes_short = notes_short.substring(0, lastSpace);
    notes_short = notes_short + '…';
  }

  return { notes, notes_short };
}

function cleanBreed(rawBreed) {
  if (!rawBreed) return 'Mixed Breed';

  let breed = rawBreed.toUpperCase().trim();
  breed = breed.replace(/\.$/, '').trim();

  const colors = ['BLACK', 'WHITE', 'BROWN', 'TAN', 'GRAY', 'GREY', 'RED', 'YELLOW', 'CREAM', 'ORANGE', 'BLUE', 'SILVER', 'GOLD', 'GOLDEN', 'CHOCOLATE', 'TRICOLOR', 'BRINDLE', 'MERLE', 'SABLE'];
  const colorPattern = new RegExp('^(' + colors.join('|') + ')(\\s+AND\\s+(' + colors.join('|') + '))?\\s+', 'i');
  breed = breed.replace(colorPattern, '').trim();

  breed = breed.replace(/\bDOG\b$/i, '').trim();
  breed = breed.replace(/\bDOG\b(?=\s+AND\b)/i, '').trim();

  const parts = breed.split(/\s+AND\s+/i).map(p => p.trim()).filter(Boolean);

  const cleaned = parts.map(p => {
    p = p.replace(/\bDOG\b$/i, '').trim();
    return simplifyBreed(p);
  }).filter(Boolean);

  if (cleaned.length === 0) return 'Mixed Breed';
  if (cleaned.length === 1) return cleaned[0];
  if (cleaned.length === 2) return cleaned[0] + ' & ' + cleaned[1];
  return 'Mixed Breed';
}

function simplifyBreed(breed) {
  if (!breed) return '';
  breed = breed.trim();

  const simplifications = [
    [/AMERICAN PIT BULL TERRIER/i, 'Pit Bull'],
    [/PIT BULL TERRIER/i, 'Pit Bull'],
    [/PIT BULL/i, 'Pit Bull'],
    [/AMERICAN STAFFORDSHIRE TERRIER/i, 'Am. Staff'],
    [/STAFFORDSHIRE BULL TERRIER/i, 'Staffy'],
    [/AMERICAN BULLDOG/i, 'Bulldog'],
    [/ENGLISH BULLDOG/i, 'Bulldog'],
    [/FRENCH BULLDOG/i, 'French Bulldog'],
    [/BULLDOG/i, 'Bulldog'],
    [/GERMAN SHEPHERD DOG/i, 'German Shepherd'],
    [/GERMAN SHEPHERD/i, 'German Shepherd'],
    [/BELGIAN MALINOIS/i, 'Belgian Malinois'],
    [/LABRADOR RETRIEVER/i, 'Lab'],
    [/GOLDEN RETRIEVER/i, 'Golden Retriever'],
    [/AUSTRALIAN SHEPHERD/i, 'Aussie'],
    [/BORDER COLLIE/i, 'Border Collie'],
    [/SIBERIAN HUSKY/i, 'Husky'],
    [/ALASKAN HUSKY/i, 'Alaskan Husky'],
    [/DOBERMAN PINSCHER/i, 'Doberman'],
    [/MINIATURE PINSCHER/i, 'Min Pin'],
    [/ROTTWEILER/i, 'Rottweiler'],
    [/GREAT DANE/i, 'Great Dane'],
    [/BOXER/i, 'Boxer'],
    [/CHOW CHOW/i, 'Chow'],
    [/JACK RUSSELL TERRIER/i, 'Jack Russell'],
    [/CHIHUAHUA/i, 'Chihuahua'],
    [/DACHSHUND/i, 'Dachshund'],
    [/POODLE/i, 'Poodle'],
    [/BEAGLE/i, 'Beagle'],
    [/COCKER SPANIEL/i, 'Cocker Spaniel'],
    [/SHIH TZU/i, 'Shih Tzu'],
    [/MALTESE/i, 'Maltese'],
    [/POMERANIAN/i, 'Pomeranian'],
    [/YORKSHIRE TERRIER/i, 'Yorkie'],
    [/BOSTON TERRIER/i, 'Boston Terrier'],
    [/BULL TERRIER/i, 'Bull Terrier'],
    [/TERRIER MIX/i, 'Terrier Mix'],
    [/TERRIER/i, 'Terrier'],
    [/SHEPHERD MIX/i, 'Shepherd Mix'],
    [/HOUND MIX/i, 'Hound Mix'],
    [/HOUND/i, 'Hound'],
    [/MIXED BREED/i, 'Mixed Breed'],
    [/MIX/i, 'Mix'],
  ];

  for (const [pattern, replacement] of simplifications) {
    if (pattern.test(breed)) return replacement;
  }

  return breed.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

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

function formatShortDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
}

async function scrapePetHarbor() {
  try {
    console.log('🔍 Scraping PetHarbor for urgent dogs...');
    if (SOUTH_LA_ONLY) console.log('📍 SOUTH LA ONLY mode enabled');

    const dogs = [];

    for (let page = 1; page <= 5; page++) {
      const pageUrl = `${BASE_URL}&PAGE=${page}`;
      try {
        const response = await axios.get(pageUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
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
            if (shelterMatch) shelter = truncateText(shelterMatch[1].trim(), 100);

            if (SOUTH_LA_ONLY && !shelter.includes('SOUTH')) return;

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
            if (nameMatch) name = truncateText(nameMatch[1].trim(), 100);

            let breed = 'Mixed Breed';
            const breedMatch2 = text.match(/A\d{7}\s*[-–]\s*(?:NEUTERED\s+|SPAYED\s+)?(?:MALE|FEMALE),\s*([^.]+)\./i);
            if (breedMatch2 && breedMatch2[1]) breed = cleanBreed(breedMatch2[1].trim());

            let gender = 'Unknown';
            if (text.match(/NEUTERED\s*MALE/i)) gender = 'Male';
            else if (text.match(/SPAYED\s*FEMALE/i)) gender = 'Female';
            else if (text.match(/(?<!NEUTERED\s)MALE/i)) gender = 'Male';
            else if (text.match(/(?<!SPAYED\s)FEMALE/i)) gender = 'Female';

            let age = 'Unknown';
            const ageMatch = text.match(/Age:\s*([^\n]+?)(?:Weight:|$)/i);
            if (ageMatch) age = truncateText(ageMatch[1].trim(), 50);

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
            let rescue_only = false;
            const normalizedText = text.replace(/\s+/g, ' ');
            const rescueMatch = normalizedText.match(/only available to a rescue:\s*(Yes|No)/i);
            if (rescueMatch) {
              const val = rescueMatch[1].trim().toLowerCase();
              rescue_only = (val === 'yes');
              console.log(`🔍 Rescue only: "${rescueMatch[0]}" → ${rescue_only}`);
            }

            // ── INTAKE DATE ──
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

            // ── BEHAVIORAL NOTES ──
            const { notes, notes_short } = parseNotes(text);
            if (notes) console.log(`📋 Notes found for ${animalId}: "${notes_short}"`);

            const description = truncateText(
              `${name} is on the euthanasia list at ${shelter}. Urgent rescue needed by ${deadline}.`,
              200
            );
            const daysUntil = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
            const shelterPriority = SHELTER_PRIORITY[shelter.toUpperCase()] || 99;

            dogs.push({
              name, breed, age, gender, shelter, shelter_id: animalId,
              deadline, daysUntil, shelterPriority, petharborPhotoUrl,
              petharbor_url: `https://petharbor.com/pet.asp?uaid=${animalId.substring(1)}`,
              description, source: 'petharbor', category: 'general',
              goal_amount: 500.00, rescue_only, intake_date, list_date,
              notes, notes_short
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
    dogs.forEach(dog => { shelterCounts[dog.shelter] = (shelterCounts[dog.shelter] || 0) + 1; });
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
          // ── INSERT — includes notes and notes_short ──
          await db.query(
            `INSERT INTO dogs (
              name, breed, age, gender, shelter, shelter_id, deadline,
              photo_url, petharbor_url, description, source, category, goal_amount,
              rescue_only, intake_date, list_date, notes, notes_short
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
            [
              dog.name, dog.breed, dog.age, dog.gender, dog.shelter,
              dog.shelter_id, dog.deadline, localPhotoUrl, dog.petharbor_url,
              dog.description, dog.source, dog.category, dog.goal_amount,
              dog.rescue_only, dog.intake_date, dog.list_date,
              dog.notes, dog.notes_short
            ]
          );
          addedCount++;
          console.log(`➕ ${dog.name} (${dog.shelter_id}) - ${dog.shelter} - ${dog.daysUntil} days${dog.rescue_only ? ' - RESCUE ONLY' : ''}${dog.notes ? ' - HAS NOTES' : ''}`);
          await sendNewDogAlert(dog);
        } else {
          // ── UPDATE — includes notes and notes_short ──
          console.log(`✏️ UPDATE ${dog.shelter_id} ${dog.name} rescue_only=${dog.rescue_only}${dog.notes ? ' notes updated' : ''}`);
          await db.query(
            `UPDATE dogs SET 
              name = $1, breed = $2, age = $3, gender = $4, shelter = $5,
              deadline = $6, photo_url = $7, description = $8,
              rescue_only = $9, intake_date = $10, list_date = $11,
              notes = $12, notes_short = $13
            WHERE shelter_id = $14`,
            [
              dog.name, dog.breed, dog.age, dog.gender, dog.shelter,
              dog.deadline, localPhotoUrl, dog.description,
              dog.rescue_only, dog.intake_date, dog.list_date,
              dog.notes, dog.notes_short,
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

// ── AUTO-MIGRATION: add notes columns if they don't exist ─────────
async function runMigrations() {
  try {
    await db.query(`
      ALTER TABLE dogs ADD COLUMN IF NOT EXISTS notes TEXT;
    `);
    await db.query(`
      ALTER TABLE dogs ADD COLUMN IF NOT EXISTS notes_short VARCHAR(300);
    `);
    console.log('✅ DB migration: notes columns ready');
  } catch (err) {
    console.error('⚠️ Migration warning (non-fatal):', err.message);
  }
}

function startScraper() {
  const intervalMinutes = process.env.PETHARBOR_SCRAPE_INTERVAL || 60;
  // Run migrations first, then start scraping
  runMigrations().then(() => {
    setTimeout(() => { scrapePetHarbor(); }, 5000);
    cron.schedule(`*/${intervalMinutes} * * * *`, () => { scrapePetHarbor(); });
    console.log(`⏰ PetHarbor scraper scheduled to run every ${intervalMinutes} minutes`);
  });
}

module.exports = { scrapePetHarbor, startScraper };
