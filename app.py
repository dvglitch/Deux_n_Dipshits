from pathlib import Path
import sys


PROJECT_ROOT = Path(__file__).resolve().parent
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from dnd_clock.app import app, socketio
from dnd_clock.utils import get_local_ip


if __name__ == "__main__":
    ip = get_local_ip()
    print("\nServer running at:")
    print("  Local:   http://localhost:5000")
    print(f"  Network: http://{ip}:5000\n")

    socketio.run(app, host="0.0.0.0", port=5000, debug=True, allow_unsafe_werkzeug=True)
