const socket = io();

function formatTime(s) {
    let m = Math.floor(s / 60);
    let sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

let locked = false;
let adjustLocked = false;
let adjustInterval = 30;
let cooldownMode = true;

function updateCooldownModeUI(isCooldown) {
    cooldownMode = true;

    const modeLabel = document.getElementById("cooldownModeLabel");
    if (modeLabel) {
        modeLabel.innerText = "Cooldown Mode";
    }

    // In cooldown mode, hide standard timer default-time controls
    const defaultTimeCol = document.getElementById("default-time-col");
    if (defaultTimeCol) {
        defaultTimeCol.style.display = "none";
    }

    const combatantsCol = document.getElementById("combatants-col");
    const masterCol = document.getElementById("master-controls-col");
    const quickAdjCol = document.getElementById("quick-adjust-col");

    if (combatantsCol) combatantsCol.style.gridColumn = "span 4";
    if (masterCol) masterCol.style.gridColumn = "span 4";
    if (quickAdjCol) quickAdjCol.style.gridColumn = "span 4";

    const initStandard = document.getElementById("init-standard-controls");
    const initCooldown = document.getElementById("init-cooldown-controls");
    if (initStandard) initStandard.style.display = "none";
    if (initCooldown) initCooldown.style.display = "flex";

    document.querySelectorAll("[id^='duration-label-']").forEach((label) => {
        label.innerText = "Default Cooldown:";
    });
}
                  
socket.on("control_update", (data) => {
    locked = data.locked || false;
    adjustLocked = data.adjust_locked || false;
    adjustInterval = data.adjust_interval || 30;
    
    if (data.cooldown_mode !== undefined) {
        updateCooldownModeUI(data.cooldown_mode);
    }
    
    const adjustInput = document.getElementById("adjustIntervalInput");
    if (adjustInput && document.activeElement !== adjustInput) {
        adjustInput.value = adjustInterval;
    }
    
    if (data.DEFAULT_DURATION !== undefined) {
        document.getElementById("allTime").value = data.DEFAULT_DURATION;
    }

    if (data.theme) {
        document.getElementById("themeSelect").value = data.theme;
        updateThemeClass(data.theme);
    }
    
    if (data.custom_bg_url !== undefined) {
        document.getElementById("customBg").value = data.custom_bg_url;
        applyCustomBg(data.custom_bg_url);
    }

    if (data.timer_done_sound) {
        document.getElementById("timerSoundSelect").value = data.timer_done_sound;
    }

    if (data.hand_raise_sound) {
        document.getElementById("handSoundSelect").value = data.hand_raise_sound;
    }
    
    updateLockUI();
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

function updateThemeClass(themeName) {
    const isCompact = document.body.classList.contains("compact-mode");
    document.body.className = `theme-${themeName} page-control`;
    if (isCompact) {
        document.body.classList.add("compact-mode");
    }
}

socket.on("update", (data) => {
    const container = document.getElementById("timers");
    let anyRunning = false;
    
    const currentIds = Object.keys(data).map(Number).sort((a,b) => a - b);
    
    // Remove obsolete divs
    Array.from(container.children).forEach(child => {
        const idNum = Number(child.id.replace("timer-", ""));
        if (!currentIds.includes(idNum)) {
            child.remove();
            const initDiv = document.getElementById(`init-row-${idNum}`);
            if (initDiv) initDiv.remove();
        }
    });

    for (let i of currentIds) {
        const t = data[i];
        if (!t) continue;
        
        if (t.running) anyRunning = true;

        let div = document.getElementById(`timer-${i}`);

        // ✅ Create once
        if (!div) {
            div = document.createElement("div");
            div.id = `timer-${i}`;
            div.style = `
                border-radius:10px;
                padding:20px;
                padding-bottom:30px;
                background:#222;
                box-shadow:0 4px 10px rgba(0,0,0,0.5);
                position:relative;
                overflow:hidden;
            `;

            div.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:10px;">
                    <!-- Top Row: Name and Condition -->
                    <div style="display:flex; gap:10px;">
                        <input 
                            type="text"
                            id="name-${i}" 
                            placeholder="Timer Name"
                            style="flex:1; min-width:0; box-sizing:border-box; font-weight:bold; font-size:1.1em; margin:0;"
                        >
                        <input 
                            type="text"
                            id="condition-${i}" 
                            placeholder="Condition"
                            style="flex:1; min-width:0; box-sizing:border-box; font-size:1em; margin:0;"
                        >
                        <button onclick="deleteTimer(${i})" style="background:#a83232; color:white; border:none; border-radius:5px; cursor:pointer;" title="Delete Timer">X</button>
                    </div>

                    <!-- Time and Status inline -->
                    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin:10px 0;">
                        <div id="time-display-${i}" style="font-size:48px; font-weight:bold; line-height:1; font-variant-numeric: tabular-nums;"></div>
                        <div style="text-align:right;">
                            <div id="status-${i}" style="font-size:14px; text-transform:uppercase; letter-spacing:1px; opacity:0.8;"></div>
                            <div id="position-${i}" style="font-size:18px; font-weight:bold; margin-top:4px;"></div>
                        </div>
                    </div>

                    <!-- Main Controls -->
                    <div style="display:flex; gap:10px;">
                        <button id="toggle-${i}" style="flex:1; margin:0; font-weight:bold;"></button>
                        <button onclick="resetTimer(${i})" style="flex:1; margin:0;">Reset</button>
                    </div>

                    <!-- Adjustments -->
                    <div class="hide-on-compact" style="display:flex; gap:10px;">
                        <button id="adj-up-${i}" style="flex:1; margin:0;"></button>
                        <button id="adj-down-${i}" style="flex:1; margin:0;"></button>
                    </div>

                    <!-- Set custom time -->
                    <div class="hide-on-compact" style="display:flex; gap:10px;">
                        <input id="time-${i}" type="number" placeholder="Seconds" style="flex:2; margin:0; box-sizing:border-box;">
                        <button onclick="setTimer(${i})" style="flex:1; margin:0;">Set</button>
                    </div>

                    <!-- Set per-combatant default duration -->
                    <div id="cooldown-container-${i}" class="hide-on-compact" style="display:flex; gap:10px; align-items:center;">
                        <span id="duration-label-${i}" style="font-size:12px; opacity:0.8; white-space:nowrap; text-align:left; flex:1;">Default Time:</span>
                        <input id="duration-input-${i}" type="number" placeholder="Seconds" style="width:80px; margin:0; box-sizing:border-box; height:36px; padding:5px; text-align:center; font-family:'Inter', sans-serif;">
                        <span style="font-size:12px; opacity:0.8;">s</span>
                    </div>

                    <!-- Progress Bar Container -->
                    <div style="position:absolute; bottom:0; left:0; right:0; height:8px; background:rgba(0,0,0,0.5);">
                        <div id="pb-${i}" style="height:100%; width:100%; background:#4CAF50; transition:width 0.5s linear, background-color 0.5s;"></div>
                    </div>
                </div>
            `;

            container.appendChild(div);

            // attach handlers once
            document.getElementById(`toggle-${i}`).onclick = () => toggle(i);

            document.getElementById(`name-${i}`).onchange = () => {
                const name = document.getElementById(`name-${i}`).value;
                socket.emit("set_name", {timer: i, name});
            };

            document.getElementById(`condition-${i}`).onchange = () => {
                const condition = document.getElementById(`condition-${i}`).value;
                socket.emit("set_condition", {timer: i, condition});
            };

            document.getElementById(`duration-input-${i}`).onchange = () => {
                const duration = parseInt(document.getElementById(`duration-input-${i}`).value, 10);
                if (!isNaN(duration) && duration > 0) {
                    socket.emit("set_timer_duration", {timer: i, duration});
                }
            };
        }

        const nameInput = document.getElementById(`name-${i}`);
        if (document.activeElement !== nameInput) {
            nameInput.value = t.name;
        }

        const coolContainer = document.getElementById(`cooldown-container-${i}`);
        if (coolContainer) {
            coolContainer.style.display = "flex";
        }
        const durationInput = document.getElementById(`duration-input-${i}`);
        if (durationInput && document.activeElement !== durationInput) {
            durationInput.value = t.duration || 180;
        }
        const durationLabel = document.getElementById(`duration-label-${i}`);
        if (durationLabel) {
            durationLabel.innerText = cooldownMode ? "Default Cooldown:" : "Default Time:";
        }

        // ✅ Update buttons
        const adjUp = document.getElementById(`adj-up-${i}`);
        if (adjUp) {
            adjUp.onclick = () => adjust(i, adjustInterval);
            adjUp.innerText = `+${adjustInterval}s`;
        }
        const adjDown = document.getElementById(`adj-down-${i}`);
        if (adjDown) {
            adjDown.onclick = () => adjust(i, -adjustInterval);
            adjDown.innerText = `-${adjustInterval}s`;
        }

        // ✅ Update condition (only if not actively editing)
        const condInput = document.getElementById(`condition-${i}`);
        if (condInput && document.activeElement !== condInput) {
            condInput.value = t.condition || "";
        }

        // ✅ Update timer display
        document.getElementById(`time-display-${i}`).innerText = formatTime(t.remaining);
        document.getElementById(`status-${i}`).innerText = t.running ? "Running" : "Paused";

        // ✅ Update position (finish order)
        const posDiv = document.getElementById(`position-${i}`);
        if (t.position) {
            posDiv.innerText = `Order: ${t.position}`;
        } else {
            posDiv.innerText = "";
        }

        // ✅ Update toggle button
        const toggleBtn = document.getElementById(`toggle-${i}`);
        toggleBtn.innerText = t.running ? "Pause" : "Start";

        // ✅ Color states
        let bg = "#333";
        let timerClass = "";
        
        if (t.running) {
            bg = "#1e7f3f";
            timerClass = "timer-running";
        } else if (t.remaining <= 0) {
            bg = "#a83232";
            timerClass = "timer-finished";
        }

        div.style.background = bg;
        div.className = timerClass;

        // ✅ Progress Bar Update
        const pct = Math.max(0, Math.min(100, (t.remaining / t.duration) * 100));
        let pbColor = "#4CAF50"; // Green
        if (pct <= 50) pbColor = "#f39c12"; // Yellow
        if (pct <= 20) pbColor = "#e74c3c"; // Red

        const pb = document.getElementById(`pb-${i}`);
        if (pb) {
            pb.style.width = `${pct}%`;
            pb.style.background = pbColor;
        }

        // ✅ Update Initiative List purely for Slide 1
        const initListContainer = document.getElementById("init-list");
        let initDiv = document.getElementById(`init-row-${i}`);
        if (!initDiv) {
            initDiv = document.createElement("div");
            initDiv.id = `init-row-${i}`;
            initDiv.style = "display:flex; justify-content:space-between; align-items:stretch; background:#333; padding:15px; border-radius:8px; border:1px solid #444; gap:10px;";
            initDiv.innerHTML = `
                <input type="text" id="init-name-${i}" placeholder="Timer ${i} Name" style="flex:1; min-width:0; background:#222; color:white; border:1px solid #555; border-radius:5px; padding:8px; font-size:18px; font-weight:bold; font-family:'Inter', sans-serif;">
                <div style="display:flex; flex-direction:column; align-items:center; gap:2px; min-width:50px;">
                    <label id="remote-label-${i}" style="color:#4CAF50; font-size:11px; font-weight:bold; margin-bottom: 2px; text-transform:uppercase;">PLAYER</label>
                    <label class="switch" style="margin:0; transform:scale(0.8);">
                        <input type="checkbox" id="init-remote-${i}" onchange="toggleTimerRemote(${i})">
                        <span class="slider"></span>
                    </label>
                </div>
                <input type="number" id="init-rank-${i}" placeholder="Initiative" style="width:100px; box-sizing:border-box; font-size:1.2em; padding:8px; text-align:center; background:#222; color:white; border:1px solid #555; border-radius:5px;">
                <button onclick="deleteTimer(${i})" style="background:#a83232; color:white; border:none; border-radius:5px; padding:0 15px; font-weight:bold; cursor:pointer;" title="Delete Timer">X</button>
            `;
            initListContainer.appendChild(initDiv);

            document.getElementById(`init-name-${i}`).onchange = () => {
                const name = document.getElementById(`init-name-${i}`).value;
                socket.emit("set_name", {timer: i, name});
            };
        }
        
        const initNameInput = document.getElementById(`init-name-${i}`);
        if (initNameInput && document.activeElement !== initNameInput) {
            initNameInput.value = t.name || `Timer ${i}`;
        }
        
        const initRemoteInput = document.getElementById(`init-remote-${i}`);
        const remoteLabel = document.getElementById(`remote-label-${i}`);
        if (initRemoteInput) {
            const isRemote = (t.show_on_remote !== false);
            initRemoteInput.checked = !isRemote;
            if (remoteLabel) {
                remoteLabel.innerText = isRemote ? "PLAYER" : "ENEMY";
                remoteLabel.style.color = isRemote ? "#4CAF50" : "#f44336";
            }
        }
    }

    const toggleAllBtn = document.getElementById("toggleAllBtn");
    if (toggleAllBtn) {
        toggleAllBtn.innerText = anyRunning ? "⏸ Pause All" : "▶ Start All";
    }
});

function toggle(timer) {
    socket.emit("toggle", {timer});
}

function resetTimer(timer) {
    socket.emit("reset", {timer});
}

function setTimer(timer) {
    const input = document.getElementById(`time-${timer}`);
    const seconds = input.value;
    if (!seconds) return;

    socket.emit("set_timer", {timer, seconds});
    input.value = "";
}

function adjust(timer, delta) {
    socket.emit("adjust_timer", {timer, delta});
}

function toggleAll() {
    socket.emit("toggle_all");
}

function resetAll() {
    socket.emit("reset_all");
}

function setAll() {
    const seconds = document.getElementById("allTime").value;
    socket.emit("set_all_time", {seconds});
}

function toggleTimerRemote(i) {
    const isEnemy = document.getElementById(`init-remote-${i}`).checked;
    const isRemote = !isEnemy;
    const remoteLabel = document.getElementById(`remote-label-${i}`);
    if (remoteLabel) {
        remoteLabel.innerText = isRemote ? "PLAYER" : "ENEMY";
        remoteLabel.style.color = isRemote ? "#4CAF50" : "#f44336";
    }
    socket.emit("set_timer_visibility", {timer: i, show_on_remote: isRemote});
}

function changeTheme() {
    const theme = document.getElementById("themeSelect").value;
    socket.emit("set_theme", {theme});
}

// Initial Compact Load
function initializeCompactMode() {
    let compactPref = localStorage.getItem("compactMode");
    // Default to false if not setup
    if (compactPref === null) {
        compactPref = "false";
        localStorage.setItem("compactMode", "false");
    }
    const isCompact = compactPref === "true";
    document.getElementById("compactToggle").checked = isCompact;
    document.body.classList.toggle("compact-mode", isCompact);
}

function toggleCompact() {
    const isCompact = document.getElementById("compactToggle").checked;
    localStorage.setItem("compactMode", isCompact);
    document.body.classList.toggle("compact-mode", isCompact);
}

initializeCompactMode();

function addTimer() {
    socket.emit("add_timer");
}

function deleteTimer(timer) {
    const nameInput = document.getElementById(`name-${timer}`);
    const initNameInput = document.getElementById(`init-name-${timer}`);
    const combatantName = (nameInput?.value || initNameInput?.value || `Timer ${timer}`).trim() || `Timer ${timer}`;

    if(confirm(`Are you sure you want to delete ${combatantName}?`)) {
        socket.emit("delete_timer", {timer});
    }
}

function setCustomBg() {
    const url = document.getElementById("customBg").value;
    socket.emit("set_custom_bg_url", {url});
}

function setAdjustInterval() {
    const val = parseInt(document.getElementById("adjustIntervalInput").value, 10);
    if (!isNaN(val) && val > 0) {
        socket.emit("set_adjust_interval", {interval: val});
    }
}
                  
function toggleLock(sourceId) {
    const toggle = document.getElementById(sourceId);
    if (!toggle) return;
    locked = toggle.checked;

    socket.emit("lock_controls", {locked});
    updateLockUI();
}

function toggleAdjustLock() {
    const toggle = document.getElementById("adjustLockToggle");
    adjustLocked = toggle.checked;

    socket.emit("lock_adjust", {locked: adjustLocked});
    updateLockUI();
}

function updateLockUI() {
    const toggle1 = document.getElementById("lockToggle1");
    const toggle3 = document.getElementById("lockToggle3");
    const label1 = document.getElementById("lockLabel1");
    const adjustToggle = document.getElementById("adjustLockToggle");
    const adjustLabel = document.getElementById("adjustLockLabel");

    if (toggle1) toggle1.checked = locked;
    if (toggle3) toggle3.checked = locked;
    if (adjustToggle) adjustToggle.checked = adjustLocked;

    if (label1) {
        label1.innerText = locked ? "Master Controls: 🔒 Locked" : "Master Controls: 🔓 Unlocked";
    }

    if (adjustLabel) {
        adjustLabel.innerText = adjustLocked ? `+-${adjustInterval}s: 🔒 Locked` : `+-${adjustInterval}s: 🔓 Unlocked`;
    }
}

// SLIDE MANAGEMENT
let currentSlide = 2; // Default to combat

function showSlide(dir) {
    if (dir === 'next') currentSlide++;
    else if (dir === 'prev') currentSlide--;
    else currentSlide = dir;

    if (currentSlide > 2) currentSlide = 1;
    if (currentSlide < 1) currentSlide = 2;

    for (let i = 1; i <= 2; i++) {
        const slide = document.getElementById(`slide-${i}`);
        if (slide) slide.style.display = (i === currentSlide) ? 'block' : 'none';
    }
}

window.addEventListener('keydown', (e) => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    
    if (e.key === 'ArrowRight') showSlide('next');
    if (e.key === 'ArrowLeft') showSlide('prev');
});

function calculateInitiatives() {
    const ranks = {};
    const ids = Array.from(document.querySelectorAll("[id^='init-rank-']")).map(el => Number(el.id.replace("init-rank-", "")));
    
    for (let i of ids) {
        const val = document.getElementById(`init-rank-${i}`)?.value;
        if (val) {
            ranks[i] = parseInt(val);
        }
    }
    
    if (Object.keys(ranks).length === 0) {
        alert("Please assign an Initiative order (1, 2, 3...) to at least one timer.");
        return;
    }
    
    const minVal = parseInt(document.getElementById("initMin")?.value, 10) || 60;
    const maxVal = parseInt(document.getElementById("initMax")?.value, 10) || 120;
    socket.emit("calculate_initiatives", { ranks, min_seconds: minVal, max_seconds: maxVal });
}

async function fetchSounds() {
    try {
        const resp = await fetch("/api/sounds");
        const sounds = await resp.json();
        const tSel = document.getElementById("timerSoundSelect");
        const hSel = document.getElementById("handSoundSelect");

        sounds.forEach(s => {
            const opt1 = document.createElement("option");
            opt1.value = s;
            opt1.textContent = s;
            tSel.appendChild(opt1);

            const opt2 = document.createElement("option");
            opt2.value = s;
            opt2.textContent = s;
            hSel.appendChild(opt2);
        });
    } catch (e) {
        console.error("Failed to fetch sounds", e);
    }
}

function changeTimerSound() {
    const sound = document.getElementById("timerSoundSelect").value;
    socket.emit("set_timer_done_sound", {sound});
}

function changeHandSound() {
    const sound = document.getElementById("handSoundSelect").value;
    socket.emit("set_hand_raise_sound", {sound});
}

fetchSounds();

// ==========================================
// ====== MODE SWITCHER & MAINTENANCE =======
// ==========================================

let currentMaintTab = 'players';

function switchControlMode(mode) {
    const sessionView = document.getElementById('view-session-control');
    const maintView = document.getElementById('view-campaign-maintenance');
    const btnSession = document.getElementById('btn-mode-session');
    const btnMaint = document.getElementById('btn-mode-maintenance');

    if (mode === 'maintenance') {
        if (sessionView) sessionView.style.display = 'none';
        if (maintView) maintView.style.display = 'block';
        if (btnSession) btnSession.classList.remove('active');
        if (btnMaint) btnMaint.classList.add('active');
        loadCurrentMaintTab();
        try {
            const url = new URL(window.location);
            url.searchParams.set('mode', 'maintenance');
            window.history.replaceState({}, '', url);
        } catch (e) {}
    } else {
        if (sessionView) sessionView.style.display = 'block';
        if (maintView) maintView.style.display = 'none';
        if (btnSession) btnSession.classList.add('active');
        if (btnMaint) btnMaint.classList.remove('active');
        try {
            const url = new URL(window.location);
            url.searchParams.set('mode', 'session');
            window.history.replaceState({}, '', url);
        } catch (e) {}
    }
}

function showMaintTab(tab) {
    currentMaintTab = tab;
    document.querySelectorAll('.maint-subnav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.maint-panel').forEach(panel => panel.style.display = 'none');

    const activeBtn = document.querySelector(`[onclick="showMaintTab('${tab}')"]`);
    if (activeBtn) activeBtn.classList.add('active');

    const panel = document.getElementById(`maint-panel-${tab}`);
    if (panel) panel.style.display = 'block';

    loadCurrentMaintTab();
}

function showMaintStatus(msg, isError = false) {
    const statusDiv = document.getElementById('maint-status');
    if (!statusDiv) return;
    statusDiv.style.display = 'block';
    statusDiv.style.background = isError ? 'rgba(200, 35, 51, 0.2)' : 'rgba(40, 167, 69, 0.2)';
    statusDiv.style.border = isError ? '1px solid #c82333' : '1px solid #28a745';
    statusDiv.style.color = isError ? '#ff8080' : '#80ff80';
    statusDiv.textContent = msg;
    setTimeout(() => { statusDiv.style.display = 'none'; }, 4000);
}

function loadCurrentMaintTab() {
    if (currentMaintTab === 'players') loadPlayers();
    else if (currentMaintTab === 'spells') loadSpells();
    else if (currentMaintTab === 'maps') loadMaps();
    else if (currentMaintTab === 'objectives') loadObjectives();
    else if (currentMaintTab === 'recaps') loadRecaps();
}

// --- Players Collection ---
async function loadPlayers() {
    try {
        const res = await fetch('/api/campaign/player_profiles');
        const data = await res.json();
        const tbody = document.getElementById('maint-players-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        const records = data.records || [];
        if (records.length === 0) {
            addPlayerRow();
        } else {
            records.forEach(r => addPlayerRow(r));
        }
    } catch (e) {
        showMaintStatus('Failed to load players: ' + e.message, true);
    }
}

function addPlayerRow(data = {}) {
    const tbody = document.getElementById('maint-players-tbody');
    if (!tbody) return;
    const tr = document.createElement('tr');
    const pId = data.id || `player_${Date.now()}`;
    tr.dataset.playerId = pId;
    tr.dataset.portraitUrl = data.portrait_url || '';
    tr.innerHTML = `
        <td><input type="text" class="p-name" value="${data.name || ''}" placeholder="Player Name" style="width:100%;"></td>
        <td><input type="text" class="p-char" value="${data.character_name || ''}" placeholder="Character Name" style="width:100%;"></td>
        <td><input type="number" class="p-hp" value="${data.max_hp || 30}" style="width:80px;"></td>
        <td><input type="number" class="p-cd" value="${data.default_cooldown || 60}" style="width:90px;"></td>
        <td><input type="color" class="p-color" value="${data.accent_color || '#d4af37'}" style="width:45px; height:36px; padding:0; border:none; cursor:pointer;"></td>
        <td>
            <div style="display:flex; align-items:center; gap:8px;">
                <input type="file" class="p-file" accept="image/*" style="display:none;" onchange="handlePortraitUpload(this, '${pId}')">
                <button type="button" class="maint-btn-primary" style="padding:4px 8px; font-size:12px;" onclick="this.previousElementSibling.click()">Upload</button>
                <span class="p-portrait-status" style="font-size:12px; opacity:0.8;">${data.portrait_url ? '✓ Attached' : 'None'}</span>
            </div>
        </td>
        <td><button class="maint-btn-danger" onclick="this.closest('tr').remove()">Remove</button></td>
    `;
    tbody.appendChild(tr);
}

async function handlePortraitUpload(input, playerId) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const formData = new FormData();
    formData.append('player_id', playerId);
    formData.append('file', file);

    const statusSpan = input.closest('td').querySelector('.p-portrait-status');
    if (statusSpan) statusSpan.textContent = 'Uploading...';

    try {
        const res = await fetch('/api/campaign/upload_portrait', {
            method: 'POST',
            body: formData
        });
        const result = await res.json();
        if (res.ok) {
            input.closest('tr').dataset.portraitUrl = result.portrait_url;
            if (statusSpan) statusSpan.textContent = '✓ Attached';
            showMaintStatus(`Portrait uploaded successfully for ${playerId}`);
        } else {
            throw new Error(result.error || 'Upload failed');
        }
    } catch (e) {
        if (statusSpan) statusSpan.textContent = 'Failed';
        showMaintStatus('Portrait upload error: ' + e.message, true);
    }
}

async function savePlayersCollection() {
    const rows = Array.from(document.querySelectorAll('#maint-players-tbody tr'));
    const records = rows.map((r, idx) => ({
        id: r.dataset.playerId || `player_${idx + 1}`,
        name: r.querySelector('.p-name')?.value || '',
        character_name: r.querySelector('.p-char')?.value || '',
        max_hp: parseInt(r.querySelector('.p-hp')?.value, 10) || 30,
        default_cooldown: parseInt(r.querySelector('.p-cd')?.value, 10) || 60,
        accent_color: r.querySelector('.p-color')?.value || '#d4af37',
        portrait_url: r.dataset.portraitUrl || ''
    })).filter(r => r.name || r.character_name);

    try {
        const res = await fetch('/api/campaign/player_profiles', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({records})
        });
        if (res.ok) showMaintStatus('Party Profiles saved successfully to database.');
        else throw new Error((await res.json()).error || 'Save failed');
    } catch (e) {
        showMaintStatus('Error saving players: ' + e.message, true);
    }
}

// --- Spells Collection ---
async function loadSpells() {
    try {
        const res = await fetch('/api/campaign/spells');
        const data = await res.json();
        const tbody = document.getElementById('maint-spells-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        const records = data.records || [];
        if (records.length === 0) {
            addSpellRow();
        } else {
            records.forEach(r => addSpellRow(r));
        }
    } catch (e) {
        showMaintStatus('Failed to load spells: ' + e.message, true);
    }
}

function addSpellRow(data = {}) {
    const tbody = document.getElementById('maint-spells-tbody');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="s-name" value="${data.name || ''}" placeholder="Spell Name" style="width:100%;"></td>
        <td><input type="number" class="s-level" value="${data.level !== undefined ? data.level : 1}" min="0" max="9" style="width:60px;"></td>
        <td><input type="text" class="s-duration" value="${data.duration || '1 action'}" style="width:100px;"></td>
        <td><input type="checkbox" class="s-conc" ${data.concentration ? 'checked' : ''}></td>
        <td><input type="text" class="s-desc" value="${data.description || ''}" placeholder="Description / effects" style="width:100%;"></td>
        <td><button class="maint-btn-danger" onclick="this.closest('tr').remove()">Remove</button></td>
    `;
    tbody.appendChild(tr);
}

async function saveSpellsCollection() {
    const rows = Array.from(document.querySelectorAll('#maint-spells-tbody tr'));
    const records = rows.map((r, idx) => ({
        id: `spell_${idx + 1}`,
        name: r.querySelector('.s-name')?.value || '',
        level: parseInt(r.querySelector('.s-level')?.value, 10) || 0,
        duration: r.querySelector('.s-duration')?.value || '',
        concentration: Boolean(r.querySelector('.s-conc')?.checked),
        description: r.querySelector('.s-desc')?.value || ''
    })).filter(r => r.name);

    try {
        const res = await fetch('/api/campaign/spells', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({records})
        });
        if (res.ok) showMaintStatus('Spellbook saved successfully to database.');
        else throw new Error((await res.json()).error || 'Save failed');
    } catch (e) {
        showMaintStatus('Error saving spells: ' + e.message, true);
    }
}

// --- Maps Collection ---
async function loadMaps() {
    try {
        const res = await fetch('/api/campaign/world_maps');
        const data = await res.json();
        const tbody = document.getElementById('maint-maps-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        const records = data.records || [];
        if (records.length === 0) {
            addMapRow();
        } else {
            records.forEach(r => addMapRow(r));
        }
    } catch (e) {
        showMaintStatus('Failed to load maps: ' + e.message, true);
    }
}

function addMapRow(data = {}) {
    const tbody = document.getElementById('maint-maps-tbody');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="m-title" value="${data.name || ''}" placeholder="Map Name" style="width:100%;"></td>
        <td><input type="text" class="m-url" value="${data.image_url || ''}" placeholder="Image URL / Path" style="width:100%;"></td>
        <td><input type="text" class="m-notes" value="${data.notes || ''}" placeholder="Notes / markers" style="width:100%;"></td>
        <td><button class="maint-btn-danger" onclick="this.closest('tr').remove()">Remove</button></td>
    `;
    tbody.appendChild(tr);
}

async function saveMapsCollection() {
    const rows = Array.from(document.querySelectorAll('#maint-maps-tbody tr'));
    const records = rows.map((r, idx) => ({
        id: `map_${idx + 1}`,
        name: r.querySelector('.m-title')?.value || '',
        image_url: r.querySelector('.m-url')?.value || '',
        notes: r.querySelector('.m-notes')?.value || ''
    })).filter(r => r.name);

    try {
        const res = await fetch('/api/campaign/world_maps', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({records})
        });
        if (res.ok) showMaintStatus('World Maps saved successfully to database.');
        else throw new Error((await res.json()).error || 'Save failed');
    } catch (e) {
        showMaintStatus('Error saving maps: ' + e.message, true);
    }
}

// --- Objectives Collection ---
async function loadObjectives() {
    try {
        const res = await fetch('/api/campaign/objectives');
        const data = await res.json();
        const tbody = document.getElementById('maint-objectives-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        const records = data.records || [];
        if (records.length === 0) {
            addObjectiveRow();
        } else {
            records.forEach(r => addObjectiveRow(r));
        }
    } catch (e) {
        showMaintStatus('Failed to load objectives: ' + e.message, true);
    }
}

function addObjectiveRow(data = {}) {
    const tbody = document.getElementById('maint-objectives-tbody');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="obj-title" value="${data.title || ''}" placeholder="Objective Title" style="width:100%;"></td>
        <td><input type="text" class="obj-desc" value="${data.description || ''}" placeholder="Details / next step" style="width:100%;"></td>
        <td>
            <select class="obj-status" style="background:#333; color:white; padding:6px; border-radius:4px;">
                <option value="Active" ${data.status === 'Active' ? 'selected' : ''}>Active</option>
                <option value="Completed" ${data.status === 'Completed' ? 'selected' : ''}>Completed</option>
                <option value="Inactive" ${data.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
            </select>
        </td>
        <td>
            <select class="obj-priority" style="background:#333; color:white; padding:6px; border-radius:4px;">
                <option value="High" ${data.priority === 'High' ? 'selected' : ''}>High</option>
                <option value="Medium" ${data.priority === 'Medium' ? 'selected' : ''}>Medium</option>
                <option value="Low" ${data.priority === 'Low' ? 'selected' : ''}>Low</option>
            </select>
        </td>
        <td><button class="maint-btn-danger" onclick="this.closest('tr').remove()">Remove</button></td>
    `;
    tbody.appendChild(tr);
}

async function saveObjectivesCollection() {
    const rows = Array.from(document.querySelectorAll('#maint-objectives-tbody tr'));
    const records = rows.map((r, idx) => ({
        id: `obj_${idx + 1}`,
        title: r.querySelector('.obj-title')?.value || '',
        description: r.querySelector('.obj-desc')?.value || '',
        status: r.querySelector('.obj-status')?.value || 'Active',
        priority: r.querySelector('.obj-priority')?.value || 'Medium'
    })).filter(r => r.title);

    try {
        const res = await fetch('/api/campaign/objectives', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({records})
        });
        if (res.ok) showMaintStatus('Objectives saved successfully to database.');
        else throw new Error((await res.json()).error || 'Save failed');
    } catch (e) {
        showMaintStatus('Error saving objectives: ' + e.message, true);
    }
}

// --- Recaps Collection ---
async function loadRecaps() {
    try {
        const res = await fetch('/api/campaign/recaps');
        const data = await res.json();
        const tbody = document.getElementById('maint-recaps-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        const records = data.records || [];
        if (records.length === 0) {
            addRecapRow();
        } else {
            records.forEach(r => addRecapRow(r));
        }
    } catch (e) {
        showMaintStatus('Failed to load recaps: ' + e.message, true);
    }
}

function addRecapRow(data = {}) {
    const tbody = document.getElementById('maint-recaps-tbody');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="number" class="rec-num" value="${data.session_number !== undefined ? data.session_number : ''}" placeholder="#" style="width:60px;"></td>
        <td><input type="text" class="rec-date" value="${data.date || ''}" placeholder="YYYY-MM-DD" style="width:110px;"></td>
        <td><input type="text" class="rec-title" value="${data.title || ''}" placeholder="Session Title" style="width:100%;"></td>
        <td><input type="text" class="rec-summary" value="${data.summary || ''}" placeholder="Key events summary" style="width:100%;"></td>
        <td><button class="maint-btn-danger" onclick="this.closest('tr').remove()">Remove</button></td>
    `;
    tbody.appendChild(tr);
}

async function saveRecapsCollection() {
    const rows = Array.from(document.querySelectorAll('#maint-recaps-tbody tr'));
    const records = rows.map((r, idx) => ({
        id: `recap_${idx + 1}`,
        session_number: parseInt(r.querySelector('.rec-num')?.value, 10) || (idx + 1),
        date: r.querySelector('.rec-date')?.value || '',
        title: r.querySelector('.rec-title')?.value || '',
        summary: r.querySelector('.rec-summary')?.value || ''
    })).filter(r => r.title || r.summary);

    try {
        const res = await fetch('/api/campaign/recaps', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({records})
        });
        if (res.ok) showMaintStatus('Session Recaps saved successfully to database.');
        else throw new Error((await res.json()).error || 'Save failed');
    } catch (e) {
        showMaintStatus('Error saving recaps: ' + e.message, true);
    }
}

// Check URL query parameter on initial load for mode
try {
    const initialMode = new URLSearchParams(window.location.search).get('mode');
    if (initialMode === 'maintenance') {
        switchControlMode('maintenance');
    }
} catch (e) {}
