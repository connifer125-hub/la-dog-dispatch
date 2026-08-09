// ── LA Dog Dispatch — Shared IG Card Generator ────────────────────
// Used by: index.html, social.html, rescue.html
// To update the card design, edit ONLY this file.

const NOTES_DISCLAIMER = "Shelter notes are snapshots written in stressful environments & may not reflect a dog's real personality. Training, love & patience needed.";

// ── SHELTER COLOR SCHEMES ──────────────────────────────────────────
function getShelterColors(shelter) {
  const s = (shelter || '').toUpperCase().replace(/\./g, '');
  if (s.includes('SOUTH LA') || s.includes('SOUTH L A')) {
    return { primary: '#4a8c6a', light: '#7ec8a0', dark: '#1a2e24', deadline: '#7ec8a0' };
  } else if (s.includes('EAST VALLEY')) {
    return { primary: '#c4281c', light: '#ff6b5b', dark: '#2e1a1a', deadline: '#ff6b5b' };
  } else if (s.includes('WEST VALLEY')) {
    return { primary: '#e67e22', light: '#f5a623', dark: '#2e1f0a', deadline: '#f5a623' };
  } else if (s.includes('HARBOR')) {
    return { primary: '#d97706', light: '#fbbf24', dark: '#2a1f00', deadline: '#fbbf24' };
  } else if (s.includes('NORTH CENTRAL')) {
    return { primary: '#2563eb', light: '#60a5fa', dark: '#0f1e3d', deadline: '#60a5fa' };
  } else if (s.includes('WEST LA') || s.includes('WEST L A')) {
    return { primary: '#7c3aed', light: '#a78bfa', dark: '#1e1040', deadline: '#a78bfa' };
  }
  // Default fallback — brand green
  return { primary: '#4a8c6a', light: '#7ec8a0', dark: '#1a2e24', deadline: '#7ec8a0' };
}

// ── CITY/STATE per shelter (short form for the top badge) ─────────
function getShelterCityState(shelter) {
  const s = (shelter || '').toUpperCase();
  if (s === 'SOUTH L.A.') return 'Los Angeles, CA';
  if (s === 'WEST L.A.') return 'Los Angeles, CA';
  if (s === 'NORTH CENTRAL') return 'Los Angeles, CA';
  if (s === 'EAST VALLEY') return 'Van Nuys, CA';
  if (s === 'WEST VALLEY') return 'Chatsworth, CA';
  if (s === 'HARBOR') return 'San Pedro, CA';
  return '';
}

// ── Detects shelter notes indicating a space/overcapacity release ─
function isSpaceEuthanasia(notes) {
  const n = (notes || '').toLowerCase();
  return /capacity|lack of space|due to space|shelter space|kennel space|space (constraints|concerns|issues|reasons)|out of space/.test(n);
}

