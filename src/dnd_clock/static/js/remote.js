const socket = io();

let timers = {};
let selectedTimerId = localStorage.getItem("dnd_player_timer_id") ? Number(localStorage.getItem("dnd_player_timer_id")) : null;
let currentRemoteView = "cooldown";
let locked = false;
let allSpells = [];
let currentViewingSpell = null;

let prevTimers = {};
let selectedTimerSound = "synthetic";

// Audio Controller for reliable playback
const AudioController = {
    timerAudio: null,
    audioCtx: null,
    unlocked: false,

    init() {
        if (this.unlocked) return;
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        this.unlocked = true;
    },

    setTimerSound(sound) {
        if (sound === "synthetic") {
            this.timerAudio = null;
        } else {
            this.timerAudio = new Audio(`/static/sounds/${sound}`);
            this.timerAudio.load();
        }
    },

    play(type) {
        if (type === 'timer' && navigator.vibrate) {
            navigator.vibrate(200);
        }
        this.init();

        if (type === 'timer') {
            if (this.timerAudio) {
                this.timerAudio.currentTime = 0;
                this.timerAudio.play().catch(e => console.warn("Audio play failed:", e));
            } else {
                this.playSyntheticTimer();
            }
        }
    },

    playSyntheticTimer() {
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.frequency.setValueAtTime(660, this.audioCtx.currentTime); 
        osc.frequency.exponentialRampToValueAtTime(523.25, this.audioCtx.currentTime + 0.1); 
        gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.8);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.8);
    }
};

window.addEventListener('click', () => AudioController.init(), { once: false });

