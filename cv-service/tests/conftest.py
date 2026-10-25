import os
import sys

# Ensure cv-service root directory is on sys.path for test imports
cv_service_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if cv_service_dir not in sys.path:
    sys.path.insert(0, cv_service_dir)
