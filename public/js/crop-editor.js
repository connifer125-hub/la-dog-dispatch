// ── LA Dog Dispatch — Card Crop Editor ────────────────────────────
// Adds a "Fix Card" button to each dog card when ?edit=true is in URL
// Saves crop offset to DB so generateCard uses it automatically

(function() {
  if (!window.location.search.includes('edit=true')) return;

  // ── STYLES ──
  const style = document.createElement('style');
  style.textContent = `
    .fix-card-btn {
      position: absolute; bottom: 8px; left: 8px;
      background: rgba(0,0,0,0.75); color: white;
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 6px; padding: 4px 10px;
      font-size: 0.72rem; font-weight: 700;
      cursor: pointer; z-index: 10;
      font-family: 'Source Sans 3', sans-serif;
      transition: background 0.2s;
    }
    .fix-card-btn:hover { background: #4a8c6a; border-color: #4a8c6a; }

    #crop-editor-overlay {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.88); z-index: 9999;
      align-items: center; justify-content: center;
    }
    #crop-editor-overlay.open { display: flex; }
    #crop-editor-modal {
      background: #1a1614; border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.12);
      padding: 1.5rem; width: 90%; max-width: 560px;
      font-family: 'Source Sans 3', sans-serif;
    }
    #crop-editor-modal h3 {
      font-family: 'Playfair Display', serif;
      color: white; font-size: 1.1rem; margin-bottom: 0.3rem;
    }
    #crop-editor-modal p {
      color: rgba(255,255,255,0.45); font-size: 0.78rem; margin-bottom: 1rem;
    }
    #crop-preview-canvas {
      width: 100%; border-radius: 6px; display: block; margin-bottom: 1rem;
    }
    .crop-slider-label {
      font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.5);
      text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.4rem;
      display: flex; justify-content: space-between;
    }
    #crop-slider {
      width: 100%; margin-bottom: 1.2rem; accent-color: #4a8c6a;
    }
    .crop-btn-row { display: flex; gap: 0.6rem; }
    .crop-save-btn {
      flex: 1; background: #4a8c6a; color: white; border: none;
      border-radius: 8px; padding: 0.7rem; font-size: 0.9rem;
      font-weight: 700; cursor: pointer; font-family: inherit;
      transition: background 0.2s;
    }
    .crop-save-btn:hover { background: #3d7a5c; }
    .crop-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .crop-cancel-btn {
      background: transparent; color: rgba(255,255,255,0.5);
      border: 1px solid rgba(255,255,255,0.2); border-radius: 8px;
      padding: 0.7rem 1.2rem; font-size: 0.9rem; cursor: pointer;
      font-family: inherit;
    }
    .crop-reset-btn {
      background: transparent; color: rgba(255,255,255,0.4);
      border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
      padding: 0.7rem 1rem; font-size: 0.85rem; cursor: pointer;
      font-family: inherit;
    }
  `;
  document.head.appendChild(style);

  // ── OVERLAY HTML ──
  const overlay = document.createElement('div');
  overlay.id = 'crop-editor-overlay';
  overlay.innerHTML = `
    <div id="crop-editor-modal">
      <h3 id="crop-dog-name">Fix Card</h3>
      <p>Drag the slider to reposition the photo crop. Top = show head, Bottom = show body.</p>
      <canvas id="crop-preview-canvas" width="540" height="300"></canvas>
      <div class="crop-slider-label">
        <span>⬆ Show Head</span>
        <span>Show Body ⬇</span>
      </div>
      <input type="range" id="crop-slider" min="-1" max="1" step="0.05" value="0">
      <div class="crop-btn-row">
        <button class="crop-save-btn" id="crop-save-btn">Save Fix</button>
        <button class="crop-reset-btn" id="crop-reset-btn">Reset Center</button>
        <button class="crop-cancel-btn" id="crop-cancel-btn">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  let currentDog = null;
  let cropImg = null;

  // ── PREVIEW RENDERER ──
  function renderCropPreview(offset) {
    const canvas = document.getElementById('crop-preview-canvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#141414'; ctx.fillRect(0, 0, W, H);

    if (!cropImg || !cropImg.complete || !cropImg.naturalWidth) {
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '16px Arial'; ctx.textAlign = 'center';
      ctx.fillText('No photo available', W/2, H/2);
      return;
    }

    const scale = Math.max(W / cropImg.naturalWidth, H / cropImg.naturalHeight);
    const dw = cropImg.naturalWidth * scale;
    const dh = cropImg.naturalHeight * scale;

    // offset: -1 = top, 0 = center, 1 = bottom
    const defaultY = (H - dh) / 2;
    const maxShift = Math.abs(defaultY);
    const adjustedY = defaultY - (offset * maxShift);

    ctx.drawImage(cropImg, (W - dw) / 2, adjustedY, dw, dh);

    // Overlay guide lines
    ctx.strokeStyle = 'rgba(74,140,106,0.5)';
    ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke();
    ctx.setLineDash([]);

    // Label
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, H - 28, W, 28);
    ctx.fillStyle = '#4a8c6a'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
    const label = offset < -0.1 ? 'Cropped to top' : offset > 0.1 ? 'Cropped to bottom' : 'Center crop (default)';
    ctx.fillText(label, W/2, H - 10);
  }

  // ── OPEN EDITOR ──
  function openCropEditor(dog) {
    currentDog = dog;
    document.getElementById('crop-dog-name').textContent = `Fix Card: ${dog.name || dog.shelter_id}`;
    const slider = document.getElementById('crop-slider');
    slider.value = dog.photo_crop_offset || 0;

    cropImg = new Image();
    cropImg.crossOrigin = 'anonymous';
    cropImg.onload = () => renderCropPreview(parseFloat(slider.value));
    cropImg.onerror = () => renderCropPreview(parseFloat(slider.value));
    cropImg.src = dog.photo_url || '';
    renderCropPreview(parseFloat(slider.value));

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeCropEditor() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    currentDog = null; cropImg = null;
  }

  // ── SLIDER ──
  document.getElementById('crop-slider').addEventListener('input', function() {
    renderCropPreview(parseFloat(this.value));
  });

  // ── SAVE ──
  document.getElementById('crop-save-btn').addEventListener('click', async function() {
    if (!currentDog) return;
    const offset = parseFloat(document.getElementById('crop-slider').value);
    this.textContent = 'Saving...'; this.disabled = true;
    try {
      const res = await fetch(`/api/dogs/${currentDog.id}/crop`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_crop_offset: offset })
      });
      if (res.ok) {
        // Update local dog data so card regenerates immediately
        currentDog.photo_crop_offset = offset;
        this.textContent = '✓ Saved!'; this.style.background = '#166534';
        setTimeout(() => closeCropEditor(), 800);
      } else { throw new Error(); }
    } catch {
      this.textContent = 'Error — try again';
      this.disabled = false; this.style.background = '#c4281c';
      setTimeout(() => { this.textContent = 'Save Fix'; this.style.background = ''; this.disabled = false; }, 2000);
    }
  });

  // ── RESET ──
  document.getElementById('crop-reset-btn').addEventListener('click', function() {
    document.getElementById('crop-slider').value = 0;
    renderCropPreview(0);
  });

  // ── CANCEL ──
  document.getElementById('crop-cancel-btn').addEventListener('click', closeCropEditor);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeCropEditor(); });

  // ── INJECT FIX BUTTON INTO EACH DOG CARD ──
  // Wait for dogs to load then inject buttons
  function injectFixButtons() {
    // allDogs is defined in index.html
    if (typeof allDogs === 'undefined' || !allDogs.length) {
      setTimeout(injectFixButtons, 800);
      return;
    }
    document.querySelectorAll('.dog-card').forEach(card => {
      if (card.querySelector('.fix-card-btn')) return; // already injected
      // Get dog data from the card's onclick attribute
      const shareBtn = card.querySelector('[onclick*="openShareModal"]');
      if (!shareBtn) return;
      const match = shareBtn.getAttribute('onclick').match(/openShareModal\((\{.+?\})\)/);
      if (!match) return;
      try {
        const dogData = JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
        // Find full dog object with id
        const fullDog = allDogs.find(d => d.shelter_id === dogData.shelter_id) || dogData;
        const btn = document.createElement('button');
        btn.className = 'fix-card-btn';
        btn.textContent = '✏️ Fix Card';
        btn.onclick = (e) => { e.stopPropagation(); openCropEditor(fullDog); };
        card.style.position = 'relative';
        card.appendChild(btn);
      } catch(e) {}
    });
  }

  // Watch for dogs grid to populate
  const observer = new MutationObserver(() => injectFixButtons());
  const grid = document.getElementById('dogs-grid');
  if (grid) observer.observe(grid, { childList: true });
  setTimeout(injectFixButtons, 1500);

  // Expose openCropEditor globally
  window.openCropEditor = openCropEditor;
})();
