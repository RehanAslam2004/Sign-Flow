"""
Cross-platform startup runner for SignFlow CV service.
Used by root npm run dev via concurrently.
"""

import sys
import os
import subprocess

def main():
    service_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(service_dir)
    print("--------------------------------------------------")
    print("Starting SignFlow CV Service (FastAPI + WebSocket)")
    print("Directory:", service_dir)
    print("--------------------------------------------------")

    # Determine Python executable (prefer .venv if available)
    venv_python = (
        os.path.join(service_dir, ".venv", "Scripts", "python.exe")
        if os.name == "nt"
        else os.path.join(service_dir, ".venv", "bin", "python")
    )
    python_bin = venv_python if os.path.exists(venv_python) else sys.executable

    # Determine port and host (supports Render $PORT and cloud deployment)
    port = os.environ.get("PORT", "8000")
    is_cloud = "PORT" in os.environ or os.environ.get("RENDER") == "true"
    host = os.environ.get("HOST", "0.0.0.0" if is_cloud else "127.0.0.1")

    cmd = [
        python_bin,
        "-m",
        "uvicorn",
        "main:app",
        "--host",
        host,
        "--port",
        str(port)
    ]
    if not is_cloud:
        cmd.append("--reload")
    try:
        subprocess.run(cmd, check=True)
    except KeyboardInterrupt:
        print("\nSignFlow CV Service stopped.")
    except Exception as e:
        print(f"\nFailed to start CV Service: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
