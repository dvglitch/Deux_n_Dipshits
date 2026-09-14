const socket = io();

let prevTimers = {};
let selectedTimerSound = "synthetic";
let selectedHandSound = "synthetic";

// Audio Controller for reliable playback
const AudioController = {
    timerAudio: null,
    handAudio: null,
    audioCtx: null,
    unlocked: false,

    init() {
        if (this.unlocked) return;
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        this.unlocked = true;
        console.log("Audio system unlocked");
        const overlay = document.getElementById("audio-unlock-overlay");
        if (overlay) overlay.style.display = "none";
    },

    setTimerSound(sound) {
        if (sound === "synthetic") {
            this.timerAudio = null;
        } else {
            this.timerAudio = new Audio(`/static/sounds/${sound}`);
            this.timerAudio.load();
        }
    },

    setHandSound(sound) {
        if (sound === "synthetic") {
            this.handAudio = null;
        } else {
            this.handAudio = new Audio(`/static/sounds/${sound}`);
            this.handAudio.load();
        }
    },

    play(type) {
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        if (type === 'timer') {
            if (this.timerAudio) {
                this.timerAudio.currentTime = 0;
                this.timerAudio.play().catch(e => console.warn(e));
            } else {
                this.playSynthetic('timer');
            }
        } else if (type === 'hand') {
            if (this.handAudio) {
                this.handAudio.currentTime = 0;
                this.handAudio.play().catch(e => console.warn(e));
            } else {
                this.playSynthetic('hand');
            }
        }
    },

    playSynthetic(type) {
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        if (type === 'timer') {
            osc.frequency.setValueAtTime(660, this.audioCtx.currentTime); 
            osc.frequency.exponentialRampToValueAtTime(523.25, this.audioCtx.currentTime + 0.1); 
            gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.8);
            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.8);
        } else if (type === 'hand') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, this.audioCtx.currentTime); 
            osc.frequency.exponentialRampToValueAtTime(1320, this.audioCtx.currentTime + 0.1); 
            gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.3);
            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.3);
        }
    }
};

// Global click to unlock audio
window.addEventListener('click', () => AudioController.init(), { once: false });

function playSound(type) {
    AudioController.play(type);
}

// Tracks when each timer first hit 0:00 so the finished-red background can hold then fade.
const finishedSinceByTimer = {};
const FINISHED_HOLD_SECONDS = 3;
const FINISHED_FADE_SECONDS = 3;