// ── Puppy (<12mo, isolated month age only) / Senior (7+ yrs) flags ─
function getAgeFlags(ageRaw) {
  const ageStr = (ageRaw || '').toLowerCase().trim();

  // Explicit categorical labels some shelters use instead of a numeric age
  if (/\bsenior\b/.test(ageStr)) return { isPuppy: false, isSenior: true };
  if (/\bpuppy\b|\bpup\b/.test(ageStr)) return { isPuppy: true, isSenior: false };

  const yearMatch = ageStr.match(/(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?|y\/?o|y)\b/);
  const monthMatch = ageStr.match(/(\d+(?:\.\d+)?)\s*(?:mo\.?|mo's|mos|months?)\b/);
  const plainNumMatch = ageStr.match(/^(\d+(?:\.\d+)?)\+?$/);

  let isPuppy = false, isSenior = false;
  if (!yearMatch && monthMatch) {
    isPuppy = parseFloat(monthMatch[1]) < 12;
  } else if (!yearMatch && !monthMatch && plainNumMatch) {
    isPuppy = parseFloat(plainNumMatch[1]) < 1;
  }
  if (!isPuppy) {
    let years = null;
    if (yearMatch) years = parseFloat(yearMatch[1]);
    else if (!monthMatch && plainNumMatch) years = parseFloat(plainNumMatch[1]);
    if (years !== null && years >= 7) isSenior = true;
  }
  return { isPuppy, isSenior };
}

function safeJson(dog) {
    return JSON.stringify(dog)
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}

function getPacificToday() {
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const parts = fmt.formatToParts(new Date());
    const y = parseInt(parts.find(p => p.type === 'year').value, 10);
    const m = parseInt(parts.find(p => p.type === 'month').value, 10);
    const d = parseInt(parts.find(p => p.type === 'day').value, 10);
    return new Date(y, m - 1, d);
}

function parseLocalDate(dateStr) {
    if (!dateStr) return new Date(NaN);
    if (dateStr instanceof Date) return dateStr;
    const parts = String(dateStr).split(/[-T]/);
    const y = parseInt(parts[0], 10), m = parseInt(parts[1], 10), d = parseInt(parts[2], 10);
    if (!y || !m || !d) return new Date(dateStr);
    return new Date(y, m - 1, d);
}

function calcDaysLeft(deadline) {
    const d = parseLocalDate(deadline);
    const today = getPacificToday();
    d.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    return Math.round((d - today) / 86400000);
}

async function generateCard(dog) {
    const c = document.getElementById('card-canvas');
    const ctx = c.getContext('2d');
    const W = 1080, H = 1080;
    c.width = W; c.height = H;
    ctx.clearRect(0, 0, W, H);

    const daysLeft = calcDaysLeft(dog.deadline);
    const isCritical = daysLeft <= 1;
    const isRescueOnly = dog.rescue_only === true || dog.rescue_only === "true" || dog.rescue_only === 1;
    const hasNotes = dog.notes && dog.notes.trim().length > 0;
    const colors = getShelterColors(dog.shelter);
    const spaceEuth = isSpaceEuthanasia(dog.notes);
    const { isPuppy, isSenior } = getAgeFlags(dog.age);

    function rr(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
        ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
        ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
        ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
    }

    function wrapText(text, font, maxW) {
        ctx.font = font;
        const words = text.split(' ');
        let line = '', result = [];
        for (const w of words) {
            const test = line ? line + ' ' + w : w;
            if (ctx.measureText(test).width > maxW && line) { result.push(line); line = w; }
            else { line = test; }
        }
        if (line) result.push(line);
        return result;
    }

    function drawBubble(text, centerX, y, fontSize, maxWidth) {
        ctx.save();
        ctx.font = `900 ${fontSize}px 'Arial Black', Arial, sans-serif`;
        ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
        ctx.lineWidth = fontSize*0.22; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(text, centerX, y, maxWidth);
        ctx.lineWidth = fontSize*0.18; ctx.strokeStyle = colors.dark; ctx.strokeText(text, centerX, y, maxWidth);
        ctx.lineWidth = fontSize*0.10; ctx.strokeStyle = colors.primary; ctx.strokeText(text, centerX, y, maxWidth);
        ctx.lineWidth = fontSize*0.04; ctx.strokeStyle = colors.light; ctx.strokeText(text, centerX, y, maxWidth);
        const grad = ctx.createLinearGradient(0, y-fontSize, 0, y);
        grad.addColorStop(0,'#ffffff'); grad.addColorStop(0.35, colors.light); grad.addColorStop(1, colors.primary);
        ctx.fillStyle = grad; ctx.fillText(text, centerX, y, maxWidth);
        ctx.restore();
    }

    // ── BACKGROUND ──
    ctx.fillStyle = '#141414'; ctx.fillRect(0,0,W,H);
    const vignette = ctx.createRadialGradient(W/2,H/2,W*0.25,W/2,H/2,W*0.75);
    vignette.addColorStop(0,'rgba(0,0,0,0)'); vignette.addColorStop(1,'rgba(0,0,0,0.5)');
    ctx.fillStyle = vignette; ctx.fillRect(0,0,W,H);

    // ── TOP BAR — shelter color ──
    const topBar = ctx.createLinearGradient(0,0,W,0);
    topBar.addColorStop(0, colors.dark); topBar.addColorStop(0.5, colors.primary); topBar.addColorStop(1, colors.dark);
    ctx.fillStyle = topBar; ctx.fillRect(0,0,W,14);

    // ── TOP ROW ──
    const rowH = 76, rowMid = 14+rowH/2;

    // Urgent badge — ALWAYS RED
    ctx.fillStyle = '#c4281c'; rr(36,rowMid-24,200,48,24); ctx.fill();
    ctx.fillStyle = 'white'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(isCritical ? '🚨 CRITICAL' : '⚠️ URGENT', 136, rowMid+8);

    // Shelter badge — shelter color, now with City/State, auto-shrinks to fit
    const cityState = getShelterCityState(dog.shelter);
    const shelterBadgeText = '📍 ' + (dog.shelter||'LA COUNTY').toUpperCase() + (cityState ? ' - ' + cityState.toUpperCase() : '');
    const shelterBadgeMaxW = 700;
    let shelterFontSize = 26;
    ctx.font = `bold ${shelterFontSize}px sans-serif`;
    while (ctx.measureText(shelterBadgeText).width > shelterBadgeMaxW && shelterFontSize > 15) {
        shelterFontSize -= 1; ctx.font = `bold ${shelterFontSize}px sans-serif`;
    }
    ctx.fillStyle = colors.deadline; ctx.textAlign = 'center';
    ctx.fillText(shelterBadgeText, W/2, rowMid+9, shelterBadgeMaxW);

    const lr=32, lx=W-36-lr, ly=rowMid;
    await new Promise(resolve => {
        const logoImg = new Image();
        logoImg.onload = () => {
            ctx.save(); ctx.beginPath(); ctx.arc(lx,ly,lr,0,Math.PI*2); ctx.clip();
            ctx.drawImage(logoImg, lx-lr, ly-lr, lr*2, lr*2); ctx.restore();
            ctx.beginPath(); ctx.arc(lx,ly,lr,0,Math.PI*2);
            ctx.strokeStyle=colors.primary; ctx.lineWidth=3; ctx.stroke(); resolve();
        };
        logoImg.onerror = () => {
            ctx.beginPath(); ctx.arc(lx,ly,lr,0,Math.PI*2);
            ctx.fillStyle=colors.dark; ctx.fill();
            ctx.strokeStyle=colors.primary; ctx.lineWidth=3; ctx.stroke();
            ctx.fillStyle=colors.light; ctx.font='26px sans-serif'; ctx.textAlign='center';
            ctx.fillText('🐾', lx, ly+9); resolve();
        };
        logoImg.src = '/logo-icon.png';
    });

    ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(44,14+rowH); ctx.lineTo(W-44,14+rowH); ctx.stroke();

    // ── TOP BANNER: space-euth takes priority; otherwise age alert takes the slot ──
    let topExtra = 0;
    const topBannerIsSpace = spaceEuth;
    const topBannerIsAge = !spaceEuth && (isPuppy || isSenior);
    // If space-euth AND an age flag, the age alert becomes a small tag above the photo instead
    const ageTagAbovePhoto = spaceEuth && (isPuppy || isSenior);

    if (topBannerIsSpace || topBannerIsAge) {
        const bannerH = 56, bannerY = 14 + rowH + 14;
        if (topBannerIsSpace) {
            ctx.fillStyle = 'rgba(196,40,28,0.18)'; rr(36, bannerY, W-72, bannerH, 10); ctx.fill();
            ctx.strokeStyle = 'rgba(255,90,72,0.7)'; ctx.lineWidth = 2; rr(36, bannerY, W-72, bannerH, 10); ctx.stroke();
            ctx.fillStyle = '#ffffff'; ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('🏠 WILL BE EUTHANIZED FOR SHELTER SPACE', W/2, bannerY + bannerH/2 + 10, W-110);
        } else {
            const label = isPuppy ? '🐶 PUPPY ALERT' : '🐾 SENIOR ALERT';
            ctx.fillStyle = 'rgba(255,255,255,0.08)'; rr(36, bannerY, W-72, bannerH, 10); ctx.fill();
            ctx.strokeStyle = colors.light; ctx.lineWidth = 2; rr(36, bannerY, W-72, bannerH, 10); ctx.stroke();
            ctx.fillStyle = colors.light; ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(label, W/2, bannerY + bannerH/2 + 10, W-110);
        }
        topExtra = bannerH + 16;
    }

    // ── NAME, META, DEADLINE ──
    const SAFE_W = W-80;
    const name = (dog.name||dog.shelter_id||'UNKNOWN').toUpperCase();
    // Cap the max starting size a bit lower when a top banner is shown,
    // so a short name + RESCUE ONLY badge can never collide with the divider below.
    let fontSize = topExtra > 0 ? 160 : 220;
    ctx.font = `900 ${fontSize}px 'Arial Black', Arial, sans-serif`;
    while(ctx.measureText(name).width > SAFE_W && fontSize > 80){ fontSize-=8; ctx.font=`900 ${fontSize}px 'Arial Black', Arial, sans-serif`; }
    const nameY = 14+rowH+10+topExtra+fontSize+10;
    drawBubble(name, W/2, nameY, fontSize, SAFE_W);

    ctx.fillStyle='#ffffff'; ctx.font='italic 36px Georgia,serif'; ctx.textAlign='center';
    const ageDisplay = (dog.age && dog.age.trim()) ? dog.age : 'Age Unknown';
    ctx.fillText([dog.breed, dog.gender, ageDisplay].filter(Boolean).join('  ·  '), W/2, nameY+62, SAFE_W);

    const dlDateObj = parseLocalDate(dog.deadline);
    const dlStr = (dlDateObj.getMonth()+1) + '/' + dlDateObj.getDate();
    const rescueDlObj = new Date(dlDateObj); rescueDlObj.setDate(rescueDlObj.getDate()-1);
    const rescueDlStr = (rescueDlObj.getMonth()+1) + '/' + rescueDlObj.getDate();
    const dlLabel = `Euth Date: ${dlStr}`;
    // Always the two fixed dates — never a relative day-count, since we can't
    // know when someone actually sees the post.
    const dlDays = `  \u00b7  Rescue Deadline EOD ${rescueDlStr}`;
    let dlSize = 46; ctx.font=`bold ${dlSize}px sans-serif`;
    while(ctx.measureText(dlLabel+dlDays).width > SAFE_W && dlSize>26){ dlSize-=2; ctx.font=`bold ${dlSize}px sans-serif`; }
    const dlLabelW = ctx.measureText(dlLabel).width, dlDaysW = ctx.measureText(dlDays).width;
    const dlStartX = W/2-(dlLabelW+dlDaysW)/2;

    // Deadline — solid shelter color
    ctx.fillStyle = colors.deadline; ctx.textAlign='left';
    ctx.fillText(dlLabel, dlStartX, nameY+134);
    ctx.fillStyle = isCritical ? '#ff5252' : colors.deadline;
    ctx.fillText(dlDays, dlStartX+dlLabelW, nameY+134);

    if (isRescueOnly) {
        ctx.fillStyle='rgba(254,243,199,0.1)'; rr(W/2-280,nameY+152,560,46,23); ctx.fill();
        ctx.fillStyle='#fde68a'; ctx.font='bold 20px sans-serif'; ctx.textAlign='center';
        ctx.fillText('🔒 RESCUE ORGANIZATIONS ONLY', W/2, nameY+183, SAFE_W);
    }

    // ── DIVIDER ──
    const divY = H/2+20;
    const dg = ctx.createLinearGradient(44,0,W-44,0);
    dg.addColorStop(0,'rgba(255,255,255,0)'); dg.addColorStop(0.15,'rgba(255,255,255,0.18)');
    dg.addColorStop(0.85,'rgba(255,255,255,0.18)'); dg.addColorStop(1,'rgba(255,255,255,0)');
    ctx.strokeStyle=dg; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(44,divY); ctx.lineTo(W-44,divY); ctx.stroke();

    // ── BOTTOM: left text + right photo ──
    const photoW = H-divY-28-16; // fixed width, independent of any tag above
    const photoX = W-photoW-36;
    let photoY = divY+14;
    let photoH = photoW; // square by default
    const leftMax = photoX-44-24;

    // Small age-alert tag above the photo — only shown when the space-euth
    // banner already claimed the main top slot. Always red (distinct alert,
    // independent of shelter color), fixed to the photo's width so edges align.
    if (ageTagAbovePhoto) {
        const tagH = 34, tagGap = 10;
        const label = isPuppy ? '🐾 PUPPY ALERT' : '🐾 SENIOR ALERT';
        ctx.fillStyle = 'rgba(196,40,28,0.18)'; rr(photoX, photoY, photoW, tagH, 17); ctx.fill();
        ctx.strokeStyle = 'rgba(255,90,72,0.7)'; ctx.lineWidth = 1.5; rr(photoX, photoY, photoW, tagH, 17); ctx.stroke();
        ctx.fillStyle = '#ff8a80'; ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(label, photoX+photoW/2, photoY+tagH/2+6, photoW-16);
        photoY += tagH + tagGap;
        photoH -= (tagH + tagGap);
    }

    if (dog.photo_url) {
        await new Promise(resolve => {
            const img = new Image(); img.crossOrigin='anonymous';
            img.onload = () => {
                ctx.save(); rr(photoX,photoY,photoW,photoH,20); ctx.clip();
                const cropOffset = parseFloat(dog.photo_crop_offset || 0);
                const scale = Math.max(photoW/img.width, photoH/img.height);
                const dw = img.width * scale, dh = img.height * scale;
                const defaultImgY = photoY+(photoH-dh)/2;
                const maxShift = Math.abs(defaultImgY - photoY);
                const adjustedImgY = defaultImgY - (cropOffset * maxShift);
                ctx.drawImage(img,photoX+(photoW-dw)/2,adjustedImgY,dw,dh);
                ctx.restore();
                rr(photoX,photoY,photoW,photoH,20);
                ctx.strokeStyle=colors.primary; ctx.lineWidth=4; ctx.stroke(); resolve();
            };
            img.onerror = () => {
                rr(photoX,photoY,photoW,photoH,20);
                ctx.fillStyle='rgba(255,255,255,0.04)'; ctx.fill();
                ctx.strokeStyle=colors.primary; ctx.lineWidth=3; ctx.stroke(); resolve();
            };
            img.src = dog.photo_url.startsWith('http') ? dog.photo_url : window.location.origin+dog.photo_url;
        });
    } else {
        rr(photoX,photoY,photoW,photoH,20);
        ctx.fillStyle='rgba(255,255,255,0.04)'; ctx.fill();
        ctx.strokeStyle=colors.primary; ctx.lineWidth=3; ctx.stroke();
    }

    ctx.textAlign='left';
    ctx.fillStyle='#ffffff'; ctx.font='28px sans-serif';
    ctx.fillText(isRescueOnly?'Contact a rescue org to pull.':'Donate · Foster · Share.', 44, divY+30, leftMax);
    ctx.fillStyle='#ffffff'; ctx.font='bold 28px sans-serif';
    ctx.fillText('ladogdispatch.com', 44, divY+86, leftMax);

    // ── IG HANDLE — solid shelter deadline color ──
    ctx.fillStyle = colors.deadline; ctx.font='bold 28px sans-serif';
    (function drawIGIcon(x, y, sz) {
        const r=sz*0.22, ix=x, iy=y-sz*0.85;
        const igGrad=ctx.createLinearGradient(ix,iy,ix+sz,iy+sz);
        igGrad.addColorStop(0,'#f09433'); igGrad.addColorStop(0.5,'#dc2743'); igGrad.addColorStop(1,'#bc1888');
        ctx.save(); ctx.fillStyle=igGrad;
        ctx.beginPath(); ctx.moveTo(ix+r,iy); ctx.lineTo(ix+sz-r,iy); ctx.quadraticCurveTo(ix+sz,iy,ix+sz,iy+r);
        ctx.lineTo(ix+sz,iy+sz-r); ctx.quadraticCurveTo(ix+sz,iy+sz,ix+sz-r,iy+sz);
        ctx.lineTo(ix+r,iy+sz); ctx.quadraticCurveTo(ix,iy+sz,ix,iy+sz-r);
        ctx.lineTo(ix,iy+r); ctx.quadraticCurveTo(ix,iy,ix+r,iy); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='white'; ctx.lineWidth=sz*0.08; ctx.lineJoin='round';
        const cx2=ix+sz/2,cy2=iy+sz/2,pw=sz*0.62,ph=sz*0.5,px=ix+(sz-pw)/2,py=iy+(sz-ph)/2,pr=sz*0.12;
        ctx.beginPath(); ctx.moveTo(px+pr,py); ctx.lineTo(px+pw-pr,py); ctx.quadraticCurveTo(px+pw,py,px+pw,py+pr);
        ctx.lineTo(px+pw,py+ph-pr); ctx.quadraticCurveTo(px+pw,py+ph,px+pw-pr,py+ph);
        ctx.lineTo(px+pr,py+ph); ctx.quadraticCurveTo(px,py+ph,px,py+ph-r);
        ctx.lineTo(px,py+pr); ctx.quadraticCurveTo(px,py,px+pr,py); ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx2,cy2,sz*0.22,0,Math.PI*2); ctx.stroke();
        ctx.fillStyle='white'; ctx.beginPath(); ctx.arc(px+pw-sz*0.13,py+sz*0.12,sz*0.05,0,Math.PI*2); ctx.fill();
        ctx.restore();
    })(44, divY+130, 28);
    ctx.fillText('@la_dog_dispatch', 44+28+8, divY+130, leftMax-36);

    // ── STACKED BLOCK: shelter notes ──
    // (space-euth banner and puppy/senior alerts live near the top/photo now — see above)
    const PAD_L = 44, PAD_R = 20;
    const boxW = leftMax - PAD_R;
    const innerW = boxW - 28;
    const blocks = [];

    if (hasNotes) {
        const disclaimerFull = NOTES_DISCLAIMER;
        const disclaimerShort = "Notes are shelter snapshots & may not reflect real personality.";

        // Space already claimed by the age badge above (if any)
        const otherH = blocks.reduce((s, b) => s + b.height + 12, 0);
        const igHandleBottom = divY + 130 + 10;
        const bottomBarTop = H - 16 - 34; // reserve room for the shelter-ID line
        const remaining = (bottomBarTop - igHandleBottom) - otherH - (blocks.length ? 12 : 0);

        // Try configs from most spacious to most compact until one fits
        const configs = [
            { maxLines: 3, noteFont: 24, discFont: 22, disc: disclaimerFull },
            { maxLines: 2, noteFont: 24, discFont: 22, disc: disclaimerFull },
            { maxLines: 2, noteFont: 22, discFont: 20, disc: disclaimerShort },
            { maxLines: 1, noteFont: 22, discFont: 20, disc: disclaimerShort },
            { maxLines: 1, noteFont: 20, discFont: 18, disc: disclaimerShort },
        ];
        let chosen = null;
        for (const cfg of configs) {
            const noteFontStr = `${cfg.noteFont}px sans-serif`;
            const discFontStr = `italic ${cfg.discFont}px sans-serif`;
            const noteLines = wrapText(dog.notes, noteFontStr, innerW).slice(0, cfg.maxLines);
            const discLines = wrapText(cfg.disc, discFontStr, innerW);
            const lineH = cfg.noteFont + 8, discLineH = cfg.discFont + 8;
            const boxH = 14 + 22 + 10 + noteLines.length * lineH + 12 + discLines.length * discLineH + 14;
            chosen = { ...cfg, noteFontStr, discFontStr, noteLines, discLines, lineH, discLineH, boxH };
            if (boxH <= remaining || cfg === configs[configs.length - 1]) break;
        }

        blocks.push({
            height: chosen.boxH,
            draw: (y) => {
                ctx.fillStyle = 'rgba(251,191,36,0.10)'; rr(PAD_L, y, boxW, chosen.boxH, 8); ctx.fill();
                ctx.strokeStyle = 'rgba(251,191,36,0.4)'; ctx.lineWidth = 1.2; rr(PAD_L, y, boxW, chosen.boxH, 8); ctx.stroke();
                const textX = PAD_L + 14;
                let curY = y + 14;
                ctx.fillStyle = '#fcd34d'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'left';
                curY += 18; ctx.fillText('⚠️  SHELTER NOTES', textX, curY);
                curY += 8;
                ctx.strokeStyle = 'rgba(251,191,36,0.25)'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(textX, curY); ctx.lineTo(PAD_L+boxW-14, curY); ctx.stroke();
                curY += 6;
                ctx.fillStyle = '#ffffff'; ctx.font = chosen.noteFontStr;
                chosen.noteLines.forEach(l => { curY += chosen.lineH; ctx.fillText(l, textX, curY, innerW); });
                curY += 12;
                ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = chosen.discFontStr;
                chosen.discLines.forEach(l => { curY += chosen.discLineH; ctx.fillText(l, textX, curY, innerW); });
            }
        });
    }

    if (blocks.length) {
        const GAP = 12;
        const totalH = blocks.reduce((s,b) => s + b.height, 0) + GAP*(blocks.length-1);
        const igHandleBottom = divY + 130 + 10;
        const bottomBarTop = H - 16 - 34;
        const availableSpace = bottomBarTop - igHandleBottom;
        let by = igHandleBottom + Math.max(0, Math.round((availableSpace - totalH)/2));
        for (const b of blocks) { b.draw(by); by += b.height + GAP; }
    }

    // ── SHELTER ID — small, bottom left corner, pure white ──
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(dog.shelter_id ? ('DOG ID: ' + dog.shelter_id) : '', 44, H - 28);

    // ── BOTTOM BAR — shelter color ──
    const botBar = ctx.createLinearGradient(0,0,W,0);
    botBar.addColorStop(0, colors.dark); botBar.addColorStop(0.5, colors.primary); botBar.addColorStop(1, colors.dark);
    ctx.fillStyle=botBar; ctx.fillRect(0,H-16,W,16);

    return c;
}
