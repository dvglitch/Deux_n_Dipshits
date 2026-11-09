const socket = io();
window.registerSessionSync(socket);

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
let currentDisplayShapes = [];
let currentActiveMapIndex = 0;
let displayMapEditing = false;
let displayMapTool = "select";
let selectedDisplayMapItem = null;
let displayMapScale = 1;
let displayMapOffset = {x: 0, y: 0};
let displayMapSaveTimer = null;
let displayMapSaving = false;
const pendingDisplayMapEdits = new Map();
let displayedMapKey = "";

function parseDisplayPins(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return normalizeDisplayPins(raw);
    if (typeof raw === 'object') return normalizeDisplayPins([raw]);
    if (typeof raw !== 'string') return [];
    
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return normalizeDisplayPins(parsed);
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
    return pins.map(p => `${p.label || 'Marker'}: ${Math.round(p.x * 10) / 10}%, ${Math.round(p.y * 10) / 10}%`).join(" | ");
}

function parseDisplayShapes(raw) {
    let shapes = raw;
    if (typeof raw === "string" && raw.trim()) {
        try {
            shapes = JSON.parse(raw);
        } catch (error) {
            console.warn("Could not parse saved map shapes:", error);
            return [];
        }
    }
    if (!Array.isArray(shapes)) return [];
    return shapes.filter(shape =>
        shape && ["rectangle", "ellipse", "line"].includes(shape.type)
    ).map((shape, index) => {
        const type = shape.type;
        const x = clampMapNumber(shape.x, 0, 100, 0);
        const y = clampMapNumber(shape.y, 0, 100, 0);
        return {
            id: String(shape.id || `shape_${index}`),
            type,
            x,
            y,
            width: clampMapNumber(
                shape.width, 0.5, type === "line" ? 150 : 100 - x, 1
            ),
            height: clampMapNumber(
                shape.height, type === "line" ? 0.2 : 0.5,
                type === "line" ? 5 : 100 - y, type === "line" ? 0.5 : 1
            ),
            rotation: clampMapNumber(shape.rotation, -180, 180, 0),
            color: /^#[0-9a-f]{6}$/i.test(shape.color || "")
                ? shape.color
                : "#e74c3c",
            opacity: clampMapNumber(shape.opacity, 10, 90, 30),
        };
    });
}

function clampMapNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
}

function normalizeDisplayPins(pins) {
    if (!Array.isArray(pins)) return [];
    return pins.filter(pin => pin && typeof pin === "object").map((pin, index) => ({
        id: String(pin.id || `pin_${index}_${Date.now()}`),
        label: String(pin.label || `Marker ${index + 1}`),
        x: clampMapNumber(pin.x, 0, 100, 50),
        y: clampMapNumber(pin.y, 0, 100, 50),
    }));
}

function selectDisplayMap(mapId) {
    activeMapId = String(mapId);
    socket.emit("set_active_map", {map_id: activeMapId, tab: "map"});
    loadDisplayMap();
}