function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    const num = parseInt(clean, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function interpolateColor(hexFrom, hexTo, t) {
    const from = hexToRgb(hexFrom);
    const to = hexToRgb(hexTo);
    const r = Math.round(from.r + (to.r - from.r) * t);
    const g = Math.round(from.g + (to.g - from.g) * t);
    const b = Math.round(from.b + (to.b - from.b) * t);
    return `rgb(${r}, ${g}, ${b})`;
}

function getCombatantBackground(timerId, t, runningColor, idleColor, finishedColor) {
    if (t.remaining > 0) {
        delete finishedSinceByTimer[timerId];
        return t.running ? runningColor : idleColor;
    }

    if (!finishedSinceByTimer[timerId]) {
        finishedSinceByTimer[timerId] = Date.now();
    }

    const elapsed = (Date.now() - finishedSinceByTimer[timerId]) / 1000;
    if (elapsed <= FINISHED_HOLD_SECONDS) {
        return finishedColor;
    }
    if (elapsed >= FINISHED_HOLD_SECONDS + FINISHED_FADE_SECONDS) {
        return idleColor;
    }
    const fadeProgress = (elapsed - FINISHED_HOLD_SECONDS) / FINISHED_FADE_SECONDS;
    return interpolateColor(finishedColor, idleColor, fadeProgress);
}

function formatTime(s) {
    let m = Math.floor(s / 60);
    let sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

let activeDisplayTab = "timers";

socket.on("control_update", (data) => {
    if (data.theme) {
        document.body.className = `theme-${data.theme} page-display`;
    }
    
    if (data.custom_bg_url !== undefined) {
        applyCustomBg(data.custom_bg_url);
    }

    if (data.timer_done_sound) {
        selectedTimerSound = data.timer_done_sound;
        AudioController.setTimerSound(data.timer_done_sound);
    }

    if (data.hand_raise_sound) {
        selectedHandSound = data.hand_raise_sound;
        AudioController.setHandSound(data.hand_raise_sound);
    }

    if (data.display_tab && data.display_tab !== activeDisplayTab) {
        switchDisplayTab(data.display_tab);
    }

    if (data.active_map_id !== undefined && data.active_map_id !== activeMapId) {
        activeMapId = data.active_map_id;
        if (activeDisplayTab === "map") {
            loadDisplayMap();
        }
    }
});

let activeMapId = "";

function switchDisplayTab(tab) {
    activeDisplayTab = tab;
    document.querySelectorAll(".display-tab-view").forEach(el => el.style.display = "none");
    const target = document.getElementById(`tab-view-${tab}`);
    if (target) {
        target.style.display = "block";
    }
    if (tab === "map") loadDisplayMap();
    else if (tab === "objectives") loadDisplayObjectives();
    else if (tab === "recaps") loadDisplayRecaps();
}

let currentDisplayMaps = [];
let currentDisplayPins = [];
let currentActiveMapIndex = 0;

function parseDisplayPins(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'object') return [raw];
    if (typeof raw !== 'string') return [];
    
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
    } catch(e) {}

    const pins = [];
    const items = raw.split(/\||\n/);
    items.forEach((item, idx) => {
        const trimmed = item.trim();
        if (!trimmed) return;
        const colIdx = trimmed.indexOf(":");
        if (colIdx > 0) {
            const label = trimmed.substring(0, colIdx).trim();
            const rest = trimmed.substring(colIdx + 1);
            const m = rest.match(/([0-9\.]+)\%?\s*,\s*([0-9\.]+)\%?/);
            if (m) {
                const x = Math.max(0, Math.min(100, parseFloat(m[1])));
                const y = Math.max(0, Math.min(100, parseFloat(m[2])));
                pins.push({
                    id: `pin_${idx}_${Date.now()}`,
                    label: label || `Marker ${idx + 1}`,
                    x: Math.round(x * 10) / 10,
                    y: Math.round(y * 10) / 10
                });
            }
        }
    });
    return pins;
}

function serializeDisplayPins(pins) {
    if (!pins || !Array.isArray(pins)) return "";
    return pins.map(p => `${p.label || 'Marker'}: ${Math.round(p.x)}%, ${Math.round(p.y)}%`).join(" | ");
}

function selectDisplayMap(mapId) {
    activeMapId = String(mapId);
    socket.emit("set_active_map", {map_id: activeMapId, tab: "map"});
    loadDisplayMap();
}

async function loadDisplayMap() {
    try {
        const res = await fetch("/api/campaign/world_maps");
        const data = await res.json();
        currentDisplayMaps = data.records || [];
        const mainTitleEl = document.getElementById("display-map-main-title");
        const switcherBar = document.getElementById("display-map-switcher-bar");
        const imgEl = document.getElementById("display-map-img");
        const emptyEl = document.getElementById("display-map-empty");
        const notesEl = document.getElementById("display-map-notes");
        const pinsContainer = document.getElementById("display-map-pins");

        if (currentDisplayMaps.length === 0) {
            if (mainTitleEl) mainTitleEl.textContent = "World Map";
            if (switcherBar) switcherBar.style.display = "none";
            imgEl.style.display = "none";
            emptyEl.style.display = "block";
            notesEl.textContent = "";
            if (pinsContainer) pinsContainer.innerHTML = "";
            return;
        }

        // Determine active map index
        currentActiveMapIndex = 0;
        if (activeMapId) {
            const foundIdx = currentDisplayMaps.findIndex(m => String(m.id) === String(activeMapId) || String(m.name) === String(activeMapId));
            if (foundIdx !== -1) currentActiveMapIndex = foundIdx;
        }

        const activeMap = currentDisplayMaps[currentActiveMapIndex];
        if (mainTitleEl) {
            mainTitleEl.textContent = activeMap.name || "World Map";
        }

        // Render Switcher buttons if multiple maps
        if (switcherBar) {
            if (currentDisplayMaps.length > 1) {
                switcherBar.style.display = "flex";
                switcherBar.innerHTML = currentDisplayMaps.map((m, idx) => {
                    const isCurrent = idx === currentActiveMapIndex;
                    const mapId = m.id || m.name || idx;
                    const btnStyle = isCurrent
                        ? "background:#d4af37; color:#111; border:1px solid #d4af37; font-weight:bold; padding:6px 14px; border-radius:6px; cursor:pointer; font-family:'Cinzel', serif; font-size:14px; box-shadow:0 0 10px rgba(212,175,55,0.4);"
                        : "background:#222; color:#ccc; border:1px solid #555; padding:6px 14px; border-radius:6px; cursor:pointer; font-family:'Cinzel', serif; font-size:14px;";
                    return `<button style="${btnStyle}" onclick="selectDisplayMap('${mapId}')">${m.name || `Map ${idx + 1}`}</button>`;
                }).join("");
            } else {
                switcherBar.style.display = "none";
            }
        }

        if (activeMap.image_url) {
            imgEl.src = activeMap.image_url;
            imgEl.style.display = "block";
            emptyEl.style.display = "none";
            notesEl.textContent = activeMap.notes || "";

            currentDisplayPins = parseDisplayPins(activeMap.pins || "");
            renderDisplayPins();
        } else {
            imgEl.style.display = "none";
            emptyEl.style.display = "block";
            emptyEl.textContent = `Map '${activeMap.name}' has no image URL set.`;
            notesEl.textContent = activeMap.notes || "";
            if (pinsContainer) pinsContainer.innerHTML = "";
        }
    } catch (e) {
        console.error("Failed to load map:", e);
    }
}

