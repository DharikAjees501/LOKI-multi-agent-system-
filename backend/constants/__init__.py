"""
SWARMLENS / LOKI platform constants package.
Exposes error, success, and message constants across the codebase.
"""

import os
import sys

# Ensure backend root is always on sys.path for robust absolute imports
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from . import error
from . import success
from . import message

__all__ = ["error", "success", "message"]
