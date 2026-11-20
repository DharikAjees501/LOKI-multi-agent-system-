import sys
import os

# Add the backend directory to Python sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from app.main import app

# Export app instance for Vercel ASGI runtime (main:app)
app = app