function renderDisplayPins() {
    const pinsContainer = document.getElementById("display-map-pins");
    if (!pinsContainer) return;
    pinsContainer.innerHTML = "";

    currentDisplayPins.forEach((pin, idx) => {
        const pinEl = document.createElement("div");
        pinEl.dataset.pinIndex = idx;
        pinEl.style.cssText = `
            position: absolute;
            left: ${pin.x}%;
            top: ${pin.y}%;
            transform: translate(-50%, -100%);
            display: flex;
            flex-direction: column;
            align-items: center;
            pointer-events: auto;
            cursor: grab;
            user-select: none;
            z-index: 10;
        `;
        pinEl.innerHTML = `
            <span style="background:rgba(20,16,12,0.92); border:1px solid #d4af37; color:#d4af37; padding:3px 8px; border-radius:4px; font-size:12px; font-weight:bold; font-family:'Cinzel', serif; white-space:nowrap; box-shadow:0 3px 10px rgba(0,0,0,0.85);">${pin.label}</span>
            <span style="font-size:26px; filter:drop-shadow(0 2px 5px black); line-height:1;">📍</span>
        `;

        setupDisplayPinDrag(pinEl, idx);
        pinsContainer.appendChild(pinEl);
    });
}

function setupDisplayPinDrag(pinEl, pinIndex) {
    let isDragging = false;
    let wrapper = null;

    function onPointerDown(e) {
        e.stopPropagation();
        e.preventDefault();
        isDragging = true;
        wrapper = document.getElementById("map-img-wrapper");
        pinEl.style.cursor = "grabbing";
        if (pinEl.setPointerCapture) pinEl.setPointerCapture(e.pointerId);

        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
    }

    function onPointerMove(e) {
        if (!isDragging || !wrapper) return;
        const rect = wrapper.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        let posX = ((e.clientX - rect.left) / rect.width) * 100;
        let posY = ((e.clientY - rect.top) / rect.height) * 100;

        posX = Math.max(0, Math.min(100, posX));
        posY = Math.max(0, Math.min(100, posY));

        currentDisplayPins[pinIndex].x = Math.round(posX * 10) / 10;
        currentDisplayPins[pinIndex].y = Math.round(posY * 10) / 10;

        pinEl.style.left = `${currentDisplayPins[pinIndex].x}%`;
        pinEl.style.top = `${currentDisplayPins[pinIndex].y}%`;
    }

    async function onPointerUp(e) {
        if (!isDragging) return;
        isDragging = false;
        pinEl.style.cursor = "grab";
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);

        // Auto-save updated pin coordinates back to database for current active map
        if (currentDisplayMaps.length > currentActiveMapIndex) {
            currentDisplayMaps[currentActiveMapIndex].pins = serializeDisplayPins(currentDisplayPins);
            try {
                await fetch("/api/campaign/world_maps", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({records: currentDisplayMaps})
                });
            } catch (saveErr) {
                console.warn("Failed to save dragged pin position:", saveErr);
            }
        }
    }

    pinEl.addEventListener("pointerdown", onPointerDown);
}

