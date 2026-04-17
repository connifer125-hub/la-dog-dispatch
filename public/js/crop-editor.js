// ── LA Dog Dispatch — Card Crop Editor ────────────────────────────
// Access via: https://ladogdispatch.com?edit=true

(function() {
  if (!window.location.search.includes('edit=true')) return;

  const style = document.createElement('style');
  style.textContent = `
    .fix-card-btn {
      position: absolute; top: 8px; right: 8px;
      background: rgba(0,0,0,0.75); color: white;
      border: 1.5px solid rgba(255,255,255,0.4);
      border-radius: 6px; padding: 5px 10px;
      font-size: 0.72rem; font-weight: 700;
      cursor: pointer; z-index: 10;
      font-family: 'Source Sans 3', sans-serif;
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
      padding: 1.5rem; width: 90%; max-width: 520px;
      font-family: 'Source Sans 3', sans-serif; color: white;
    }
    #crop-editor-modal h3 { font-family: 'Playfair Display', serif; font-size: 1.1rem; margin-bottom: 0.3rem; }
    #crop-editor-modal p { color: rgba(255,255,255,0.45); font-size: 0.78rem; margin-bottom: 1rem; }
    #crop-preview-canvas { width: 100%; border-radius: 6px; display: block; margin-bottom: 1rem; }
    .crop-slider-label { font-size: 0.72rem; font-weight: 700; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.4rem; display: flex; justify-content: space-between; }
    #crop-slider { width: 100%; margin-bottom: 1.2rem; accent-color: #4a8c6a; }
    .crop-btn-row { display: flex; gap: 0.6rem; }
    .crop-save-btn { flex: 1; background: #4a8c6a; color: white; border: none; border-radius: 8px; padding: 0.7rem; font-size: 0.9rem; font-weight: 700; cursor: pointer; font-family: inherit; }
    .crop-save-btn:hover { background: #3d7a5c; }
    .crop-cancel-btn { background: transparent; color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; padding: 0.7rem 1.2rem; font-size: 0.9rem; cursor: pointer; font-family: inherit; }
    .crop-reset-btn { background: transparent; color: rgba(255,255,255,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 0.7rem 1rem; font-size: 0.85rem; cursor: pointer; font-family: inherit; }
    .edit-mode-banner { position: fixed; top: 100px; left: 50%; transform: translateX(-50%); background: #4a8c6a; color: white; padding: 0.4rem 1.2rem; border-radius: 20px; font-size: 0.78rem; font-weight: 700; z-index: 1000; font-family: 'Source Sans 3', sans-serif; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
  `;
  document.head.appendChild(style);

  // Banner to confirm edit mode is on
  const banner = document.createElement('div');
  banner.className = 'edit-mode-banner';
  banner.textContent = '✏️ Edit Mode — Fix Card buttons are active';
  document.body.appendChild(banner);
  setTimeout(() => banner.style.opacity = '0.6', 3000);

  // Overlay
  const overlay = document.createElement('div');
  overlay.id = 'crop-editor-overlay';
  overlay.innerHTML = `
    <div id="crop-editor-modal">
      <h3 id="crop-dog-name">Fix Card</h3>
      <p>Drag the slider to reposition the photo. Slide left = show head, slide right = show body.</p>
      <canvas id="crop-preview-canvas" width="500" height="280"></canvas>
      <div class="crop-slider-label"><span>⬆ Head</span><span>Body ⬇</span></div>
      <input type="range" id="crop-slider" min="-1" max="1" step="0.05" value="0">
      <div class="crop-btn-row">
        <button class="crop-save-btn" id="crop-save-btn">Save Fix</button>
        <button class="crop-reset-btn" id="crop-reset-btn">Reset</button>
        <button class="crop-cancel-btn" id="crop-cancel-btn">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  let currentDog = null;
  let cropImg = null;

  function renderPreview(offset) {
    const canvas = document.getElementById('crop-preview-canvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#141414'; ctx.fillRect(0, 0, W, H);
    if (cropImg && cropImg.complete && cropImg.naturalWidth) {
      const scale = Math.max(W / cropImg.naturalWidth, H / cropImg.naturalHeight);
      const dw = cropImg.naturalWidth * scale, dh = cropImg.naturalHeight * scale;
      const defaultY = (H - dh) / 2;
      const maxShift = Math.abs(defaultY);
      const adjustedY = defaultY - (offset * maxShift);
      ctx.drawImage(cropImg, (W - dw) / 2, adjustedY, dw, dh);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(0,0,W,H);
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '14px Arial'; ctx.textAlign = 'center';
      ctx.fillText('Loading photo...', W/2, H/2);
    }
    // Guide line
    ctx.strokeStyle = 'rgba(74,140,106,0.5)'; ctx.lineWidth = 1; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke();
    ctx.setLineDash([]);
  }

  function openCropEditor(dog) {
    currentDog = dog;
    document.getElementById('crop-dog-name').textContent = 'Fix Card: ' + (dog.name || dog.shelter_id);
    const slider = document.getElementById('crop-slider');
    slider.value = dog.photo_crop_offset || 0;
    cropImg = null;
    renderPreview(parseFloat(slider.value));
    if (dog.photo_url) {
      cropImg = new Image(); cropImg.crossOrigin = 'anonymous';
      cropImg.onload = () => renderPreview(parseFloat(slider.value));
      cropImg.src = dog.photo_url;
    }
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeCropEditor() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    currentDog = null; cropImg = null;
  }

  document.getElementById('crop-slider').addEventListener('input', function() {
    renderPreview(parseFloat(this.value));
  });

  document.getElementById('crop-reset-btn').addEventListener('click', function() {
    document.getElementById('crop-slider').value = 0;
    renderPreview(0);
  });

  document.getElementById('crop-cancel-btn').addEventListener('click', closeCropEditor);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeCropEditor(); });

  document.getElementById('crop-save-btn').addEventListener('click', async function() {
    if (!currentDog) return;
    const offset = parseFloat(document.getElementById('crop-slider').value);
    this.textContent = 'Saving...'; this.disabled = true;
    try {
      const res = await fetch('/api/dogs/' + currentDog.id + '/crop', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_crop_offset: offset })
      });
      if (res.ok) {
        currentDog.photo_crop_offset = offset;
        this.textContent = '✓ Saved!'; this.style.background = '#166534';
        setTimeout(() => closeCropEditor(), 800);
      } else { throw new Error(); }
    } catch {
      this.textContent = 'Error'; this.style.background = '#c4281c';
      setTimeout(() => { this.textContent = 'Save Fix'; this.style.background = ''; this.disabled = false; }, 2000);
    }
  });

  // Inject Fix buttons — wait for allDogs to be populated
  function injectButtons() {
    // allDogs is the global array from index.html
    if (typeof allDogs === 'undefined' || !allDogs || !allDogs.length) {
      setTimeout(injectButtons, 600);
      return;
    }
    const cards = document.querySelectorAll('.dog-card');
    if (!cards.length) {
      setTimeout(injectButtons, 600);
      return;
    }
    cards.forEach(card => {
      if (card.querySelector('.fix-card-btn')) return;
      // Find dog by matching name in card text
      const nameEl = card.querySelector('h2, .dog-name, [class*="name"]');
      const cardText = card.textContent;
      const dog = allDogs.find(d => cardText.includes(d.name || d.shelter_id));
      if (!dog) return;
      card.style.position = 'relative';
      const btn = document.createElement('button');
      btn.className = 'fix-card-btn';
      btn.textContent = '✏️ Fix Card';
      btn.addEventListener('click', e => { e.stopPropagation(); openCropEditor(dog); });
      card.appendChild(btn);
    });
    console.log('✏️ Fix Card buttons injected for', cards.length, 'dogs');
  }

  // Watch for grid changes
  const observer = new MutationObserver(injectButtons);
  document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('dogs-grid');
    if (grid) observer.observe(grid, { childList: true, subtree: true });
    setTimeout(injectButtons, 1000);
  });
  // Also try after a delay in case DOM is already ready
  setTimeout(injectButtons, 1500);
  setTimeout(injectButtons, 3000);

})();
