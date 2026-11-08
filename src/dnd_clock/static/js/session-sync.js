window.registerSessionSync = function (socket) {
    let banner;

    function showStatus(message, isError) {
        if (!banner) {
            banner = document.createElement("div");
            banner.id = "session-sync-status";
            banner.style.cssText = [
                "position:fixed",
                "top:10px",
                "left:50%",
                "transform:translateX(-50%)",
                "z-index:10000",
                "padding:10px 16px",
                "border-radius:8px",
                "font:600 14px Inter,sans-serif",
                "box-shadow:0 4px 16px rgba(0,0,0,0.5)",
            ].join(";");
            document.body.appendChild(banner);
        }

        banner.textContent = message;
        banner.style.background = isError ? "#8b2525" : "#245d3a";
        banner.style.color = "#fff";
        banner.style.display = "block";
    }

    socket.on("session_error", (data) => {
        showStatus(data?.message || "Session sync failed. Changes may not be saved.", true);
    });

    socket.on("session_status", (data) => {
        if (!data.persistence_available) {
            showStatus("Session storage unavailable. Changes may not be saved.", true);
        } else if (banner) {
            banner.style.display = "none";
        }
    });

    socket.on("connect", () => socket.emit("sync_state"));
    window.setInterval(() => {
        if (socket.connected) socket.emit("sync_state");
    }, 2000);
};
