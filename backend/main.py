"""
VehicleGuard Backend - FastAPI
Run: uvicorn main:app --reload --host 0.0.0.0 --port 8000
Install: pip install fastapi uvicorn python-multipart torch torchvision pillow deepface tf-keras
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import torch
import torch.nn as nn
from torchvision import transforms, models
from PIL import Image
import io, base64, time, json, os
from datetime import datetime
from deepface import DeepFace
import numpy as np

app = FastAPI(title="VehicleGuard API", version="1.0.0")

# Allow React frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load drowsiness model once at startup ─────────────────────
MODEL_PATH = r"C:\my_project\results\best_model.pth"
DEVICE = torch.device("cpu")

print("Loading drowsiness model...", flush=True)
drowsiness_model = models.mobilenet_v3_small(weights=None)
drowsiness_model.classifier[3] = nn.Linear(
    drowsiness_model.classifier[3].in_features, 2)
drowsiness_model.load_state_dict(
    torch.load(MODEL_PATH, map_location=DEVICE))
drowsiness_model.eval()
print("Model loaded successfully.", flush=True)

transform = transforms.Compose([
    transforms.Resize((128, 128)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406],
                         [0.229, 0.224, 0.225]),
])

# ── In-memory alert log (replace with MongoDB later) ──────────
alert_log = []
owner_face_path = None  # Set via /register-owner endpoint

# ── Simulated GPS (replace with real GPS module later) ────────
def get_simulated_gps():
    # Dehradun coordinates with small random offset
    base_lat, base_lng = 30.3165, 78.0322
    return {
        "lat": base_lat + np.random.uniform(-0.005, 0.005),
        "lng": base_lng + np.random.uniform(-0.005, 0.005),
        "timestamp": datetime.now().isoformat(),
        "address": "Dehradun, Uttarakhand, India"
    }

# ── Routes ─────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "VehicleGuard API running", "version": "1.0.0"}

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model_loaded": True,
        "owner_registered": owner_face_path is not None,
        "total_alerts": len(alert_log)
    }

@app.post("/detect-drowsiness")
async def detect_drowsiness(file: UploadFile = File(...)):
    """
    Accepts a camera frame (image file).
    Returns drowsiness prediction and confidence.
    """
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        tensor = transform(image).unsqueeze(0).to(DEVICE)

        start = time.perf_counter()
        with torch.no_grad():
            output = drowsiness_model(tensor)
            probs  = torch.softmax(output, dim=1)[0]
        latency_ms = (time.perf_counter() - start) * 1000

        drowsy_prob = float(probs[1])
        alert_prob  = float(probs[0])
        is_drowsy   = drowsy_prob > 0.5

        # Determine risk level
        if drowsy_prob >= 0.85:
            risk_level = "CRITICAL"
        elif drowsy_prob >= 0.5:
            risk_level = "DROWSY"
        else:
            risk_level = "ALERT"

        # Log if drowsy
        if is_drowsy:
            alert_log.append({
                "type"       : "DROWSINESS",
                "risk_level" : risk_level,
                "confidence" : round(drowsy_prob * 100, 1),
                "timestamp"  : datetime.now().isoformat(),
                "gps"        : get_simulated_gps()
            })

        return {
            "is_drowsy"    : is_drowsy,
            "risk_level"   : risk_level,
            "drowsy_prob"  : round(drowsy_prob * 100, 1),
            "alert_prob"   : round(alert_prob * 100, 1),
            "latency_ms"   : round(latency_ms, 2),
            "timestamp"    : datetime.now().isoformat()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/register-owner")
async def register_owner(file: UploadFile = File(...)):
    """
    Register the vehicle owner's face for security verification.
    """
    global owner_face_path
    try:
        contents = await file.read()
        os.makedirs("owner_data", exist_ok=True)
        owner_face_path = "owner_data/owner_face.png"
        with open(owner_face_path, "wb") as f:
            f.write(contents)
        return {
            "success": True,
            "message": "Owner face registered successfully",
            "path": owner_face_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/verify-driver")
async def verify_driver(file: UploadFile = File(...)):
    """
    Verify if the person in the vehicle is the registered owner.
    Triggers alert protocol if unknown person detected.
    """
    global owner_face_path

    if not owner_face_path or not os.path.exists(owner_face_path):
        raise HTTPException(
            status_code=400,
            detail="No owner face registered. Call /register-owner first.")

    try:
        contents = await file.read()
        unknown_face_path = "owner_data/unknown_face.png"
        with open(unknown_face_path, "wb") as f:
            f.write(contents)

        result = DeepFace.verify(
            img1_path=owner_face_path,
            img2_path=unknown_face_path,
            enforce_detection=False
        )

        is_owner   = result["verified"]
        distance   = round(result["distance"], 4)
        threshold  = result["threshold"]
        gps        = get_simulated_gps()

        # Read captured image as base64 for frontend display
        with open(unknown_face_path, "rb") as f:
            img_b64 = base64.b64encode(f.read()).decode()

        if not is_owner:
            alert_entry = {
                "type"      : "INTRUDER_DETECTED",
                "distance"  : distance,
                "timestamp" : datetime.now().isoformat(),
                "gps"       : gps,
                "image_b64" : img_b64
            }
            alert_log.append(alert_entry)

        return {
            "is_owner"       : is_owner,
            "distance"       : distance,
            "threshold"      : threshold,
            "confidence_pct" : round((1 - distance) * 100, 1),
            "gps"            : gps,
            "intruder_image" : img_b64 if not is_owner else None,
            "alert_triggered": not is_owner,
            "timestamp"      : datetime.now().isoformat()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/alerts")
def get_alerts():
    """Get all alerts sorted by most recent first."""
    return {
        "total"  : len(alert_log),
        "alerts" : list(reversed(alert_log[-50:]))
    }

@app.delete("/alerts")
def clear_alerts():
    """Clear all alerts."""
    alert_log.clear()
    return {"success": True, "message": "All alerts cleared"}

@app.get("/gps")
def get_gps():
    """Get current vehicle GPS location."""
    return get_simulated_gps()

@app.get("/stats")
def get_stats():
    """Get summary statistics for dashboard."""
    drowsy_alerts   = [a for a in alert_log if a["type"] == "DROWSINESS"]
    intruder_alerts = [a for a in alert_log if a["type"] == "INTRUDER_DETECTED"]
    critical_alerts = [a for a in alert_log
                      if a.get("risk_level") == "CRITICAL"]
    return {
        "total_alerts"      : len(alert_log),
        "drowsiness_alerts" : len(drowsy_alerts),
        "intruder_alerts"   : len(intruder_alerts),
        "critical_alerts"   : len(critical_alerts),
        "owner_registered"  : owner_face_path is not None,
    }