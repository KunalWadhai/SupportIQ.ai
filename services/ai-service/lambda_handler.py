"""
AWS Lambda entrypoint for the SupportIQ AI Service (FastAPI).

Uses Mangum to adapt ASGI → Lambda. Deploy as a **container image** (not zip)
because LangChain + document parsers exceed Lambda zip size limits.

Set AI_SERVICE_URL in api-gateway to the Lambda Function URL after deploy.
"""
from mangum import Mangum

from app.main import app

# lifespan="auto" runs FastAPI startup/shutdown on each cold start
handler = Mangum(app, lifespan="auto")