function formatTime(s) {
    let m = Math.floor(s / 60);
    let sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

// Socket Listeners
socket.on("update", (data) => {
    // Check if selected player's cooldown hit zero
    if (selectedTimerId !== null && data[selectedTimerId] && prevTimers[selectedTimerId]) {
        const t = data[selectedTimerId];
        const pt = prevTimers[selectedTimerId];
        if (t.remaining <= 0 && pt.remaining > 0) {
            AudioController.play('timer');
        }
    }
    timers = data;
    prevTimers = JSON.parse(JSON.stringify(data));
    renderPlayerDropdown();
    renderActiveCooldownView();
    renderResourcesView();
});

socket.on("control_update", (data) => {
    locked = Boolean(data.locked);
    
    if (data.theme) {
        document.body.className = `theme-${data.theme} page-remote`;
    }
    
    if (data.custom_bg_url !== undefined) {
        applyCustomBg(data.custom_bg_url);
    }

    if (data.timer_done_sound) {
        selectedTimerSound = data.timer_done_sound;
        AudioController.setTimerSound(data.timer_done_sound);
    }

    document.body.style.opacity = locked ? 0.7 : 1;
    renderActiveCooldownView();
});

function applyCustomBg(url) {
    if (url && url.trim() !== "") {
        document.body.style.backgroundImage = `url('${url}')`;
        document.body.style.backgroundSize = "cover";
        document.body.style.backgroundPosition = "center";
        document.body.style.backgroundAttachment = "fixed";
    } else {
        document.body.style.backgroundImage = "";
    }
}

// Switch Bottom Tabs
function switchRemoteView(view) {
    currentRemoteView = view;
    document.querySelectorAll('.remote-nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.remote-view').forEach(v => v.style.display = 'none');

    const activeBtn = document.getElementById(`nav-btn-${view}`);
    if (activeBtn) activeBtn.classList.add('active');

    const targetView = document.getElementById(`view-${view}`);
    if (targetView) targetView.style.display = 'block';

    if (view === 'spellbook') {
        loadSpellbook();
    } else if (view === 'resources') {
        renderResourcesView();
    } else {
        renderActiveCooldownView();
    }
}

// 1. Dropdown & Selection
function renderPlayerDropdown() {
    const select = document.getElementById("player-selector");
    if (!select) return;

    const playerIds = Object.keys(timers)
        .map(Number)
        .sort((a, b) => a - b)
        .filter(id => !timers[id].is_enemy && timers[id].show_on_remote !== false);

    const currentVal = select.value;
    select.innerHTML = `<option value="">-- Choose Your Character --</option>` + playerIds.map(id => {
        const t = timers[id];
        const label = t.character_name ? `${t.name} (${t.character_name})` : t.name;
        return `<option value="${id}">${label}</option>`;
    }).join("");

    if (selectedTimerId && playerIds.includes(selectedTimerId)) {
        select.value = String(selectedTimerId);
    } else if (playerIds.length === 1 && !selectedTimerId) {
        selectedTimerId = playerIds[0];
        localStorage.setItem("dnd_player_timer_id", selectedTimerId);
        select.value = String(selectedTimerId);
    } else if (currentVal) {
        select.value = currentVal;
    }
}

function onPlayerSelected(val) {
    if (!val) {
        selectedTimerId = null;
        localStorage.removeItem("dnd_player_timer_id");
    } else {
        selectedTimerId = Number(val);
        localStorage.setItem("dnd_player_timer_id", selectedTimerId);
    }
    renderActiveCooldownView();
    renderResourcesView();
}

// 2. Cooldown View Rendering
function renderActiveCooldownView() {
    const activePanel = document.getElementById("cooldown-active-panel");
    const noPlayerMsg = document.getElementById("no-player-selected-msg");

    if (!selectedTimerId || !timers[selectedTimerId]) {
        if (activePanel) activePanel.style.display = "none";
        if (noPlayerMsg) noPlayerMsg.style.display = "block";
        return;
    }

    if (activePanel) activePanel.style.display = "block";
    if (noPlayerMsg) noPlayerMsg.style.display = "none";

    const t = timers[selectedTimerId];
    const card = document.getElementById("hero-cooldown-card");
    const nameEl = document.getElementById("player-hero-name");
    const charEl = document.getElementById("player-hero-char");
    const timeEl = document.getElementById("player-hero-time");
    const statusEl = document.getElementById("player-hero-status");
    const hpText = document.getElementById("hero-hp-text");
    const hpBar = document.getElementById("hero-hp-bar");
    const condBadge = document.getElementById("hero-condition-badge");
    const resetBtn = document.getElementById("btn-reset-action");
    const toggleBtn = document.getElementById("btn-toggle-timer");
    const handBtn = document.getElementById("btn-raise-hand");
    const heroPortrait = document.getElementById("player-hero-portrait");

    const accentColor = t.accent_color || "#d4af37";
    if (card) {
        card.style.border = `4px solid ${accentColor}`;
        card.style.boxShadow = `0 10px 30px rgba(0,0,0,0.8), 0 0 15px ${accentColor}40`;
    }

    if (nameEl) nameEl.textContent = t.name;
    if (charEl) charEl.textContent = t.character_name || "";

    if (heroPortrait) {
        if (t.portrait_url) {
            heroPortrait.src = t.portrait_url;
            heroPortrait.style.display = "block";
            heroPortrait.style.borderColor = accentColor;
        } else {
            heroPortrait.style.display = "none";
        }
    }

    const timeStr = formatTime(t.remaining);
    if (timeEl) {
        timeEl.textContent = timeStr;
        if (t.remaining <= 0) {
            timeEl.style.color = "#2ecc71";
        } else if (t.running) {
            timeEl.style.color = "#ffffff";
        } else {
            timeEl.style.color = "#f39c12";
        }
    }

    if (statusEl) {
        const isReady = t.remaining <= 0;
        statusEl.textContent = isReady ? "READY TO ACT" : (t.running ? "COOLING DOWN" : "PAUSED");
        statusEl.style.color = isReady ? "#2ecc71" : (t.running ? "#3498db" : "#f39c12");
    }

    // HP Bar
    const curHp = t.current_hp !== undefined ? t.current_hp : 30;
    const maxHp = t.max_hp !== undefined ? t.max_hp : 30;
    const hpPct = Math.max(0, Math.min(100, (curHp / Math.max(1, maxHp)) * 100));
    if (hpText) hpText.textContent = `HP: ${curHp}/${maxHp}`;
    if (hpBar) {
        hpBar.style.width = `${hpPct}%`;
        hpBar.style.background = hpPct <= 25 ? "#e74c3c" : (hpPct <= 50 ? "#f39c12" : "#2ecc71");
    }

    // Condition
    if (condBadge) {
        if (t.condition) {
            condBadge.style.display = "block";
            condBadge.textContent = `⚠️ Condition: ${t.condition}`;
        } else {
            condBadge.style.display = "none";
        }
    }

    // Hand raise
    if (handBtn) {
        handBtn.textContent = t.raised_hand ? "✋ Lower Hand" : "✋ Raise Hand";
        handBtn.style.background = t.raised_hand ? "rgba(212, 175, 55, 0.5)" : "rgba(218, 165, 32, 0.15)";
        handBtn.style.opacity = locked ? "0.5" : "1";
        handBtn.style.cursor = locked ? "not-allowed" : "pointer";
    }

    // Toggle button
    if (toggleBtn) {
        toggleBtn.textContent = t.running ? "⏸ Pause" : "▶ Start";
        toggleBtn.style.opacity = locked ? "0.5" : "1";
        toggleBtn.style.cursor = locked ? "not-allowed" : "pointer";
    }

    // Action button
    if (resetBtn) {
        if (locked) {
            resetBtn.textContent = "🔒 Actions Locked by DM";
            resetBtn.style.opacity = "0.5";
            resetBtn.style.cursor = "not-allowed";
        } else {
            resetBtn.textContent = "⚡ Action Taken (Reset Cooldown)";
            resetBtn.style.opacity = "1";
            resetBtn.style.cursor = "pointer";
        }
    }
}

// 3. Player Actions
function playerResetAction() {
    if (!selectedTimerId || locked) return;
    socket.emit("reset", {timer: selectedTimerId, start: true});
    AudioController.init();
}

function playerToggleTimer() {
    if (!selectedTimerId || locked) return;
    socket.emit("toggle", {timer: selectedTimerId});
}

function playerToggleHand() {
    if (!selectedTimerId || locked) return;
    socket.emit("toggle_hand", {timer: selectedTimerId});
}

// 4. Resources View (HP & Spell Slots)
function renderResourcesView() {
    if (!selectedTimerId || !timers[selectedTimerId]) return;
    const t = timers[selectedTimerId];

    // HP
    const curHp = t.current_hp !== undefined ? t.current_hp : 30;
    const maxHp = t.max_hp !== undefined ? t.max_hp : 30;
    const hpPct = Math.max(0, Math.min(100, (curHp / Math.max(1, maxHp)) * 100));

    const hpLabel = document.getElementById("resource-hp-label");
    const hpBar = document.getElementById("resource-hp-bar");
    if (hpLabel) hpLabel.textContent = `${curHp} / ${maxHp} HP`;
    if (hpBar) {
        hpBar.style.width = `${hpPct}%`;
        hpBar.style.background = hpPct <= 25 ? "#e74c3c" : (hpPct <= 50 ? "#f39c12" : "#2ecc71");
    }

    // Spell Slots
    const slotsContainer = document.getElementById("spell-slots-container");
    if (!slotsContainer) return;

    const slots = t.spell_slots || {
        "1": {"current": 4, "max": 4},
        "2": {"current": 3, "max": 3},
        "3": {"current": 2, "max": 2}
    };

    const levels = Object.keys(slots).sort((a, b) => Number(a) - Number(b));
    if (levels.length === 0) {
        slotsContainer.innerHTML = `<div style="color:#888; font-size:14px; text-align:center;">No spell slots configured.</div>`;
        return;
    }

    slotsContainer.innerHTML = levels.map(lvl => {
        const info = slots[lvl];
        const cur = info.current !== undefined ? info.current : 0;
        const max = info.max !== undefined ? info.max : 0;
        const levelLabel = lvl === "0" ? "Cantrips" : (lvl === "1" ? "1st Level" : (lvl === "2" ? "2nd Level" : (lvl === "3" ? "3rd Level" : `${lvl}th Level`)));

        let bubbles = "";
        for (let i = 1; i <= max; i++) {
            const isFilled = i <= cur;
            bubbles += `<span class="slot-bubble ${isFilled ? 'filled' : 'spent'}" onclick="toggleSingleSlot('${lvl}', ${i})">${isFilled ? '●' : '○'}</span>`;
        }

        return `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:8px;">
                <div style="font-weight:bold; font-size:14px; color:#d4af37;">${levelLabel} <span style="font-size:12px; opacity:0.8;">(${cur}/${max})</span></div>
                <div style="display:flex; align-items:center;">
                    ${bubbles}
                </div>
            </div>
        `;
    }).join("");

    // Character Customization Preview & Color
    const portraitPreview = document.getElementById("resource-portrait-preview");
    const portraitStatus = document.getElementById("player-portrait-status");
    const removePortraitBtn = document.getElementById("btn-remove-portrait");
    const colorPicker = document.getElementById("player-accent-color-picker");

    const accentColor = t.accent_color || "#d4af37";
    if (portraitPreview) {
        if (t.portrait_url) {
            portraitPreview.src = t.portrait_url;
            portraitPreview.style.display = "block";
            portraitPreview.style.borderColor = accentColor;
        } else {
            portraitPreview.style.display = "none";
        }
    }
    if (portraitStatus) {
        portraitStatus.textContent = t.portrait_url ? "✓ Custom portrait active" : "No custom portrait attached";
        portraitStatus.style.color = t.portrait_url ? "#2ecc71" : "#888";
    }
    if (removePortraitBtn) {
        removePortraitBtn.style.display = t.portrait_url ? "block" : "none";
    }
    if (colorPicker && document.activeElement !== colorPicker) {
        colorPicker.value = accentColor;
    }
}

// --- Square Portrait Cropper Modal ---
let cropperState = {
    img: null,
    callback: null,
    zoom: 1,
    rotation: 0,
    posX: 0,
    posY: 0,
    minScale: 1,
    isDragging: false,
    startX: 0,
    startY: 0
};

function ensureCropperModalHTML() {
    if (document.getElementById("portrait-cropper-modal")) return;

    const modal = document.createElement("div");
    modal.id = "portrait-cropper-modal";
    modal.style.cssText = `
        display: none;
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.88);
        z-index: 999999;
        justify-content: center; align-items: center;
        padding: 15px; box-sizing: border-box;
    `;
    modal.innerHTML = `
        <div style="background:#241f1a; border:2px solid #d4af37; border-radius:12px; padding:20px; max-width:360px; width:100%; text-align:center; box-sizing:border-box; box-shadow:0 10px 40px rgba(0,0,0,0.9);">
            <h3 style="margin:0 0 6px 0; font-family:'Cinzel', serif; color:#d4af37; font-size:20px;">✂️ Crop Profile Picture</h3>
            <div style="margin:0 0 12px 0; font-size:12px; color:#aaa;">Drag image to position, zoom with slider</div>

            <!-- Square Frame with Circular Preview Guide -->
            <div id="cropper-viewport" style="width:240px; height:240px; margin:0 auto 15px; position:relative; overflow:hidden; border:3px solid #d4af37; border-radius:50%; background:#111; cursor:grab; user-select:none; touch-action:none; box-shadow:0 4px 15px rgba(0,0,0,0.8);">
                <img id="cropper-preview-img" src="" alt="Crop" style="position:absolute; top:0; left:0; transform-origin:center center; pointer-events:none; max-width:none; max-height:none;">
            </div>

            <!-- Controls -->
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:18px; background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:8px;">
                <span style="font-size:14px;">🔍</span>
                <input type="range" id="cropper-zoom-range" min="1" max="3" step="0.01" value="1" style="flex:1; cursor:pointer;">
                <button type="button" id="cropper-rotate-btn" style="background:#333; border:1px solid #555; color:white; border-radius:5px; padding:5px 10px; font-size:13px; cursor:pointer;" title="Rotate 90°">🔄</button>
            </div>

            <!-- Action Buttons -->
            <div style="display:flex; gap:10px;">
                <button type="button" onclick="closePortraitCropper()" style="flex:1; background:#555; border:none; padding:10px; border-radius:6px; color:white; font-weight:bold; cursor:pointer;">Cancel</button>
                <button type="button" onclick="applyPortraitCrop()" style="flex:1; background:#1e7f3f; border:none; padding:10px; border-radius:6px; color:white; font-weight:bold; cursor:pointer;">Crop & Apply</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const vp = document.getElementById("cropper-viewport");
    const zoomInput = document.getElementById("cropper-zoom-range");
    const rotateBtn = document.getElementById("cropper-rotate-btn");

    vp.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        cropperState.isDragging = true;
        cropperState.startX = e.clientX - cropperState.posX;
        cropperState.startY = e.clientY - cropperState.posY;
        vp.style.cursor = "grabbing";
        if (vp.setPointerCapture) vp.setPointerCapture(e.pointerId);
    });

    vp.addEventListener("pointermove", (e) => {
        if (!cropperState.isDragging) return;
        let newX = e.clientX - cropperState.startX;
        let newY = e.clientY - cropperState.startY;
        updateCropperPos(newX, newY);
    });

    const stopDrag = () => {
        cropperState.isDragging = false;
        vp.style.cursor = "grab";
    };
    vp.addEventListener("pointerup", stopDrag);
    vp.addEventListener("pointercancel", stopDrag);

    zoomInput.addEventListener("input", (e) => {
        cropperState.zoom = parseFloat(e.target.value);
        updateCropperPos(cropperState.posX, cropperState.posY);
    });

    rotateBtn.addEventListener("click", () => {
        cropperState.rotation = (cropperState.rotation + 90) % 360;
        recalcCropperLimits();
    });
}

function openPortraitCropper(file, callback) {
    ensureCropperModalHTML();
    cropperState.callback = callback;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            cropperState.img = img;
            cropperState.zoom = 1;
            cropperState.rotation = 0;

            const previewImg = document.getElementById("cropper-preview-img");
            previewImg.src = e.target.result;

            const zoomInput = document.getElementById("cropper-zoom-range");
            if (zoomInput) zoomInput.value = 1;

            recalcCropperLimits();

            const modal = document.getElementById("portrait-cropper-modal");
            if (modal) modal.style.display = "flex";
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function closePortraitCropper() {
    const modal = document.getElementById("portrait-cropper-modal");
    if (modal) modal.style.display = "none";
    cropperState.img = null;
    cropperState.callback = null;
}

function recalcCropperLimits() {
    if (!cropperState.img) return;
    const isRot = (cropperState.rotation % 180 !== 0);
    const effW = isRot ? cropperState.img.naturalHeight : cropperState.img.naturalWidth;
    const effH = isRot ? cropperState.img.naturalWidth : cropperState.img.naturalHeight;

    cropperState.minScale = Math.max(240 / effW, 240 / effH);

    const renderW = cropperState.img.naturalWidth * cropperState.minScale;
    const renderH = cropperState.img.naturalHeight * cropperState.minScale;
    const initX = (240 - renderW) / 2;
    const initY = (240 - renderH) / 2;

    updateCropperPos(initX, initY);
}

function updateCropperPos(x, y) {
    if (!cropperState.img) return;
    const scale = cropperState.minScale * cropperState.zoom;
    const renderW = cropperState.img.naturalWidth * scale;
    const renderH = cropperState.img.naturalHeight * scale;

    const isRot = (cropperState.rotation % 180 !== 0);
    const boundW = isRot ? renderH : renderW;
    const boundH = isRot ? renderW : renderH;

    const minX = 240 - boundW;
    const maxX = 0;
    const minY = 240 - boundH;
    const maxY = 0;

    cropperState.posX = Math.min(maxX, Math.max(minX, x));
    cropperState.posY = Math.min(maxY, Math.max(minY, y));

    const previewImg = document.getElementById("cropper-preview-img");
    if (previewImg) {
        previewImg.style.width = `${renderW}px`;
        previewImg.style.height = `${renderH}px`;

        const centerX = cropperState.posX + boundW / 2;
        const centerY = cropperState.posY + boundH / 2;
        const transX = centerX - renderW / 2;
        const transY = centerY - renderH / 2;

        previewImg.style.transform = `translate(${transX}px, ${transY}px) rotate(${cropperState.rotation}deg)`;
    }
}

function applyPortraitCrop() {
    if (!cropperState.img || !cropperState.callback) return;

    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext("2d");

    const scale = cropperState.minScale * cropperState.zoom;
    const renderW = cropperState.img.naturalWidth * scale;
    const renderH = cropperState.img.naturalHeight * scale;

    const isRot = (cropperState.rotation % 180 !== 0);
    const boundW = isRot ? renderH : renderW;
    const boundH = isRot ? renderW : renderH;

    const outRatio = 300 / 240;
    const centerX = (cropperState.posX + boundW / 2) * outRatio;
    const centerY = (cropperState.posY + boundH / 2) * outRatio;

    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, 300, 300);

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((cropperState.rotation * Math.PI) / 180);
    ctx.drawImage(cropperState.img, (-renderW * outRatio) / 2, (-renderH * outRatio) / 2, renderW * outRatio, renderH * outRatio);
    ctx.restore();

    canvas.toBlob((blob) => {
        if (!blob) return;
        const croppedFile = new File([blob], "cropped_portrait.png", { type: "image/png" });
        const cb = cropperState.callback;
        closePortraitCropper();
        if (cb) cb(croppedFile);
    }, "image/png");
}

async function handlePlayerPortraitUpload(input) {
    if (!selectedTimerId || !input.files || !input.files[0]) return;
    const file = input.files[0];

    openPortraitCropper(file, async (croppedFile) => {
        const formData = new FormData();
        formData.append("player_id", `player_${selectedTimerId}`);
        formData.append("file", croppedFile);

        const statusEl = document.getElementById("player-portrait-status");
        if (statusEl) {
            statusEl.textContent = "Uploading portrait...";
            statusEl.style.color = "#d4af37";
        }

        try {
            const res = await fetch("/api/campaign/upload_portrait", {
                method: "POST",
                body: formData
            });
            const result = await res.json();
            if (res.ok && result.portrait_url) {
                if (timers[selectedTimerId]) {
                    timers[selectedTimerId].portrait_url = result.portrait_url;
                }
                socket.emit("set_timer_meta", {
                    timer: selectedTimerId,
                    portrait_url: result.portrait_url
                });
                renderActiveCooldownView();
                renderResourcesView();
            } else {
                throw new Error(result.error || "Upload failed");
            }
        } catch (err) {
            if (statusEl) {
                statusEl.textContent = "Upload error: " + err.message;
                statusEl.style.color = "#e74c3c";
            }
        }
    });
    input.value = "";
}

function removePlayerPortrait() {
    if (!selectedTimerId) return;
    if (timers[selectedTimerId]) {
        timers[selectedTimerId].portrait_url = "";
    }
    socket.emit("set_timer_meta", {
        timer: selectedTimerId,
        portrait_url: ""
    });
    renderActiveCooldownView();
    renderResourcesView();
}

function onPlayerAccentColorChange(color) {
    if (!selectedTimerId || !color) return;
    if (timers[selectedTimerId]) {
        timers[selectedTimerId].accent_color = color;
    }
    const colorPicker = document.getElementById("player-accent-color-picker");
    if (colorPicker) colorPicker.value = color;

    socket.emit("set_timer_meta", {
        timer: selectedTimerId,
        accent_color: color
    });
    renderActiveCooldownView();
    renderResourcesView();
}

function changePlayerHp(delta) {
    if (!selectedTimerId || !timers[selectedTimerId] || locked) return;
    const t = timers[selectedTimerId];
    const curHp = t.current_hp !== undefined ? t.current_hp : 30;
    const maxHp = t.max_hp !== undefined ? t.max_hp : 30;
    const newHp = Math.max(0, Math.min(maxHp, curHp + delta));
    socket.emit("set_hp", {timer: selectedTimerId, current_hp: newHp, max_hp: maxHp});
}

function toggleSingleSlot(level, index) {
    if (!selectedTimerId || !timers[selectedTimerId] || locked) return;
    const t = timers[selectedTimerId];
    const slots = t.spell_slots || {};
    const info = slots[level] || {current: 4, max: 4};
    const cur = info.current !== undefined ? info.current : 4;
    
    // If tapping an active bubble, expend it; if tapping spent bubble, restore it
    const newCurrent = (index <= cur) ? (index - 1) : index;
    socket.emit("set_spell_slot", {
        timer: selectedTimerId,
        level: level,
        current: Math.max(0, Math.min(info.max || 4, newCurrent))
    });
}

function restoreAllPlayerSlots() {
    if (!selectedTimerId || locked) return;
    socket.emit("restore_all_slots", {timer: selectedTimerId});
}

function isAssignedToCurrentPlayer(assignedTo, playerName, charName) {
    if (!assignedTo) return true;
    let list = [];
    if (Array.isArray(assignedTo)) {
        list = assignedTo;
    } else if (typeof assignedTo === 'string') {
        const trimmed = assignedTo.trim();
        if (!trimmed || trimmed.toLowerCase() === 'all' || trimmed.toLowerCase() === 'all players') return true;
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
                const arr = JSON.parse(trimmed);
                list = Array.isArray(arr) ? arr : [trimmed];
            } catch(e) {
                list = trimmed.split(',');
            }
        } else {
            list = trimmed.split(',');
        }
    }
    list = list.map(s => String(s).trim().toLowerCase()).filter(Boolean);
    if (list.length === 0 || list.includes('all') || list.includes('all players')) return true;

    // If player has not selected a character yet, show all spells
    if (!playerName && !charName) return true;

    return (playerName && list.includes(playerName)) || (charName && list.includes(charName));
}

function formatAssignedToLabel(assignedTo) {
    if (!assignedTo) return '';
    if (Array.isArray(assignedTo)) {
        if (assignedTo.length === 0) return '';
        return assignedTo.join(', ');
    }
    if (typeof assignedTo === 'string') {
        const trimmed = assignedTo.trim();
        if (!trimmed || trimmed.toLowerCase() === 'all' || trimmed.toLowerCase() === 'all players') return '';
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
                const arr = JSON.parse(trimmed);
                return Array.isArray(arr) ? arr.join(', ') : trimmed;
            } catch(e) {}
        }
        return trimmed;
    }
    return '';
}

// 5. Spellbook View & Detail Modal
async function loadSpellbook() {
    try {
        const res = await fetch("/api/campaign/spells");
        const data = await res.json();
        allSpells = data.records || [];
        filterSpellList(document.getElementById("spell-search-input")?.value || "");
    } catch (e) {
        console.error("Failed to load spells:", e);
    }
}

function filterSpellList(query) {
    const container = document.getElementById("spell-list-container");
    if (!container) return;

    const q = (query || "").trim().toLowerCase();
    
    // Determine active player's name and character name
    let selectedPlayerName = "";
    let selectedCharName = "";
    if (selectedTimerId && timers[selectedTimerId]) {
        selectedPlayerName = (timers[selectedTimerId].name || "").trim().toLowerCase();
        selectedCharName = (timers[selectedTimerId].character_name || "").trim().toLowerCase();
    }

    const filtered = allSpells.filter(s => {
        // 1. Visibility check: check if assigned to this player or to all
        const assignedVal = s.assigned_to || s.assigned_players;
        if (!isAssignedToCurrentPlayer(assignedVal, selectedPlayerName, selectedCharName)) {
            return false;
        }

        // 2. Search query check
        if (!q) return true;
        return (s.name || "").toLowerCase().includes(q) || (s.description || "").toLowerCase().includes(q);
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:#888; padding:30px;">No spells found matching current filters.</div>`;
        return;
    }

    container.innerHTML = filtered.map((s) => {
        const idx = allSpells.indexOf(s);
        const levelLabel = s.level === 0 ? "Cantrip" : `Lvl ${s.level}`;
        const concTag = s.concentration ? `<span style="font-size:10px; background:#f39c12; color:black; padding:2px 5px; border-radius:3px; margin-left:6px; font-weight:bold;">CONC</span>` : "";
        const labelText = formatAssignedToLabel(s.assigned_to || s.assigned_players);
        const assignedTag = labelText ? `<span style="font-size:10px; background:rgba(212,175,55,0.2); color:#d4af37; border:1px solid #d4af37; padding:2px 5px; border-radius:3px; margin-left:6px;">${labelText}</span>` : "";
        
        let actionBadge = "";
        const actType = s.action_type || (s.resets_timer === false ? 'Bonus Action' : 'Action');
        if (actType === 'Bonus Action') {
            actionBadge = `<span style="font-size:10px; background:#8e44ad; color:white; padding:2px 5px; border-radius:3px; margin-left:6px; font-weight:bold;">BONUS</span>`;
        } else if (actType === 'Reaction') {
            actionBadge = `<span style="font-size:10px; background:#2980b9; color:white; padding:2px 5px; border-radius:3px; margin-left:6px; font-weight:bold;">REACTION</span>`;
        } else if (actType === 'Free') {
            actionBadge = `<span style="font-size:10px; background:#27ae60; color:white; padding:2px 5px; border-radius:3px; margin-left:6px; font-weight:bold;">FREE</span>`;
        }

        return `
            <div class="timer-card" style="margin:0; padding:12px 16px; display:flex; justify-content:space-between; align-items:center;" onclick="openSpellDetailModal(${idx})">
                <div>
                    <div style="font-weight:bold; font-size:16px; color:#f5f5f5;">${s.name} ${concTag} ${actionBadge} ${assignedTag}</div>
                    <div style="font-size:12px; color:#aaa; margin-top:2px;">${levelLabel} • ${s.duration || '1 action'}</div>
                </div>
                <div style="font-size:18px; color:#d4af37;">❯</div>
            </div>
        `;
    }).join("");
}