async function loadDisplayObjectives() {
    try {
        const res = await fetch("/api/campaign/objectives");
        const data = await res.json();
        const container = document.getElementById("display-objectives-list");
        if (!container) return;
        const objs = (data.records || []).filter(o => o.status === "Active");
        if (objs.length === 0) {
            container.innerHTML = `<div style="text-align:center; color:#888; font-size:20px; padding:40px;">No active objectives at this time.</div>`;
            return;
        }
        container.innerHTML = objs.map(o => `
            <div style="background:rgba(20,16,12,0.85); border:1px solid rgba(212,175,55,0.3); border-radius:10px; padding:20px; box-shadow:0 6px 15px rgba(0,0,0,0.5);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <h3 style="margin:0; font-family:'Cinzel', serif; color:#d4af37; font-size:24px;">${o.title}</h3>
                    <span style="font-size:12px; font-weight:bold; padding:4px 10px; border-radius:4px; background:${o.priority === 'High' ? '#c82333' : '#e67e22'}; color:white;">${o.priority || 'Medium'} Priority</span>
                </div>
                <p style="margin:0; font-size:16px; color:#dcdcdc; line-height:1.5;">${o.description || ''}</p>
            </div>
        `).join("");
    } catch (e) {
        console.error("Failed to load objectives:", e);
    }
}

async function loadDisplayRecaps() {
    try {
        const res = await fetch("/api/campaign/recaps");
        const data = await res.json();
        const container = document.getElementById("display-recaps-list");
        if (!container) return;
        const recaps = data.records || [];
        if (recaps.length === 0) {
            container.innerHTML = `<div style="text-align:center; color:#888; font-size:20px; padding:40px;">No session recaps available yet.</div>`;
            return;
        }
        container.innerHTML = recaps.slice(-3).reverse().map(r => `
            <div style="background:rgba(20,16,12,0.85); border:1px solid rgba(212,175,55,0.3); border-radius:10px; padding:22px; box-shadow:0 6px 15px rgba(0,0,0,0.5);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <h3 style="margin:0; font-family:'Cinzel', serif; color:#d4af37; font-size:24px;">Session ${r.session_number || ''}: ${r.title || 'Untitled'}</h3>
                    <span style="font-size:14px; color:#aaa;">${r.date || ''}</span>
                </div>
                <p style="margin:0; font-size:16px; color:#dcdcdc; line-height:1.6;">${r.summary || ''}</p>
            </div>
        `).join("");
    } catch (e) {
        console.error("Failed to load recaps:", e);
    }
}

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