async function loadDisplayMap() {
    try {
        const res = await fetch("/api/campaign/world_maps");
        if (!res.ok) throw new Error(`Map request failed (${res.status})`);
        const data = await res.json();
        currentDisplayMaps = data.records || [];
        const mainTitleEl = document.getElementById("display-map-main-title");
        const switcherBar = document.getElementById("display-map-switcher-bar");
        const imgEl = document.getElementById("display-map-img");
        const emptyEl = document.getElementById("display-map-empty");
        const notesEl = document.getElementById("display-map-notes");
        const pinsContainer = document.getElementById("display-map-pins");
        const shapesContainer = document.getElementById("display-map-shapes");

        if (currentDisplayMaps.length === 0) {
            if (mainTitleEl) mainTitleEl.textContent = "World Map";
            if (switcherBar) switcherBar.style.display = "none";
            imgEl.style.display = "none";
            emptyEl.style.display = "block";
            notesEl.textContent = "";
            if (pinsContainer) pinsContainer.innerHTML = "";
            if (shapesContainer) shapesContainer.innerHTML = "";
            setDisplayMapEditing(false);
            setDisplayMapSaveStatus("No maps available");
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
                switcherBar.replaceChildren();
                currentDisplayMaps.forEach((map, index) => {
                    const button = document.createElement("button");
                    button.textContent = map.name || `Map ${index + 1}`;
                    button.classList.toggle("active", index === currentActiveMapIndex);
                    button.addEventListener("click", () => {
                        selectDisplayMap(map.id || map.name || index);
                    });
                    switcherBar.appendChild(button);
                });
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
            currentDisplayShapes = parseDisplayShapes(activeMap.shapes);
            selectedDisplayMapItem = null;
            const mapKey = String(activeMap.id || activeMap.name || currentActiveMapIndex);
            if (mapKey !== displayedMapKey) {
                displayMapScale = 1;
                displayMapOffset = {x: 0, y: 0};
                displayedMapKey = mapKey;
            }
            applyDisplayMapTransform();
            renderDisplayPins();
            renderDisplayShapes();
            syncDisplayMapEditingUI();
            setDisplayMapSaveStatus(displayMapEditing ? "All changes saved" : "View only");
        } else {
            imgEl.style.display = "none";
            emptyEl.style.display = "block";
            emptyEl.textContent = `Map '${activeMap.name}' has no image URL set.`;
            notesEl.textContent = activeMap.notes || "";
            if (pinsContainer) pinsContainer.innerHTML = "";
            if (shapesContainer) shapesContainer.innerHTML = "";
            setDisplayMapSaveStatus("This map has no image", true);
        }
    } catch (e) {
        console.error("Failed to load map:", e);
        setDisplayMapSaveStatus(`Map load failed: ${e.message}`, true);
    }
}

function renderDisplayPins() {
    const pinsContainer = document.getElementById("display-map-pins");
    if (!pinsContainer) return;
    pinsContainer.innerHTML = "";

    currentDisplayPins.forEach((pin, idx) => {
        const pinEl = document.createElement("div");
        pinEl.className = "display-map-pin";
        pinEl.dataset.pinIndex = idx;
        pinEl.style.left = `${pin.x}%`;
        pinEl.style.top = `${pin.y}%`;
        pinEl.style.setProperty("--display-map-pin-scale", String(1 / displayMapScale));
        const label = document.createElement("span");
        label.className = "display-map-pin-label";
        label.textContent = pin.label || "Marker";
        const icon = document.createElement("span");
        icon.className = "display-map-pin-icon";
        icon.textContent = "📍";
        pinEl.append(label, icon);
        pinEl.addEventListener("pointerdown", (event) => {
            if (!displayMapEditing) return;
            event.stopPropagation();
            if (displayMapTool !== "select") return;
            selectDisplayMapItem("marker", pin.id);
            startDisplayMapItemDrag(event, "marker", pin.id);
        });
        pinsContainer.appendChild(pinEl);
    });
}

function renderDisplayShapes() {
    const layer = document.getElementById("display-map-shapes");
    if (!layer) return;
    layer.innerHTML = "";
    currentDisplayShapes.forEach((shape) => {
        const shapeEl = document.createElement("div");
        const selected = selectedDisplayMapItem?.type === "shape"
            && selectedDisplayMapItem.id === shape.id;
        shapeEl.className = `display-map-shape display-map-${shape.type}${selected ? " selected" : ""}`;
        shapeEl.style.left = `${shape.x}%`;
        shapeEl.style.top = `${shape.y}%`;
        shapeEl.style.width = `${shape.width}%`;
        shapeEl.style.height = shape.type === "line" ? "0" : `${shape.height}%`;
        shapeEl.style.transform = `rotate(${shape.rotation || 0}deg)`;
        const color = shape.color || "#e74c3c";
        if (shape.type === "line") {
            shapeEl.style.borderTopColor = colorWithOpacity(color, shape.opacity ?? 30);
        } else {
            shapeEl.style.borderColor = color;
            shapeEl.style.backgroundColor = colorWithOpacity(color, shape.opacity ?? 30);
        }
        if (displayMapEditing) {
            shapeEl.style.pointerEvents = "auto";
            shapeEl.addEventListener("pointerdown", (event) => {
                event.stopPropagation();
                if (displayMapTool !== "select") return;
                selectDisplayMapItem("shape", shape.id);
                startDisplayMapItemDrag(
                    event, "shape", shape.id,
                    event.target.classList.contains("display-map-resize-handle")
                );
            });
        }
        if (selected && displayMapEditing) {
            const handle = document.createElement("span");
            handle.className = "display-map-resize-handle";
            shapeEl.appendChild(handle);
        }
        layer.appendChild(shapeEl);
    });
}

