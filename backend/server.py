from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os
import asyncio

app = FastAPI(title="ToolStack API Gateway")

# CORS configuration - must not use "*" with credentials=True
ALLOWED_ORIGINS = [
    "https://route-guardian-9.preview.emergentagent.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# CRM Backend URL
CRM_BACKEND_URL = os.getenv("CRM_BACKEND_URL", "http://localhost:8002")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "ToolStack API Gateway",
        "crm_backend": CRM_BACKEND_URL
    }

@app.get("/api/health")
async def api_health():
    """API health check with backend status"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{CRM_BACKEND_URL}/api/crm/health", timeout=5.0)
            backend_status = response.json() if response.status_code == 200 else {"error": "Backend unreachable"}
    except Exception as e:
        backend_status = {"error": str(e)}
    
    return {
        "status": "ok",
        "gateway": "running",
        "backend": backend_status
    }

@app.api_route("/api/crm/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy_to_crm(path: str, request: Request):
    """Proxy all /api/crm/* requests to Node CRM backend"""
    try:
        # Get request details
        method = request.method
        headers = dict(request.headers)
        
        # Remove host header to avoid conflicts
        headers.pop("host", None)
        
        # Get body if present
        body = await request.body()
        
        # Forward request to CRM backend
        url = f"{CRM_BACKEND_URL}/api/crm/{path}"
        
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method=method,
                url=url,
                headers=headers,
                content=body,
                params=request.query_params,
                timeout=30.0
            )
            
            # Return response
            return Response(
                content=response.content,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.headers.get("content-type")
            )
    except httpx.TimeoutException:
        return JSONResponse(
            status_code=504,
            content={"error": "Backend timeout"}
        )
    except Exception as e:
        return JSONResponse(
            status_code=502,
            content={"error": f"Proxy error: {str(e)}"}
        )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
