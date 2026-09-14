const socket = io();

let timers = {};
let expanded = null;
let locked = false;
let adjustLocked = false;
let numTimers = 6;
let adjustInterval = 30;

let prevTimers = {};
let muteFeedback = localStorage.getItem("mute_dm_feedback") === "true";
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
        console.log("Audio system unlocked");
        this.updateUnlockUI();
    },

    setTimerSound(sound) {
        if (sound === "synthetic") {
            this.timerAudio = null;
        } else {
            this.timerAudio = new Audio(`/static/sounds/${sound}`);
            this.timerAudio.load(); // Pre-load
        }
    },

    play(type) {
        if (type === 'timer' && navigator.vibrate) {
            navigator.vibrate(200);
        }

        if (muteFeedback) return;
        this.init(); // Ensure initialized on first play if not already

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
    },

    updateUnlockUI() {
        const indicator = document.getElementById("audio-status");
        if (indicator) {
            let statusText = this.unlocked ? "🟢 Audio Ready" : "🔴 Click to Sync Audio";
            const hapticStatus = navigator.vibrate ? "📱 Haptics: ✅ Ready" : "📱 Haptics: ❌ Unsupported";
            indicator.innerHTML = `${statusText}<br><span style="font-size:10px; opacity:0.7;">${hapticStatus}</span>`;
            indicator.style.color = this.unlocked ? "#4CAF50" : "#ff4444";
        }
    }
};

// Global click to unlock audio
window.addEventListener('click', () => AudioController.init(), { once: false });

// Feedback sound and haptics (legacy wrapper)
function playFeedback(type) {
    AudioController.play(type);
}

let dmFilter = "all";

