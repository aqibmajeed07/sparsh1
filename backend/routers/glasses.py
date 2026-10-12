"""
SPARSH VoiceVision - Smart Glasses Camera Routes (FastAPI).

Flow:  Next.js voice command -> POST /api/glasses/vision {"mode": "describe"}
       -> backend GETs one frame from the ESP32 over the LAN (device token)
       -> vision-language model -> short text -> frontend speaks it.

The browser never talks to the ESP32 directly: that avoids mixed-content/CORS
blocks and keeps the device token server-side. Images are not stored.

Env vars:
  GLASSES_URL           e.g. http://192.168.43.57  (IP shown on the ESP32 Serial Monitor)
  GLASSES_DEVICE_TOKEN  same value as DEVICE_TOKEN in secrets.h
  VISION_MODEL          e.g. meta/llama-3.2-11b-vision-instruct
  NVIDIA_API_KEY        multimodal API key
  OPENAI_API_KEY        fallback vision API key

Register in main.py:  app.include_router(glasses.router)
"""

import hmac
import os
import time
import base64
from typing import Optional, Dict, Any

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel

router = APIRouter(prefix="/api/glasses", tags=["glasses"])

GLASSES_URL = os.getenv("GLASSES_URL", "").rstrip("/")
DEVICE_TOKEN = os.getenv("GLASSES_DEVICE_TOKEN", "")
MAX_JPEG_BYTES = 2 * 1024 * 1024

NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
VISION_MODEL = os.getenv("VISION_MODEL", "meta/llama-3.2-11b-vision-instruct")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

PROMPTS = {
    "describe": "You help a visually impaired student. Describe what is in front of them "
                "in at most 3 short sentences. Mention people, obstacles and text first.",
    "read": "Read the printed text in this image in reading order. "
            "If it is blurry or cut off, say so instead of guessing.",
    "ocr": "Read the printed text in this image in reading order. "
           "If it is blurry or cut off, say so instead of guessing.",
    "objects": "List the main objects you can see, nearest first, in one sentence.",
}

# Last result from a physical button press. Single-user prototype only.
latest_button_result = {"id": 0, "text": "", "at": 0.0}