socket.on("update", (data) => {
    // Detect transitions
    Object.keys(data).forEach(id => {
        const t = data[id];
        const pt = prevTimers[id];
        if (pt) {
            // Timer completion check
            if (t.remaining <= 0 && pt.remaining > 0) {
                playSound('timer');
            }
            // Hand raise check
            if (t.raised_hand && !pt.raised_hand) {
                playSound('hand');
            }
        }
    });

    prevTimers = JSON.parse(JSON.stringify(data));
    const container = document.getElementById("timers");

    // Click-to-unlock overlay for Display page
    if (!document.getElementById("audio-unlock-overlay")) {
        const overlay = document.createElement("div");
        overlay.id = "audio-unlock-overlay";
        overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.85);
            display: flex; flex-direction: column; justify-content: center; align-items: center;
            z-index: 9999; cursor: pointer; backdrop-filter: blur(10px);
            color: white; font-family: 'Cinzel', serif;
        `;
        overlay.innerHTML = `
            <div style="font-size: 40px; margin-bottom: 20px; text-shadow: 0 0 20px rgba(255,255,255,0.5);">🔊 Audio Sync Required</div>
            <div style="font-size: 20px; opacity: 0.8;">Click anywhere to enable combat alerts</div>
            <div style="margin-top: 40px; font-size: 14px; opacity: 0.5;">(Satisfies browser security policies)</div>
        `;
        document.body.appendChild(overlay);
    }

    const currentIds = Object.keys(data).map(Number).sort((a,b) => a - b);
    
    // Split player timers vs enemy combatants
    const playerIds = currentIds.filter(id => !data[id].is_enemy && data[id].show_on_remote !== false);
    const enemyIds = currentIds.filter(id => data[id].is_enemy || data[id].show_on_remote === false);

    // Dynamic grid layout for player timers
    if (playerIds.length <= 2) {
        container.style.gridTemplateColumns = "repeat(2, 1fr)";
    } else if (playerIds.length <= 4) {
        container.style.gridTemplateColumns = "repeat(2, 1fr)";
    } else if (playerIds.length <= 6) {
        container.style.gridTemplateColumns = "repeat(3, 1fr)";
    } else {
        container.style.gridTemplateColumns = "repeat(3, 1fr)";
    }

    // Remove cards no longer in player timers
    Array.from(container.children).forEach(child => {
        const idNum = Number(child.id.replace("display-timer-", ""));
        if (!playerIds.includes(idNum)) {
            child.remove();
        }
    });

    // 1. Render Player Timer Cards
    for (let i of playerIds) {
        const t = data[i];

        let div = document.getElementById(`display-timer-${i}`);

        if (!div) {
            div = document.createElement("div");
            div.id = `display-timer-${i}`;
            div.style.cssText = `
                border-radius:15px;
                padding:25px 20px;
                text-align:center;
                font-size:30px;
                position:relative;
                transition: all 0.3s ease, box-shadow 0.3s ease;
                box-sizing: border-box;
            `;

            div.innerHTML = `
                <!-- Top-Left Raised Hand Icon -->
                <div style="position:absolute; top:-11.5px; left:-11.5px; display:flex; align-items:center; gap:8px; z-index:5; pointer-events:none;">
                    <span id="disp-hand-icon-${i}" style="display:none; font-size:26px; filter:drop-shadow(0 2px 5px black); animation:bounceHand 1s infinite alternate;">✋</span>
                </div>

                <div style="text-align:center; margin-bottom:6px; min-height:48px; display:flex; flex-direction:column; justify-content:center; align-items:center; width:100%;">
                    <div id="disp-name-${i}" style="font-size:24px; font-weight:bold; font-family:'Cinzel', serif; text-shadow: 1px 1px 2px black;"></div>
                    <div id="disp-char-${i}" style="font-size:14px; color:#c0b8a8; text-shadow:1px 1px 1px black; display:none;"></div>
                </div>
                
                <div id="disp-time-${i}" style="font-size:64px; font-weight:bold; font-variant-numeric: tabular-nums; text-shadow: 2px 2px 4px black; transition: color 0.5s; margin:8px 0;"></div>
                
                <div id="disp-status-${i}" style="font-size:16px; text-transform:uppercase; letter-spacing:1px; opacity:0.85;"></div>
                
                <div id="disp-order-${i}" style="display:none; margin-top:10px; font-size:22px; font-weight:bold; color:#ffd700;"></div>
                
                <div id="disp-cond-container-${i}"></div>

                <!-- Visual HP Bar Container -->
                <div style="margin-top:14px; text-align:left;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; font-size:12px; font-weight:bold; letter-spacing:0.5px;">
                        <span style="color:#e74c3c; font-size:11px; text-transform:uppercase; letter-spacing:1px;">❤️ Health</span>
                        <span id="disp-hp-text-${i}" style="color:#2ecc71; font-size:13px; font-variant-numeric:tabular-nums; font-family:'Inter', sans-serif;"></span>
                    </div>
                    <div style="background:rgba(0,0,0,0.6); border-radius:6px; height:8px; overflow:hidden; border:1px solid rgba(255,255,255,0.15);">
                        <div id="disp-hp-bar-${i}" style="height:100%; width:100%; background:#2ecc71; transition:width 0.4s ease, background-color 0.4s ease;"></div>
                    </div>
                </div>

                <!-- Cooldown Progress Bar (Bottom) -->
                <div style="position:absolute; bottom:0; left:0; right:0; height:8px; background:rgba(0,0,0,0.5); border-radius:0 0 15px 15px; overflow:hidden;">
                    <div id="disp-pb-${i}" style="height:100%; width:100%; background:#4CAF50; transition:width 0.5s linear, background-color 0.5s;"></div>
                </div>
            `;
            container.appendChild(div);
        }

        // Card background & color logic (finished cards hold red then fade back to idle)
        const bg = getCombatantBackground(i, t, "#1e7f3f", "#383430", "#a83232");

        const pct = Math.max(0, Math.min(100, (t.remaining / t.duration) * 100));
        let pbColor = "#4CAF50"; 
        if (pct <= 50) pbColor = "#f39c12"; 
        if (pct <= 20) pbColor = "#e74c3c"; 

        const accentColor = t.accent_color || "#d4af37";
        let boxShadow = `0 8px 24px rgba(0,0,0,0.7), inset 0 0 0 3px ${accentColor}60, 0 0 15px ${accentColor}30`;
        if (t.raised_hand) {
            boxShadow = `inset 0 0 50px 10px rgba(255, 215, 0, 0.5), inset 0 0 20px 5px rgba(255, 215, 0, 0.8), ${boxShadow}`;
        }

        div.style.background = bg;
        div.style.border = `4px solid ${accentColor}`;
        div.style.boxShadow = boxShadow;

        document.getElementById(`disp-name-${i}`).innerText = t.name || ("Player " + i);
        
        const charEl = document.getElementById(`disp-char-${i}`);
        if (t.character_name) {
            charEl.innerText = t.character_name;
            charEl.style.display = "block";
        } else {
            charEl.style.display = "none";
        }

        const handIconEl = document.getElementById(`disp-hand-icon-${i}`);
        if (handIconEl) {
            handIconEl.style.display = t.raised_hand ? "inline-block" : "none";
        }

        document.getElementById(`disp-time-${i}`).innerText = formatTime(t.remaining);
        document.getElementById(`disp-status-${i}`).innerText = t.running ? "Running" : (t.remaining <= 0 ? "Ready" : "Paused");
        
        const orderDiv = document.getElementById(`disp-order-${i}`);
        if (t.raised_hand && t.position) {
            orderDiv.innerText = `Hand #${t.position}`;
            orderDiv.style.display = "block";
        } else {
            orderDiv.style.display = "none";
        }
        
        const condContainer = document.getElementById(`disp-cond-container-${i}`);
        if (t.condition) {
            condContainer.innerHTML = `<div style="position:absolute; top:-10px; right:-10px; background:linear-gradient(145deg, #333, #111); color:#fff; padding:4px 12px; border-radius:4px; font-size:16px; font-weight:bold; font-family:'Cinzel', serif; box-shadow:0 4px 10px rgba(0,0,0,0.8); border:2px solid #d4af37; letter-spacing:1px; z-index:10;">${t.condition}</div>`;
        } else {
            condContainer.innerHTML = "";
        }

        // HP Bar calculation
        const curHp = t.current_hp !== undefined ? t.current_hp : 30;
        const maxHp = t.max_hp !== undefined ? t.max_hp : 30;
        const hpPct = Math.max(0, Math.min(100, (curHp / Math.max(1, maxHp)) * 100));
        let hpColor = "#2ecc71";
        if (hpPct <= 50) hpColor = "#f39c12";
        if (hpPct <= 25) hpColor = "#e74c3c";

        const hpText = document.getElementById(`disp-hp-text-${i}`);
        if (hpText) {
            hpText.innerText = `${curHp} / ${maxHp} HP`;
            hpText.style.color = hpColor;
        }

        const hpBar = document.getElementById(`disp-hp-bar-${i}`);
        if (hpBar) {
            hpBar.style.width = `${hpPct}%`;
            hpBar.style.background = hpColor;
        }

        const pb = document.getElementById(`disp-pb-${i}`);
        if (pb) {
            pb.style.width = `${pct}%`;
            pb.style.background = pbColor;
        }
    }

    // 2. Render Enemy Status Ribbon at the bottom (names & conditions only, NO countdowns on TV)
    const ribbon = document.getElementById("enemy-ribbon");
    const ribbonContent = document.getElementById("enemy-ribbon-content");
    if (ribbon && ribbonContent) {
        if (enemyIds.length > 0) {
            ribbon.style.display = "block";
            ribbonContent.innerHTML = enemyIds.map(id => {
                const enemy = data[id];
                const condTag = enemy.condition ? `<span style="background:#a83232; color:white; font-size:11px; padding:2px 6px; border-radius:3px; margin-left:6px;">${enemy.condition}</span>` : '';
                return `
                    <div style="background:rgba(40, 20, 20, 0.9); border:1px solid #e74c3c; border-radius:5px; padding:5px 12px; font-size:14px; font-weight:bold; color:#f5f5f5; display:inline-flex; align-items:center;">
                        <span>${enemy.name}</span>
                        ${condTag}
                    </div>
                `;
            }).join("");
        } else {
            ribbon.style.display = "none";
            ribbonContent.innerHTML = "";
        }
    }
});
