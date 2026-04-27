import os
import pytest

# Stub environment variables so the app can import without real credentials
os.environ.setdefault("OPENAI_API_KEY", "sk-test-key-for-unit-tests")
os.environ.setdefault("QDRANT_URL", "http://localhost:6333")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
