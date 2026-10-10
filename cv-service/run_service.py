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

    # Run uvicorn on port 8000
    cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "main:app",
        "--host",
        "127.0.0.1",
        "--port",
        "8000",
        "--reload"
    ]
    try:
        subprocess.run(cmd, check=True)
    except KeyboardInterrupt:
        print("\nSignFlow CV Service stopped.")
    except Exception as e:
        print(f"\nFailed to start CV Service: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