function openSpellDetailModal(spellIndex) {
    const spell = allSpells[spellIndex];
    if (!spell) return;
    currentViewingSpell = spell;

    const modal = document.getElementById("spell-detail-modal");
    document.getElementById("modal-spell-name").textContent = spell.name;
    document.getElementById("modal-spell-level").textContent = spell.level === 0 ? "Cantrip" : `Level ${spell.level} Spell`;
    document.getElementById("modal-spell-duration").textContent = spell.duration || "Instantaneous";
    document.getElementById("modal-spell-concentration").textContent = spell.concentration ? "Yes (Requires Concentration)" : "No";
    document.getElementById("modal-spell-desc").textContent = spell.description || "No description provided.";

    const actionType = spell.action_type || (spell.resets_timer === false ? 'Bonus Action' : 'Action');
    const resetsTimer = (spell.resets_timer !== false && actionType === 'Action');

    const actionEl = document.getElementById("modal-spell-action");
    if (actionEl) actionEl.textContent = actionType;

    const cdEffectEl = document.getElementById("modal-spell-cooldown-effect");
    if (cdEffectEl) {
        cdEffectEl.textContent = resetsTimer ? "⚡ Resets Cooldown" : "✨ Keeps Cooldown";
        cdEffectEl.style.color = resetsTimer ? "#2ecc71" : "#bb86fc";
    }

    const assignedContainer = document.getElementById("modal-spell-assigned-container");
    const assignedSpan = document.getElementById("modal-spell-assigned");
    const labelText = formatAssignedToLabel(spell.assigned_to || spell.assigned_players);
    if (assignedContainer && assignedSpan) {
        if (labelText) {
            assignedContainer.style.display = "block";
            assignedSpan.textContent = labelText;
        } else {
            assignedContainer.style.display = "none";
        }
    }

    const castBtn = document.getElementById("modal-cast-btn");
    if (castBtn) {
        if (locked) {
            castBtn.textContent = "🔒 Actions Locked by DM";
            castBtn.style.opacity = "0.5";
            castBtn.style.cursor = "not-allowed";
            castBtn.style.background = "#555";
        } else if (resetsTimer) {
            castBtn.style.opacity = "1";
            castBtn.style.cursor = "pointer";
            castBtn.style.background = "#1e7f3f";
            if (spell.level === 0) {
                castBtn.textContent = "Cast Cantrip & Reset Cooldown";
            } else {
                castBtn.textContent = `Expend Lvl ${spell.level} Slot & Reset Cooldown`;
            }
        } else {
            castBtn.style.opacity = "1";
            castBtn.style.cursor = "pointer";
            castBtn.style.background = actionType === 'Reaction' ? '#2980b9' : '#8e44ad';
            if (spell.level === 0) {
                castBtn.textContent = `Cast Cantrip (${actionType} - Keeps Cooldown)`;
            } else {
                castBtn.textContent = `Expend Lvl ${spell.level} Slot & Cast (${actionType})`;
            }
        }
    }

    if (modal) modal.style.display = "flex";
}

function closeSpellDetailModal() {
    const modal = document.getElementById("spell-detail-modal");
    if (modal) modal.style.display = "none";
    currentViewingSpell = null;
}

function castSpellFromModal() {
    if (!currentViewingSpell || locked) return;
    const lvl = currentViewingSpell.level;
    const actionType = currentViewingSpell.action_type || (currentViewingSpell.resets_timer === false ? 'Bonus Action' : 'Action');
    const resetsTimer = (currentViewingSpell.resets_timer !== false && actionType === 'Action');

    // Expend slot if level > 0 and player timer is selected
    if (lvl > 0 && selectedTimerId) {
        socket.emit("adjust_spell_slot", {
            timer: selectedTimerId,
            level: String(lvl),
            delta: -1
        });
    }

    // Reset cooldown only if configured to reset cooldown (Action)
    if (resetsTimer) {
        playerResetAction();
    }

    closeSpellDetailModal();
    switchRemoteView("cooldown");
}

// Initial setup
renderPlayerDropdown();
