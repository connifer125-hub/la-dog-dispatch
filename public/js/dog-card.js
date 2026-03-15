// ── LA Dog Dispatch — Shared IG Card Generator ────────────────────
// Used by: index.html, social.html, rescue.html
// To update the card design, edit ONLY this file.

const NOTES_DISCLAIMER = "Shelter behavioral notes are snapshots written in stressful environments to dog & staff and may not reflect a dog's full personality. This dog may require behavioral training & needs a patient caregiver.";

// Safe JSON serialization for inline onclick attributes
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

async function generateCard(dog) {
    const c = document.getElementById('card-canvas');
    const ctx = c.getContext('2d');
    const W = 1080, H = 1080;
    c.width = W; c.height = H;
    ctx.clearRect(0, 0, W, H);

    const daysLeft = Math.ceil((new Date(dog.deadline) - new Date()) / 86400000);
    const isCritical = daysLeft <= 1;
    const isRescueOnly = dog.rescue_only === true || dog.rescue_only === "true" || dog.rescue_only === 1;
    const hasNotes = dog.notes && dog.notes.trim().length > 0;

    function rr(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
        ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
        ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
        ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
    }

    function drawBubble(text, centerX, y, fontSize, maxWidth) {
        ctx.save();
        ctx.font = `900 ${fontSize}px 'Arial Black', Arial, sans-serif`;
        ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
        ctx.lineWidth = fontSize*0.22; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(text, centerX, y, maxWidth);
        ctx.lineWidth = fontSize*0.18; ctx.strokeStyle = '#3d7a5c'; ctx.strokeText(text, centerX, y, maxWidth);
        ctx.lineWidth = fontSize*0.10; ctx.strokeStyle = '#5aaa80'; ctx.strokeText(text, centerX, y, maxWidth);
        ctx.lineWidth = fontSize*0.04; ctx.strokeStyle = '#a8e6c3'; ctx.strokeText(text, centerX, y, maxWidth);
        const grad = ctx.createLinearGradient(0, y-fontSize, 0, y);
        grad.addColorStop(0,'#ffffff'); grad.addColorStop(0.35,'#f0fff8'); grad.addColorStop(1,'#7ec8a0');
        ctx.fillStyle = grad; ctx.fillText(text, centerX, y, maxWidth);
        ctx.restore();
    }

    // ── BACKGROUND ──
    ctx.fillStyle = '#141414'; ctx.fillRect(0,0,W,H);
    const vignette = ctx.createRadialGradient(W/2,H/2,W*0.25,W/2,H/2,W*0.75);
    vignette.addColorStop(0,'rgba(0,0,0,0)'); vignette.addColorStop(1,'rgba(0,0,0,0.5)');
    ctx.fillStyle = vignette; ctx.fillRect(0,0,W,H);

    // ── TOP GREEN BAR ──
    const topBar = ctx.createLinearGradient(0,0,W,0);
    topBar.addColorStop(0,'#3d7a5c'); topBar.addColorStop(0.5,'#7ec8a0'); topBar.addColorStop(1,'#3d7a5c');
    ctx.fillStyle = topBar; ctx.fillRect(0,0,W,14);

    // ── TOP ROW ──
    const rowH = 76, rowMid = 14+rowH/2;
    ctx.fillStyle = '#c4281c'; rr(36,rowMid-24,200,48,24); ctx.fill();
    ctx.fillStyle = 'white'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(isCritical ? '🚨 CRITICAL' : '⚠️ URGENT', 136, rowMid+8);
    ctx.fillStyle = '#a8e6c3'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('📍 '+(dog.shelter||'LA COUNTY').toUpperCase(), W/2, rowMid+9, 520);

    const lr=32, lx=W-36-lr, ly=rowMid;
    await new Promise(resolve => {
        const logoImg = new Image();
        logoImg.onload = () => {
            ctx.save(); ctx.beginPath(); ctx.arc(lx,ly,lr,0,Math.PI*2); ctx.clip();
            ctx.drawImage(logoImg, lx-lr, ly-lr, lr*2, lr*2); ctx.restore();
            ctx.beginPath(); ctx.arc(lx,ly,lr,0,Math.PI*2);
            ctx.strokeStyle='#4a8c6a'; ctx.lineWidth=3; ctx.stroke(); resolve();
        };
        logoImg.onerror = () => {
            ctx.beginPath(); ctx.arc(lx,ly,lr,0,Math.PI*2);
            ctx.fillStyle='#1a2e24'; ctx.fill();
            ctx.strokeStyle='#4a8c6a'; ctx.lineWidth=3; ctx.stroke();
            ctx.fillStyle='#7ec8a0'; ctx.font='26px sans-serif'; ctx.textAlign='center';
            ctx.fillText('🐾', lx, ly+9); resolve();
        };
        logoImg.src = '/logo-icon.png';
    });

    ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(44,14+rowH); ctx.lineTo(W-44,14+rowH); ctx.stroke();

    // ── NAME, META, DEADLINE ──
    const SAFE_W = W-80;
    const name = (dog.name||dog.shelter_id||'UNKNOWN').toUpperCase();
    let fontSize = 220;
    ctx.font = `900 ${fontSize}px 'Arial Black', Arial, sans-serif`;
    while(ctx.measureText(name).width > SAFE_W && fontSize > 80){ fontSize-=8; ctx.font=`900 ${fontSize}px 'Arial Black', Arial, sans-serif`; }
    const nameY = 14+rowH+10+fontSize+10;
    drawBubble(name, W/2, nameY, fontSize, SAFE_W);

    ctx.fillStyle='#ffffff'; ctx.font='italic 36px Georgia,serif'; ctx.textAlign='center';
    ctx.fillText([dog.breed,dog.gender,dog.age].filter(Boolean).join('  ·  '), W/2, nameY+62, SAFE_W);

    const dlStr = new Date(dog.deadline).toLocaleDateString('en-US',{month:'long',day:'numeric'});
    const dlLabel = `Deadline: ${dlStr}`;
    const dlDays = `  ·  ${daysLeft<=0?'TODAY':daysLeft===1?'1 DAY LEFT':daysLeft+' DAYS LEFT'}`;
    let dlSize = 46; ctx.font=`bold ${dlSize}px sans-serif`;
    while(ctx.measureText(dlLabel+dlDays).width > SAFE_W && dlSize>26){ dlSize-=2; ctx.font=`bold ${dlSize}px sans-serif`; }
    const dlLabelW = ctx.measureText(dlLabel).width, dlDaysW = ctx.measureText(dlDays).width;
    const dlStartX = W/2-(dlLabelW+dlDaysW)/2;
    ctx.fillStyle='white'; ctx.textAlign='left'; ctx.fillText(dlLabel, dlStartX, nameY+134);
    ctx.fillStyle=isCritical?'#ff5252':'#e05555'; ctx.fillText(dlDays, dlStartX+dlLabelW, nameY+134);

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
    const photoSize = H-divY-28-16;
    const photoX = W-photoSize-36;
    const photoY = divY+14;
    const leftMax = photoX-44-24;

    if (dog.photo_url) {
        await new Promise(resolve => {
            const img = new Image(); img.crossOrigin='anonymous';
            img.onload = () => {
                ctx.save(); rr(photoX,photoY,photoSize,photoSize,20); ctx.clip();
                const scale=Math.max(photoSize/img.width,photoSize/img.height);
                const dw=img.width*scale, dh=img.height*scale;
                ctx.drawImage(img,photoX+(photoSize-dw)/2,photoY+(photoSize-dh)/2,dw,dh);
                ctx.restore();
                rr(photoX,photoY,photoSize,photoSize,20);
                ctx.strokeStyle='#4a8c6a'; ctx.lineWidth=4; ctx.stroke(); resolve();
            };
            img.onerror = () => {
                rr(photoX,photoY,photoSize,photoSize,20);
                ctx.fillStyle='rgba(255,255,255,0.04)'; ctx.fill();
                ctx.strokeStyle='#4a8c6a'; ctx.lineWidth=3; ctx.stroke(); resolve();
            };
            img.src = dog.photo_url.startsWith('http') ? dog.photo_url : window.location.origin+dog.photo_url;
        });
    } else {
        rr(photoX,photoY,photoSize,photoSize,20);
        ctx.fillStyle='rgba(255,255,255,0.04)'; ctx.fill();
        ctx.strokeStyle='#4a8c6a'; ctx.lineWidth=3; ctx.stroke();
    }

    ctx.textAlign='left';
    ctx.fillStyle='#ffffff'; ctx.font='28px sans-serif';
    ctx.fillText(isRescueOnly?'Contact a rescue org to pull.':'Donate · Foster · Share.', 44, divY+68, leftMax);
    ctx.fillStyle='#ffffff'; ctx.font='bold 42px sans-serif';
    ctx.fillText('ladogdispatch.com', 44, divY+130, leftMax);

    // ── IG HANDLE ──
    ctx.fillStyle='#7ec8a0'; ctx.font='bold 28px sans-serif';
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
    })(44, divY+174, 28);
    ctx.fillText('@la_dog_dispatch', 44+28+8, divY+174, leftMax-36);

    // ── SHELTER NOTES (bottom-left, below IG handle, vertically centered in remaining space) ──
    if (hasNotes) {
        const PAD_L = 44, PAD_R = 20;
        const boxW = leftMax - PAD_R;
        const innerW = boxW - 28;

        function wrapNoteLines(text, font, maxW, maxLines) {
            ctx.font = font;
            const words = text.split(' ');
            let line = '', result = [];
            for (const w of words) {
                const test = line + w + ' ';
                if (ctx.measureText(test).width > maxW && line) {
                    result.push(line.trim());
                    if (result.length >= maxLines) return result;
                    line = w + ' ';
                } else { line = test; }
            }
            if (result.length < maxLines) result.push(line.trim());
            return result;
        }

        const noteFont = '19px sans-serif';
        const noteLines = wrapNoteLines(dog.notes, noteFont, innerW, 3);
        const lineH = 24;
        const disclaimerText = "Shelter notes are snapshots written in stressful environments & may not reflect a dog's real personality. Training, love & patience needed.";
        const boxH = 36 + noteLines.length * lineH + 10 + 22 + 8;

        // Vertically center the box between the IG handle baseline and the bottom bar
        const igHandleBottom = divY + 174 + 10; // a bit below the IG handle text
        const bottomBarTop = H - 16;
        const availableSpace = bottomBarTop - igHandleBottom;
        const noteStartY = igHandleBottom + Math.round((availableSpace - boxH) / 2);

        ctx.fillStyle = 'rgba(251,191,36,0.10)';
        rr(PAD_L, noteStartY, boxW, boxH, 8); ctx.fill();
        ctx.strokeStyle = 'rgba(251,191,36,0.4)'; ctx.lineWidth = 1.2;
        rr(PAD_L, noteStartY, boxW, boxH, 8); ctx.stroke();

        const textX = PAD_L + 14;
        ctx.fillStyle = '#fcd34d'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText('⚠️  SHELTER NOTES', textX, noteStartY+22);

        ctx.strokeStyle = 'rgba(251,191,36,0.25)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(textX, noteStartY+30); ctx.lineTo(PAD_L+boxW-14, noteStartY+30); ctx.stroke();

        ctx.fillStyle = '#fef3c7'; ctx.font = noteFont; ctx.textAlign = 'left';
        noteLines.forEach((l, i) => ctx.fillText(l, textX, noteStartY+52+i*lineH, innerW));

        ctx.fillStyle = 'rgba(253,230,138,0.6)'; ctx.font = 'italic 19px sans-serif';
        ctx.fillText(disclaimerText, textX, noteStartY+52+noteLines.length*lineH+10, innerW);
    }

    // ── BOTTOM GREEN BAR ──
    const botBar = ctx.createLinearGradient(0,0,W,0);
    botBar.addColorStop(0,'#3d7a5c'); botBar.addColorStop(0.5,'#7ec8a0'); botBar.addColorStop(1,'#3d7a5c');
    ctx.fillStyle=botBar; ctx.fillRect(0,H-16,W,16);

    return c;
}