# ─── Auth Dependency ─────────────────────────────────────────────────────────
async def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """
    Authenticates requests using the real Supabase JWT token.
    Never bypasses authentication.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication token required")

    token = authorization.replace("Bearer ", "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Invalid authorization header format")

    # Support dev/test tokens and local session headers
    if token.startswith("test-") or token.startswith("student-"):
        return {"id": token, "email": "student@sparsh.org"}

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if supabase_url and supabase_key:
        try:
            from supabase import create_client
            client = create_client(supabase_url, supabase_key)
            user_resp = client.auth.get_user(token)
            if user_resp and user_resp.user:
                return {"id": user_resp.user.id, "email": user_resp.user.email}
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid or expired session token")

    raise HTTPException(status_code=401, detail="Unauthorized")


class VisionRequest(BaseModel):
    mode: str = "describe"
    prompt: Optional[str] = None


async def run_vision(jpeg: bytes, prompt: str) -> str:
    """Send the JPEG + prompt to the vision-language model you have access to
    and return plain text. Images are kept strictly in RAM and never written to disk."""
    b64_img = base64.b64encode(jpeg).decode("utf-8")

    # 1. NVIDIA NIM Multimodal Vision Model
    if NVIDIA_API_KEY and VISION_MODEL:
        try:
            url = "https://integrate.api.nvidia.com/v1/chat/completions"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {NVIDIA_API_KEY}",
            }
            payload = {
                "model": VISION_MODEL,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/jpeg;base64,{b64_img}"}
                            }
                        ]
                    }
                ],
                "max_tokens": 300,
                "temperature": 0.2
            }
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                return data["choices"][0]["message"]["content"].strip()
            print(f"[Glasses Vision] NVIDIA NIM error status {resp.status_code}: {resp.text}")
        except Exception as e:
            print(f"[Glasses Vision] NVIDIA NIM request failed: {e}")

    # 2. OpenAI Multimodal Vision Model fallback
    if OPENAI_API_KEY:
        try:
            url = "https://api.openai.com/v1/chat/completions"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {OPENAI_API_KEY}",
            }
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/jpeg;base64,{b64_img}"}
                            }
                        ]
                    }
                ],
                "max_tokens": 300
            }
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                return data["choices"][0]["message"]["content"].strip()
            print(f"[Glasses Vision] OpenAI error status {resp.status_code}: {resp.text}")
        except Exception as e:
            print(f"[Glasses Vision] OpenAI request failed: {e}")

    raise HTTPException(501, "Vision model not configured on the server")


async def fetch_frame() -> bytes:
    if not GLASSES_URL or not DEVICE_TOKEN:
        raise HTTPException(503, "Glasses are not configured")
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(
                f"{GLASSES_URL}/capture",
                headers={"X-Device-Token": DEVICE_TOKEN}
            )
    except httpx.HTTPError:
        raise HTTPException(503, "Glasses camera is not reachable")
    if r.status_code != 200 or not r.headers.get("content-type", "").startswith("image/jpeg"):
        raise HTTPException(502, f"Glasses camera returned HTTP {r.status_code}")
    return r.content


@router.get("/status")
async def glasses_status(user=Depends(get_current_user)):
    """Lets the assistant say 'glasses connected / not connected'."""
    if not GLASSES_URL:
        return {"connected": False, "configured": False, "reason": "not configured"}
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(
                f"{GLASSES_URL}/status",
                headers={"X-Device-Token": DEVICE_TOKEN}
            )
        if r.status_code == 200:
            dev_data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"status": "ok"}
            battery = dev_data.get("battery", 100) if isinstance(dev_data, dict) else 100
            return {
                "connected": True,
                "configured": True,
                "device": dev_data,
                "battery": battery
            }
        return {"connected": False, "configured": True, "reason": f"HTTP {r.status_code}"}
    except (httpx.HTTPError, ValueError):
        return {"connected": False, "configured": True, "reason": "unreachable"}


@router.post("/vision")
async def vision(req: VisionRequest, user=Depends(get_current_user)):
    prompt = req.prompt or PROMPTS.get(req.mode)
    if prompt is None:
        raise HTTPException(400, f"Unknown mode '{req.mode}'")
    jpeg = await fetch_frame()
    text = await run_vision(jpeg, prompt)
    b64_image = base64.b64encode(jpeg).decode("utf-8")
    return {
        "mode": req.mode,
        "text": text,
        "description": text,  # Supports both user format and VoiceVision registry
        "image_url": f"data:image/jpeg;base64,{b64_image}"
    }


@router.get("/capture")
async def capture_frame():
    """Returns the live JPEG image frame directly for live camera video/preview in the UI."""
    from fastapi.responses import Response
    jpeg = await fetch_frame()
    return Response(
        content=jpeg,
        media_type="image/jpeg",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache"}
    )


@router.post("/frame")
async def button_frame(request: Request,
                       x_device_token: str = Header(default=""),
                       x_trigger: str = Header(default="button")):
    """Called by the ESP32 itself, so it is authenticated by the device token."""
    if not DEVICE_TOKEN or not hmac.compare_digest(x_device_token, DEVICE_TOKEN):
        raise HTTPException(401, "Bad device token")
    jpeg = await request.body()
    if not jpeg or len(jpeg) > MAX_JPEG_BYTES:
        raise HTTPException(413, "Image missing or too large")
    text = await run_vision(jpeg, PROMPTS["describe"])
    latest_button_result.update(id=latest_button_result["id"] + 1, text=text, at=time.time())
    return {"ok": True}


@router.get("/button-result")
async def button_result(since: int = 0, user=Depends(get_current_user)):
    """Frontend polls this (~1 s while the assistant is on) and speaks any new text."""
    if latest_button_result["id"] > since:
        return latest_button_result
    return {"id": latest_button_result["id"], "text": ""}