function setDmFilter(filter) {
    dmFilter = filter;
    document.querySelectorAll('.dm-filter-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`filter-${filter}`);
    if (activeBtn) activeBtn.classList.add('active');
    renderTimers();
}

let dmMapsList = [];
let dmActiveMapId = "";

async function loadDmMaps() {
    try {
        const res = await fetch("/api/campaign/world_maps");
        const data = await res.json();
        dmMapsList = data.records || [];
        const mapSelect = document.getElementById("dmActiveMapSelect");
        if (mapSelect) {
            mapSelect.innerHTML = dmMapsList.length === 0
                ? `<option value="">-- No Maps Configured --</option>`
                : dmMapsList.map(m => {
                    const id = m.id || m.name;
                    const isSel = String(id) === String(dmActiveMapId) || String(m.name) === String(dmActiveMapId);
                    return `<option value="${id}" ${isSel ? 'selected' : ''}>🗺️ ${m.name || 'World Map'}</option>`;
                }).join("");
        }
    } catch (e) {
        console.warn("Failed to load maps on DM screen:", e);
    }
}

function changeDmDisplayTab() {
    const select = document.getElementById("dmDisplayTabSelect");
    if (!select) return;
    const tab = select.value;
    socket.emit("set_display_tab", {tab});

    const mapContainer = document.getElementById("dm-active-map-container");
    if (mapContainer) {
        mapContainer.style.display = (tab === "map") ? "flex" : "none";
    }
    if (tab === "map") {
        loadDmMaps();
    }
}

function changeDmActiveMap() {
    const select = document.getElementById("dmActiveMapSelect");
    if (!select || !select.value) return;
    dmActiveMapId = select.value;
    socket.emit("set_active_map", {map_id: dmActiveMapId, tab: "map"});
}

loadDmMaps();

function toggleDmLock() {
    const toggle = document.getElementById("dmLockToggle");
    locked = toggle.checked;
    socket.emit("lock_controls", {locked});
}

function confirmResetAll() {
    if (confirm("Reset all active combat timers to their default cooldowns?")) {
        socket.emit("reset_all");
    }
}

function toggleAll() {
    socket.emit("toggle_all");
}

function toggle(e, timer) {
    if (e) e.stopPropagation();
    socket.emit("toggle", {timer});
}

function reset(e, timer) {
    if (e) e.stopPropagation();
    socket.emit("reset", {timer});
}

function adjust(e, timer, delta) {
    if (e) e.stopPropagation();
    socket.emit("adjust_timer", {timer, delta});
}

function setTimerSeconds(e, timer) {
    if (e) e.stopPropagation();
    const input = document.getElementById(`custom-time-input-${timer}`);
    if (!input) return;
    const val = parseInt(input.value, 10);
    if (!isNaN(val) && val >= 0) {
        socket.emit("set_timer", {timer, seconds: val});
        input.value = "";
    }
}

function setCooldownDuration(e, timer) {
    if (e) e.stopPropagation();
    const input = document.getElementById(`custom-duration-input-${timer}`);
    if (!input) return;
    const val = parseInt(input.value, 10);
    if (!isNaN(val) && val > 0) {
        socket.emit("set_timer_duration", {timer, duration: val});
    }
}

function openAddEnemyModal() {
    const modal = document.getElementById("add-enemy-modal");
    if (modal) modal.style.display = "flex";
}

function closeAddEnemyModal() {
    const modal = document.getElementById("add-enemy-modal");
    if (modal) modal.style.display = "none";
}

function submitAddEnemy() {
    const nameInput = document.getElementById("new-enemy-name");
    const name = nameInput ? nameInput.value.trim() : "";
    if (!name) return;
    socket.emit("add_timer", {is_enemy: true, name: name});
    if (nameInput) nameInput.value = "";
    closeAddEnemyModal();
}

function adjustHp(e, i, delta) {
    e.stopPropagation();
    const t = timers[i];
    if (!t) return;
    const cur = t.current_hp !== undefined ? t.current_hp : 30;
    const maxHp = t.max_hp !== undefined ? t.max_hp : 30;
    const newHp = Math.max(0, Math.min(maxHp, cur + delta));
    t.current_hp = newHp;
    renderTimers();
    socket.emit("set_hp", {timer: i, current_hp: newHp, max_hp: maxHp});
}

function updateCondition(e, i, val) {
    e.stopPropagation();
    socket.emit("set_condition", {timer: i, condition: val});
}

function deleteCombatant(e, i) {
    e.stopPropagation();
    if (confirm(`Remove combatant #${i}?`)) {
        socket.emit("delete_timer", {timer: i});
    }
}

function formatTime(s) {
    let m = Math.floor(s / 60);
    let sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

socket.on("update", (data) => {
    // Check for expanded timer completion
    if (expanded !== null && data[expanded] && prevTimers[expanded]) {
        const t = data[expanded];
        const pt = prevTimers[expanded];
        if (t.remaining <= 0 && pt.remaining > 0) {
            playFeedback('timer');
        }
    }
    timers = data;
    prevTimers = JSON.parse(JSON.stringify(data)); // Deep copy to prevent reference issues
    renderTimers();
});

socket.on("control_update", (data) => {
    locked = data.locked;
    adjustLocked = data.adjust_locked || false;
    adjustInterval = data.adjust_interval || 30;
    numTimers = data.num_timers || 6;
    
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

    if (data.display_tab) {
        const tabSelect = document.getElementById("dmDisplayTabSelect");
        if (tabSelect && document.activeElement !== tabSelect) {
            tabSelect.value = data.display_tab;
        }
        const mapContainer = document.getElementById("dm-active-map-container");
        if (mapContainer) {
            mapContainer.style.display = (data.display_tab === "map") ? "flex" : "none";
        }
    }

    if (data.active_map_id !== undefined && data.active_map_id !== dmActiveMapId) {
        dmActiveMapId = data.active_map_id;
        loadDmMaps();
    }

    const lockToggle = document.getElementById("dmLockToggle");
    const lockLabel = document.getElementById("dmLockLabel");
    if (lockToggle) {
        lockToggle.checked = Boolean(data.locked);
    }
    if (lockLabel) {
        lockLabel.textContent = data.locked ? "🔒 Players Locked" : "🔓 Players Free";
        lockLabel.style.color = data.locked ? "#f44336" : "#4CAF50";
    }

    // DM screen always remains fully interactive and bright
    document.body.style.opacity = 1;
    renderTimers();
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

function toggleExpand(i) {
    // If touching the already expanded tab, collapse it
    if (expanded === i) {
        expanded = null;
    } else {
        expanded = i;
    }
    renderTimers();
}

function renderTimers() {
    const container = document.getElementById("timers");
    if (!container) return;

    // Feedback Toggle Header
    let settingsBar = document.getElementById("feedback-settings");
    if (!settingsBar) {
        settingsBar = document.createElement("div");
        settingsBar.id = "feedback-settings";
        settingsBar.style = "display:flex; justify-content:space-between; align-items:center; padding:0 10px 10px 10px; margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1);";
        settingsBar.innerHTML = `
            <div id="audio-status" style="font-size:11px; font-weight:bold; color:#ff4444; opacity:0.8;">🔴 Click to Sync Audio</div>
            <button id="mute-btn" onclick="toggleMute()" style="font-size:12px; padding:5px 12px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.2); border-radius:15px; color:white; cursor:pointer; width:auto; margin:0;">
                ${muteFeedback ? "🔇 Muted" : "🔔 Alerts On"}
            </button>
        `;
        container.parentElement.insertBefore(settingsBar, container);
        AudioController.updateUnlockUI();
    }

    let allIds = Object.keys(timers).map(Number).sort((a, b) => a - b);
    
    // Filter by selection
    let ids = allIds.filter(id => {
        const t = timers[id];
        if (!t) return false;
        if (dmFilter === "players") return !t.is_enemy && t.show_on_remote !== false;
        if (dmFilter === "enemies") return t.is_enemy || t.show_on_remote === false;
        return true;
    });

    // Remove timers that are no longer in the list or hidden due to focus mode
    Array.from(container.children).forEach(child => {
        const idNum = Number(child.id.replace("timer-card-", ""));
        if (!ids.includes(idNum) || (expanded !== null && expanded !== idNum)) {
            child.remove();
        }
    });

    for (let i of ids) {
        const t = timers[i];
        if (!t) continue;

        const isExp = (expanded === i);
        if (expanded !== null && !isExp) continue;

        let cardClass = "timer-card";
        if (t.running) cardClass += " running";
        if (t.remaining <= 0) cardClass += " finished";
        
        const timeStr = formatTime(t.remaining);
        const curHp = t.current_hp !== undefined ? t.current_hp : 30;
        const maxHp = t.max_hp !== undefined ? t.max_hp : 30;
        const isEnemy = Boolean(t.is_enemy || t.show_on_remote === false);

        let card = document.getElementById(`timer-card-${i}`);
        let currentState = card ? card.getAttribute("data-expanded") === "true" : null;

        const accentColor = t.accent_color || "#d4af37";

        if (!card || currentState !== isExp) {
            if (card) card.remove();
            card = document.createElement("div");
            card.id = `timer-card-${i}`;
            card.setAttribute("data-expanded", isExp);
            card.style.border = `4px solid ${accentColor}`;
            container.appendChild(card);

            const badge = isEnemy ? `<span style="background:#e74c3c; color:white; font-size:10px; padding:2px 6px; border-radius:3px; font-weight:bold; margin-left:6px;">ENEMY</span>` : `<span style="background:#2ecc71; color:black; font-size:10px; padding:2px 6px; border-radius:3px; font-weight:bold; margin-left:6px;">PLAYER</span>`;

            let html = `
                <div class="timer-header" onclick="toggleExpand(${i})">
                    <div style="display:flex; align-items:center;">
                        <div class="name-disp" style="font-size:20px; font-weight:bold; font-family:'Cinzel', serif;">${t.name}</div>
                        ${badge}
                    </div>
                    <div class="time-disp" style="font-size:24px; font-weight:bold; font-variant-numeric: tabular-nums;"></div>
                </div>
                
                <!-- Quick HP Bar inline -->
                <div style="display:flex; align-items:center; gap:8px; margin-top:8px;">
                    <div class="hp-inline-text" style="font-size:12px; font-weight:bold; min-width:48px; text-align:left;">HP: ${curHp}/${maxHp}</div>
                    <div style="flex:1; background:rgba(0,0,0,0.5); border-radius:4px; height:6px; overflow:hidden;">
                        <div class="hp-fill-bar" style="height:100%; width:${Math.min(100, (curHp/maxHp)*100)}%; background:${(curHp/maxHp) <= 0.25 ? '#e74c3c' : ((curHp/maxHp) <= 0.5 ? '#f39c12' : '#2ecc71')};"></div>
                    </div>
                </div>
            `;

            if (isExp) {
                html += `
                    <div class="timer-body" style="margin-top:15px; border-top:1px solid rgba(255,255,255,0.1); padding-top:12px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:14px;">
                            <div class="status-disp" style="opacity:0.8; text-transform:uppercase; font-weight:bold;"></div>
                            <div class="pos-disp" style="font-weight:bold; color:gold;"></div>
                        </div>

                        <!-- HP Adjust Controls -->
                        <div style="background:rgba(0,0,0,0.3); border-radius:6px; padding:8px 10px; margin-bottom:12px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                <span style="font-size:13px; font-weight:bold;">Hit Points</span>
                                <span class="hp-exp-text" style="font-size:13px; color:#2ecc71; font-weight:bold;">${curHp} / ${maxHp} HP</span>
                            </div>
                            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:6px;">
                                <button onclick="adjustHp(event, ${i}, -5)" style="padding:6px; font-size:12px; background:#a83232;">-5</button>
                                <button onclick="adjustHp(event, ${i}, -1)" style="padding:6px; font-size:12px; background:#884444;">-1</button>
                                <button onclick="adjustHp(event, ${i}, 1)" style="padding:6px; font-size:12px; background:#2e7d32;">+1</button>
                                <button onclick="adjustHp(event, ${i}, 5)" style="padding:6px; font-size:12px; background:#1b5e20;">+5</button>
                            </div>
                        </div>

                        <!-- Condition -->
                        <div style="margin-bottom:12px;">
                            <input type="text" value="${t.condition || ''}" placeholder="Condition (e.g. Stunned, Poisoned)" onchange="updateCondition(event, ${i}, this.value)" style="width:100%; font-size:13px; text-align:left; box-sizing:border-box;">
                        </div>

                        <!-- Timer Controls -->
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                            <button class="toggle-btn" onclick="toggle(event, ${i})" style="margin:0; width:100%;"></button>
                            <button onclick="reset(event, ${i})" style="margin:0; width:100%; background:#444;">Reset</button>
                        </div>

                        <div class="adj-container" style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                            <button id="adj-up-btn-${i}" class="adj-btn" style="margin:0; width:100%; background:#333;">+30s</button>
                            <button id="adj-down-btn-${i}" class="adj-btn" style="margin:0; width:100%; background:#333;">-30s</button>
                        </div>

                        <!-- Manual Time & Cooldown Set -->
                        <div style="background:rgba(0,0,0,0.25); border-radius:6px; padding:8px 10px; margin-bottom:8px; display:flex; flex-direction:column; gap:6px;">
                            <div style="display:flex; gap:6px; align-items:center;">
                                <span style="font-size:12px; color:#aaa; width:65px; text-align:left;">Set Time:</span>
                                <input id="custom-time-input-${i}" type="number" placeholder="Seconds" style="flex:1; margin:0; padding:4px 8px; font-size:13px; text-align:center; background:#111; color:white; border:1px solid #555; border-radius:4px;">
                                <button onclick="setTimerSeconds(event, ${i})" style="padding:4px 10px; font-size:12px; background:#4a3b2c; border:1px solid #d4af37; color:#d4af37; font-weight:bold; margin:0;">Set</button>
                            </div>
                            <div style="display:flex; gap:6px; align-items:center;">
                                <span style="font-size:12px; color:#aaa; width:65px; text-align:left;">Default:</span>
                                <input id="custom-duration-input-${i}" type="number" value="${t.duration || 60}" placeholder="Cooldown (s)" onchange="setCooldownDuration(event, ${i})" style="flex:1; margin:0; padding:4px 8px; font-size:13px; text-align:center; background:#111; color:white; border:1px solid #555; border-radius:4px;">
                                <span style="font-size:11px; opacity:0.7;">s</span>
                            </div>
                        </div>

                        <div style="display:flex; gap:8px; margin-top:10px;">
                            <button onclick="toggleExpand(${i})" style="flex:2; margin:0; background:#333; font-size:13px;">⬆ Collapse</button>
                            ${isEnemy ? `<button onclick="deleteCombatant(event, ${i})" style="flex:1; margin:0; background:#8b2525; font-size:13px;">Delete</button>` : ''}
                        </div>
                    </div>
                `;
            }
            
            card.innerHTML = html;
        }

        // Surgical updates
        card.className = cardClass;
        card.style.border = `4px solid ${accentColor}`;
        card.querySelector('.name-disp').textContent = t.name;
        card.querySelector('.time-disp').textContent = timeStr;

        const hpPct = Math.max(0, Math.min(100, (curHp / Math.max(1, maxHp)) * 100));
        const hpColor = (curHp / Math.max(1, maxHp)) <= 0.25 ? '#e74c3c' : ((curHp / Math.max(1, maxHp)) <= 0.5 ? '#f39c12' : '#2ecc71');

        const hpInline = card.querySelector('.hp-inline-text');
        if (hpInline) hpInline.textContent = `HP: ${curHp}/${maxHp}`;

        const hpBar = card.querySelector('.hp-fill-bar');
        if (hpBar) {
            hpBar.style.width = `${hpPct}%`;
            hpBar.style.background = hpColor;
        }

        if (isExp) {
            const hpExp = card.querySelector('.hp-exp-text');
            if (hpExp) {
                hpExp.textContent = `${curHp} / ${maxHp} HP`;
                hpExp.style.color = hpColor;
            }

            const status = t.remaining <= 0 ? "Ready" : (t.running ? "Running" : "Paused");
            const pos = (t.raised_hand && t.position) ? `Hand #${t.position}` : "";
            const toggleTxt = t.running ? "Pause" : "Start";
            const adjDisplay = adjustLocked ? "none" : "grid";

            card.querySelector('.status-disp').textContent = status;
            card.querySelector('.pos-disp').textContent = pos;
            card.querySelector('.toggle-btn').textContent = toggleTxt;
            
            let adjContainer = card.querySelector('.adj-container');
            if (adjContainer) adjContainer.style.display = adjDisplay;
            
            card.querySelectorAll('.adj-btn').forEach(btn => {
                btn.style.opacity = "1";
            });

            const durInput = document.getElementById(`custom-duration-input-${i}`);
            if (durInput && document.activeElement !== durInput) {
                durInput.value = t.duration || 60;
            }

            const adjUp = document.getElementById(`adj-up-btn-${i}`);
            if (adjUp) {
                adjUp.onclick = (e) => adjust(e, i, adjustInterval);
                adjUp.textContent = `+${adjustInterval}s`;
            }
            const adjDown = document.getElementById(`adj-down-btn-${i}`);
            if (adjDown) {
                adjDown.onclick = (e) => adjust(e, i, -adjustInterval);
                adjDown.textContent = `-${adjustInterval}s`;
            }
        }
    }
    
    let currentDOMIds = Array.from(container.children).map(child => Number(child.id.replace("timer-card-", "")));
    let matching = true;
    let visibleIds = ids.filter(id => expanded === null || expanded === id);
    if (currentDOMIds.length === visibleIds.length) {
        for(let k=0; k<visibleIds.length; k++) {
            if(currentDOMIds[k] !== visibleIds[k]) {
                matching = false; 
                break;
            }
        }
    } else {
        matching = false;
    }
    
    if (!matching) {
        visibleIds.forEach(id => {
            let c = document.getElementById(`timer-card-${id}`);
            if(c) container.appendChild(c);
        });
    }
}

function toggle(e, i) {
    // Prevent bubbling of click event resolving multiple tabs breaking
    e.stopPropagation();
    socket.emit("toggle", {timer: i});
}

function reset(e, i) {
    e.stopPropagation();
    socket.emit("reset", {timer: i, start: true});
}

function toggleHand(e, i) {
    e.stopPropagation();
    socket.emit("toggle_hand", {timer: i});
}

function adjust(e, i, delta) {
    e.stopPropagation();
    socket.emit("adjust_timer", {timer: i, delta});
}