function colorWithOpacity(color, opacity) {
    const match = /^#?([0-9a-f]{6})$/i.exec(color);
    if (!match) return `rgba(231, 76, 60, ${Number(opacity) / 100})`;
    const value = Number.parseInt(match[1], 16);
    return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${Number(opacity) / 100})`;
}

function getDisplayMapCoordinates(event) {
    const imageRect = document.getElementById("display-map-img")?.getBoundingClientRect();
    if (!imageRect || !imageRect.width || !imageRect.height) return null;
    return {
        x: Math.max(0, Math.min(100, ((event.clientX - imageRect.left) / imageRect.width) * 100)),
        y: Math.max(0, Math.min(100, ((event.clientY - imageRect.top) / imageRect.height) * 100)),
    };
}

function toggleDisplayMapEditing() {
    setDisplayMapEditing(!displayMapEditing);
}

function setDisplayMapEditing(enabled) {
    displayMapEditing = enabled;
    displayMapTool = "select";
    selectedDisplayMapItem = null;
    syncDisplayMapEditingUI();
    renderDisplayPins();
    renderDisplayShapes();
    setDisplayMapSaveStatus(enabled ? "All changes saved" : "View only");
}

function syncDisplayMapEditingUI() {
    const editButton = document.getElementById("display-map-edit-toggle");
    const editTools = document.getElementById("display-map-edit-tools");
    const viewport = document.getElementById("display-map-viewport");
    if (viewport) viewport.dataset.mapTool = displayMapTool;
    if (editButton) {
        editButton.textContent = displayMapEditing ? "Done Editing" : "Edit Map";
        editButton.classList.toggle("active", displayMapEditing);
    }
    if (editTools) editTools.style.display = displayMapEditing ? "flex" : "none";
    if (viewport) viewport.classList.toggle("display-map-editing", displayMapEditing);
    document.querySelectorAll("[data-map-tool]").forEach((button) => {
        button.classList.toggle(
            "active", displayMapEditing && button.dataset.mapTool === displayMapTool
        );
    });

    const marker = selectedDisplayMapItem?.type === "marker"
        ? currentDisplayPins.find(pin => pin.id === selectedDisplayMapItem.id)
        : null;
    const shape = selectedDisplayMapItem?.type === "shape"
        ? currentDisplayShapes.find(item => item.id === selectedDisplayMapItem.id)
        : null;
    const markerProperty = document.getElementById("display-map-marker-property");
    const shapeProperty = document.getElementById("display-map-shape-property");
    const deleteButton = document.getElementById("display-map-delete-selected");
    const markerInput = document.getElementById("display-map-marker-label");
    const colorInput = document.getElementById("display-map-shape-color");
    const opacityInput = document.getElementById("display-map-shape-opacity");
    const rotationInput = document.getElementById("display-map-shape-rotation");
    const rotationValue = document.getElementById("display-map-shape-rotation-value");
    if (markerProperty) markerProperty.style.display = marker ? "flex" : "none";
    if (shapeProperty) shapeProperty.style.display = shape ? "flex" : "none";
    if (deleteButton) deleteButton.style.display = selectedDisplayMapItem ? "inline-block" : "none";
    if (marker && markerInput && document.activeElement !== markerInput) {
        markerInput.value = marker.label || "";
    }
    if (shape && colorInput) colorInput.value = shape.color || "#e74c3c";
    if (shape && opacityInput) opacityInput.value = shape.opacity ?? 30;
    if (shape && rotationInput) rotationInput.value = shape.rotation || 0;
    if (shape && rotationValue) rotationValue.textContent = `${shape.rotation || 0}°`;
}

function setDisplayMapTool(tool) {
    if (!displayMapEditing) return;
    displayMapTool = tool;
    selectedDisplayMapItem = null;
    syncDisplayMapEditingUI();
    renderDisplayPins();
    renderDisplayShapes();
}

function selectDisplayMapItem(type, id) {
    selectedDisplayMapItem = {type, id};
    syncDisplayMapEditingUI();
    renderDisplayPins();
    renderDisplayShapes();
}

function deleteSelectedDisplayMapItem() {
    if (!selectedDisplayMapItem) return;
    if (selectedDisplayMapItem.type === "marker") {
        currentDisplayPins = currentDisplayPins.filter(
            pin => pin.id !== selectedDisplayMapItem.id
        );
    } else {
        currentDisplayShapes = currentDisplayShapes.filter(
            shape => shape.id !== selectedDisplayMapItem.id
        );
    }
    selectedDisplayMapItem = null;
    renderDisplayPins();
    renderDisplayShapes();
    syncDisplayMapEditingUI();
    markDisplayMapChanged();
}

function startDisplayMapItemDrag(event, type, id, resizing = false) {
    event.preventDefault();
    const startPoint = getDisplayMapCoordinates(event);
    const item = type === "marker"
        ? currentDisplayPins.find(pin => pin.id === id)
        : currentDisplayShapes.find(shape => shape.id === id);
    if (!startPoint || !item) return;
    const start = {...item};
    let changed = false;

    function move(moveEvent) {
        const point = getDisplayMapCoordinates(moveEvent);
        if (!point) return;
        const dx = point.x - startPoint.x;
        const dy = point.y - startPoint.y;
        if (dx !== 0 || dy !== 0) changed = true;
        if (type === "marker") {
            item.x = Math.max(0, Math.min(100, start.x + dx));
            item.y = Math.max(0, Math.min(100, start.y + dy));
        } else if (resizing && item.type === "line") {
            const imageRect = document.getElementById("display-map-img").getBoundingClientRect();
            const pixelX = (point.x - start.x) * imageRect.width / 100;
            const pixelY = (point.y - start.y) * imageRect.height / 100;
            item.width = Math.max(0.5, Math.hypot(pixelX, pixelY) * 100 / imageRect.width);
            item.rotation = Math.atan2(pixelY, pixelX) * 180 / Math.PI;
        } else if (resizing) {
            const imageRect = document.getElementById("display-map-img").getBoundingClientRect();
            const angle = (start.rotation || 0) * Math.PI / 180;
            const pixelX = dx * imageRect.width / 100;
            const pixelY = dy * imageRect.height / 100;
            const localX = (Math.cos(angle) * pixelX + Math.sin(angle) * pixelY)
                * 100 / imageRect.width;
            const localY = (-Math.sin(angle) * pixelX + Math.cos(angle) * pixelY)
                * 100 / imageRect.height;
            item.width = Math.max(0.5, Math.min(100 - start.x, start.width + localX));
            item.height = Math.max(0.5, Math.min(100 - start.y, start.height + localY));
        } else {
            item.x = Math.max(0, Math.min(100 - start.width, start.x + dx));
            item.y = Math.max(0, Math.min(100 - start.height, start.y + dy));
        }
        renderDisplayPins();
        renderDisplayShapes();
    }

    function finish() {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        if (changed) markDisplayMapChanged();
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, {once: true});
    window.addEventListener("pointercancel", finish, {once: true});
}

function startDisplayMapShape(event, startPoint, type) {
    event.preventDefault();
    const imageRect = document.getElementById("display-map-img").getBoundingClientRect();
    const shape = {
        id: `shape_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type,
        x: startPoint.x,
        y: startPoint.y,
        width: 0.5,
        height: 0.5,
        rotation: 0,
        color: document.getElementById("display-map-shape-color")?.value || "#e74c3c",
        opacity: Number(document.getElementById("display-map-shape-opacity")?.value || 30),
    };
    currentDisplayShapes.push(shape);
    selectDisplayMapItem("shape", shape.id);

    function move(moveEvent) {
        const point = getDisplayMapCoordinates(moveEvent);
        if (!point) return;
        if (type === "line") {
            const pixelX = (point.x - startPoint.x) * imageRect.width / 100;
            const pixelY = (point.y - startPoint.y) * imageRect.height / 100;
            shape.width = Math.max(0.5, Math.hypot(pixelX, pixelY) * 100 / imageRect.width);
            shape.rotation = Math.atan2(pixelY, pixelX) * 180 / Math.PI;
        } else {
            shape.x = Math.min(startPoint.x, point.x);
            shape.y = Math.min(startPoint.y, point.y);
            shape.width = Math.max(0.5, Math.abs(point.x - startPoint.x));
            shape.height = Math.max(0.5, Math.abs(point.y - startPoint.y));
        }
        renderDisplayShapes();
    }

    function finish() {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        const tooSmall = type === "line"
            ? shape.width < 1
            : shape.width < 1 || shape.height < 1;
        if (tooSmall) {
            currentDisplayShapes = currentDisplayShapes.filter(item => item.id !== shape.id);
            selectedDisplayMapItem = null;
        }
        renderDisplayShapes();
        syncDisplayMapEditingUI();
        if (currentDisplayShapes.some(item => item.id === shape.id)) markDisplayMapChanged();
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, {once: true});
    window.addEventListener("pointercancel", finish, {once: true});
}

function startDisplayMapPan(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const originalOffset = {...displayMapOffset};
    const viewport = document.getElementById("display-map-viewport");
    if (viewport) viewport.style.cursor = "grabbing";

    function move(moveEvent) {
        displayMapOffset = {
            x: originalOffset.x + moveEvent.clientX - startX,
            y: originalOffset.y + moveEvent.clientY - startY,
        };
        applyDisplayMapTransform();
    }

    function finish() {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        if (viewport) viewport.style.cursor = "";
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, {once: true});
    window.addEventListener("pointercancel", finish, {once: true});
}

function handleDisplayMapPointerDown(event) {
    const point = getDisplayMapCoordinates(event);
    if (!point) return;
    if (displayMapEditing && displayMapTool === "marker") {
        const marker = {
            id: `pin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            label: `Marker ${currentDisplayPins.length + 1}`,
            x: Math.round(point.x * 10) / 10,
            y: Math.round(point.y * 10) / 10,
        };
        currentDisplayPins.push(marker);
        selectDisplayMapItem("marker", marker.id);
        renderDisplayPins();
        markDisplayMapChanged();
    } else if (displayMapEditing && ["rectangle", "ellipse", "line"].includes(displayMapTool)) {
        startDisplayMapShape(event, point, displayMapTool);
    } else if (!displayMapEditing || displayMapTool === "pan") {
        startDisplayMapPan(event);
    } else if (displayMapTool === "select") {
        selectedDisplayMapItem = null;
        syncDisplayMapEditingUI();
        renderDisplayPins();
        renderDisplayShapes();
    }
}

function applyDisplayMapTransform() {
    const wrapper = document.getElementById("map-img-wrapper");
    const zoomLabel = document.getElementById("display-map-zoom-level");
    if (wrapper) {
        wrapper.style.transform = `translate(${displayMapOffset.x}px, ${displayMapOffset.y}px) scale(${displayMapScale})`;
    }
    document.querySelectorAll(".display-map-pin").forEach((pin) => {
        pin.style.setProperty("--display-map-pin-scale", String(1 / displayMapScale));
    });
    if (zoomLabel) zoomLabel.textContent = `${Math.round(displayMapScale * 100)}%`;
}

function zoomDisplayMap(factor) {
    displayMapScale = Math.max(0.5, Math.min(6, displayMapScale * factor));
    applyDisplayMapTransform();
}

function resetDisplayMapView() {
    displayMapScale = 1;
    displayMapOffset = {x: 0, y: 0};
    applyDisplayMapTransform();
}

function setDisplayMapSaveStatus(message, isError = false) {
    const status = document.getElementById("display-map-save-status");
    if (status) {
        status.textContent = message;
        status.style.color = isError ? "#ff7777" : "#aaa";
    }
    const retry = document.getElementById("display-map-save-retry");
    if (retry) retry.style.display = isError && displayMapEditing ? "inline-block" : "none";
}

function markDisplayMapChanged() {
    const activeMap = currentDisplayMaps[currentActiveMapIndex];
    if (!activeMap) return;
    const mapKey = String(activeMap.id || activeMap.name || currentActiveMapIndex);
    pendingDisplayMapEdits.set(mapKey, {
        pins: serializeDisplayPins(currentDisplayPins),
        shapes: JSON.stringify(currentDisplayShapes),
    });
    setDisplayMapSaveStatus("Unsaved changes");
    if (displayMapSaveTimer) clearTimeout(displayMapSaveTimer);
    displayMapSaveTimer = setTimeout(saveDisplayMapEdits, 500);
}

async function retrySaveDisplayMap() {
    if (displayMapSaveTimer) clearTimeout(displayMapSaveTimer);
    await saveDisplayMapEdits();
}

async function saveDisplayMapEdits() {
    if (displayMapSaving) return;
    displayMapSaving = true;
    try {
        while (pendingDisplayMapEdits.size) {
            const [mapKey, annotations] = pendingDisplayMapEdits.entries().next().value;
            const latestResponse = await fetch("/api/campaign/world_maps");
            const latestData = await latestResponse.json();
            if (!latestResponse.ok) {
                throw new Error(latestData.message || latestData.error || "Could not reload maps before saving");
            }
            const latestMaps = latestData.records || [];
            const targetIndex = latestMaps.findIndex((map, index) =>
                String(map.id || map.name || index) === mapKey
            );
            const target = latestMaps[targetIndex];
            if (!target) throw new Error("This map was removed before its annotations could be saved");
            target.pins = annotations.pins;
            target.shapes = annotations.shapes;

            const response = await fetch("/api/campaign/world_maps", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({records: latestMaps}),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || result.error || `Save failed (${response.status})`);
            }
            if (pendingDisplayMapEdits.get(mapKey) === annotations) {
                pendingDisplayMapEdits.delete(mapKey);
            }
            currentDisplayMaps = result.records || latestMaps;
            const currentMapIndex = currentDisplayMaps.findIndex(map =>
                String(map.id || map.name) === String(activeMapId)
            );
            if (currentMapIndex !== -1) currentActiveMapIndex = currentMapIndex;
            setDisplayMapSaveStatus(
                pendingDisplayMapEdits.size ? "Saving changes…" : "All changes saved"
            );
        }
    } catch (error) {
        console.error("Failed to save map changes:", error);
        setDisplayMapSaveStatus(`Save failed: ${error.message}`, true);
    } finally {
        displayMapSaving = false;
    }
}

document.getElementById("display-map-viewport")?.addEventListener(
    "pointerdown", handleDisplayMapPointerDown
);
document.getElementById("display-map-viewport")?.addEventListener("wheel", (event) => {
    event.preventDefault();
    zoomDisplayMap(event.deltaY < 0 ? 1.1 : 0.9);
}, {passive: false});
document.getElementById("display-map-marker-label")?.addEventListener("input", (event) => {
    const marker = currentDisplayPins.find(
        pin => pin.id === selectedDisplayMapItem?.id
    );
    if (!marker) return;
    marker.label = event.target.value;
    const label = document.querySelector(
        `.display-map-pin[data-pin-index="${currentDisplayPins.indexOf(marker)}"] .display-map-pin-label`
    );
    if (label) label.textContent = marker.label || "Marker";
    markDisplayMapChanged();
});
document.getElementById("display-map-shape-color")?.addEventListener("input", (event) => {
    const shape = currentDisplayShapes.find(
        item => item.id === selectedDisplayMapItem?.id
    );
    if (!shape) return;
    shape.color = event.target.value;
    renderDisplayShapes();
    markDisplayMapChanged();
});
document.getElementById("display-map-shape-opacity")?.addEventListener("input", (event) => {
    const shape = currentDisplayShapes.find(
        item => item.id === selectedDisplayMapItem?.id
    );
    if (!shape) return;
    shape.opacity = Number(event.target.value);
    renderDisplayShapes();
    markDisplayMapChanged();
});
document.getElementById("display-map-shape-rotation")?.addEventListener("input", (event) => {
    const shape = currentDisplayShapes.find(
        item => item.id === selectedDisplayMapItem?.id
    );
    if (!shape) return;
    shape.rotation = Number(event.target.value);
    const value = document.getElementById("display-map-shape-rotation-value");
    if (value) value.textContent = `${shape.rotation}°`;
    renderDisplayShapes();
    markDisplayMapChanged();
});

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
        // Sort recaps by session_number descending (fallback to date parsing if missing)
        recaps.sort((a, b) => {
            const aNum = a.session_number !== undefined ? Number(a.session_number) : 0;
            const bNum = b.session_number !== undefined ? Number(b.session_number) : 0;
            if (aNum !== bNum) return bNum - aNum;
            // If session numbers are equal or missing, compare dates (assuming MM/DD/YYYY)
            const parseDate = (s) => {
                if (!s) return 0;
                const parts = s.split('/')
                    .map(p => parseInt(p, 10))
                    .filter(n => !isNaN(n));
                if (parts.length !== 3) return 0;
                const [m, d, y] = parts;
                return new Date(y, m - 1, d).getTime();
            };
            return parseDate(b.date) - parseDate(a.date);
        });
        // Take the most recent three recaps after sorting
        const recent = recaps.slice(0, 3);
        container.innerHTML = recent.map(r => `
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
