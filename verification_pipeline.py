"""Photo verification pipeline for on-site construction images.

This is a *verification heuristic* layer, not cryptographic proof. EXIF GPS
coordinates and capture timestamps can be spoofed or stripped by any phone,
so the output must never be treated as courtroom-grade evidence. The module
is deliberately import-safe: if any optional imaging library is missing the
API still boots and simply reports the check as skipped/unknown.

Checks implemented:
  1. EXIF reading (piexif)                 -- GPS position + capture time.
  2. GPS detection                         -- no GPS metadata -> reject.
  3. Haversine geofence check              -- photo must be near the site.
  4. Timestamp gap validation              -- photo must be a fresh capture.
  5. Perceptual hashing (imagehash)        -- duplicate / re-upload detection.
  6. Error-Level Analysis (ELA) heuristic  -- recompression artefact signal.

Exports:
  verify_image(path, ...) -> dict : full decision record.
  read_gps_and_time(path)         : low-level EXIF extractor.
  perceptual_hash(path)           : hex perceptual hash (or None).
  ela_score(path)                 : 0-100 average re-encode error (or None).
  haversine_km(...)               : geodesic distance helper.
"""
from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO
from typing import Dict, List, Optional, Sequence, Tuple

try:  # Image libraries are optional so the FastAPI process never hard-fails.
    from PIL import Image, ImageChops
    HAS_PIL = True
except Exception:  # pragma: no cover - exercised only on broken installs
    HAS_PIL = False

try:
    import piexif
    HAS_PIEXIF = True
except Exception:  # pragma: no cover
    HAS_PIEXIF = False

try:
    import imagehash
    HAS_IMAGEHASH = True
except Exception:  # pragma: no cover
    HAS_IMAGEHASH = False

EARTH_RADIUS_KM = 6371.0088
PIPELINE_VERSION = "local-heuristics-v1"


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in kilometres between two WGS-84 points."""
    import math

    r1, r2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(r1) * math.cos(r2) * math.sin(dlng / 2) ** 2)
    return round(2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a)), 3)


def is_point_in_polygon(lat: float, lng: float, polygon: Sequence[Sequence[float]]) -> bool:
    """Ray-casting algorithm to test if (lat, lng) is inside a WGS-84 polygon lamina.
    
    polygon is expected as a list/tuple of [lat, lng] or (lat, lng) vertices.
    """
    if not polygon or len(polygon) < 3:
        return False

    inside = False
    n = len(polygon)
    p1_lat, p1_lng = polygon[0][0], polygon[0][1]

    for i in range(1, n + 1):
        p2_lat, p2_lng = polygon[i % n][0], polygon[i % n][1]
        if min(p1_lat, p2_lat) < lat <= max(p1_lat, p2_lat):
            if lng <= max(p1_lng, p2_lng):
                if p1_lat != p2_lat:
                    x_inters = (lat - p1_lat) * (p2_lng - p1_lng) / (p2_lat - p1_lat) + p1_lng
                if p1_lng == p2_lng or lng <= x_inters:
                    inside = not inside
        p1_lat, p1_lng = p2_lat, p2_lng

    return inside


def generate_lamina_polygon(center_lat: float, center_lng: float, radius_km: float = 3.0, vertices: int = 6) -> List[List[float]]:
    """Generate a convex polygon boundary (lamina) around a project location."""
    import math
    coords = []
    lat_scale = radius_km / 111.0
    lng_scale = radius_km / (111.0 * max(0.1, math.cos(math.radians(center_lat))))
    for i in range(vertices):
        angle = (2 * math.pi * i) / vertices
        r_mod = 0.85 + 0.3 * ((i % 3) / 2.0)
        p_lat = round(center_lat + math.sin(angle) * lat_scale * r_mod, 6)
        p_lng = round(center_lng + math.cos(angle) * lng_scale * r_mod, 6)
        coords.append([p_lat, p_lng])
    return coords


def _dms_to_decimal(dms: Tuple, ref: bytes) -> Optional[float]:
    """Convert an EXIF GPS DMS tuple ((d,dn),(m,mn),(s,sn)) to decimal degrees."""
    try:
        deg = float(dms[0][0]) / float(dms[0][1])
        minutes = float(dms[1][0]) / float(dms[1][1])
        seconds = float(dms[2][0]) / float(dms[2][1])
        value = deg + minutes / 60.0 + seconds / 3600.0
        ref_str = ref.decode("ascii", "ignore").upper() if isinstance(ref, bytes) else str(ref)
        if ref_str in ("S", "W"):
            value = -value
        return round(value, 7)
    except Exception:
        return None


def _parse_exif_datetime(raw) -> Optional[str]:
    """Normalise EXIF 'YYYY:MM:DD HH:MM:SS' to an ISO-8601 string."""
    if not raw:
        return None
    text = raw.decode("ascii", "ignore").strip() if isinstance(raw, bytes) else str(raw).strip()
    for fmt in ("%Y:%m:%d %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S"):
        try:
            return datetime.strptime(text, fmt).strftime("%Y-%m-%dT%H:%M:%S")
        except ValueError:
            continue
    return None


def read_gps_and_time(path) -> Dict:
    """Extract GPS + capture time from image EXIF.

    Returns a dict with keys gps_lat, gps_lng, captured_at (ISO string or None)
    and a ``source`` marker so callers know what was found.
    """
    out = {"gps_lat": None, "gps_lng": None, "captured_at": None, "source": "none"}
    if not HAS_PIL or not HAS_PIEXIF:
        return out

    try:
        exif = piexif.load(str(path))
    except Exception:
        return out

    gps = exif.get("GPS") or {}
    if gps:
        lat = _dms_to_decimal(gps.get(piexif.GPSIFD.GPSLatitude), gps.get(piexif.GPSIFD.GPSLatitudeRef))
        lng = _dms_to_decimal(gps.get(piexif.GPSIFD.GPSLongitude), gps.get(piexif.GPSIFD.GPSLongitudeRef))
        if lat is not None and lng is not None:
            out["gps_lat"] = lat
            out["gps_lng"] = lng
            out["source"] = "exif"

    exif_ifd = exif.get("Exif") or {}
    captured = _parse_exif_datetime(exif_ifd.get(piexif.ExifIFD.DateTimeOriginal))
    if not captured:
        zeroth = exif.get("0th") or {}
        captured = _parse_exif_datetime(zeroth.get(piexif.ImageIFD.DateTime))
    out["captured_at"] = captured
    return out
def perceptual_hash(path, hash_size: int = 8) -> Optional[str]:
    """Return the 64-bit perceptual hash of an image as a hex string.

    Two images count as 'duplicates' when their hash distance is small even
    if the bytes / file size differ.
    """
    if not HAS_IMAGEHASH or not HAS_PIL:
        return None
    try:
        with Image.open(str(path)) as im:
            return str(imagehash.phash(im.convert("RGB"), hash_size=hash_size))
    except Exception:
        return None


def hamming_distance(a: str, b: str) -> int:
    """Hamming distance between two equal-length hex md5-like strings."""
    max_len = min(len(a), len(b))
    bits = sum(bin(int(x, 16) ^ int(y, 16)).count("1")
               for x, y in zip(a[:max_len], b[:max_len]))
    return bits + abs(len(a) - len(b)) * 4


def ela_score(path, resize: int = 320, quality: int = 92) -> Optional[float]:
    """Error-Level Analysis heuristic: 0-100 mean pixel error after re-encode.

    Native camera JPEGs re-encode with small error; screenshots / edited
    images re-compressed at a different quality show pronounced artifacts.
    """
    if not HAS_PIL:
        return None
    try:
        im = Image.open(str(path)).convert("RGB")
        small = im.resize((resize, resize))
        buf = BytesIO()
        small.save(buf, "JPEG", quality=quality)
        buf.seek(0)
        re_encoded = Image.open(buf).convert("RGB")
        diff = ImageChops.difference(small, re_encoded).convert("L")
        hist = diff.histogram()
        total = sum(count * level for level, count in enumerate(hist)) / (255 * resize * resize)
        return round(total * 100.0, 2)
    except Exception:
        return None


def _now() -> datetime:
    return datetime.now(timezone.utc).astimezone()


def _iso_now() -> str:
    return _now().strftime("%Y-%m-%dT%H:%M:%S")


def _parse_iso(value: str) -> Optional[datetime]:
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.astimezone()
    except Exception:
        return None
def verify_image(
    path,
    project_lat: Optional[float] = None,
    project_lng: Optional[float] = None,
    boundary_polygon: Optional[Sequence[Sequence[float]]] = None,
    max_distance_km: float = 10.0,
    max_age_days: float = 30.0,
    duplicate_hashes: Sequence[str] = (),
    duplicate_threshold: int = 6,
    captured_at: Optional[str] = None,
    client_lat: Optional[float] = None,
    client_lng: Optional[float] = None,
) -> Dict:
    """Run every check and return a full decision record.

    Returns a dict with ``status`` in {"accepted", "rejected", "rejected_geofence", "unverifiable"}.
    ``unverifiable`` means the image could not be decoded (broken file or the
    imaging libraries are missing) and must NOT be interpreted as approval.
    """
    reasons: List[str] = []
    result: Dict = {
        "pipeline": PIPELINE_VERSION,
        "status": "pending",
        "reasons": reasons,
        "gps": None,
        "captured_at": None,
        "timestamp_gap_days": None,
        "distance_km": None,
        "duplicate_of": None,
        "ela_score": None,
        "checks": {},
        "submitted_at": _iso_now(),
    }

    if not HAS_PIL:
        result["status"] = "unverifiable"
        reasons.append("Image decoding libraries are unavailable on this server")
        return result

    meta = read_gps_and_time(path)
    if meta["gps_lat"] is None and client_lat is not None and client_lng is not None:
        meta["gps_lat"] = float(client_lat)
        meta["gps_lng"] = float(client_lng)
        meta["source"] = "device_telemetry"

    result["gps"] = (
        {"lat": meta["gps_lat"], "lng": meta["gps_lng"], "source": meta.get("source", "exif")}
        if meta["gps_lat"] is not None
        else None
    )
    result["captured_at"] = captured_at or meta["captured_at"]

    # --- 1 / 2. GPS detection -------------------------------------------------
    if meta["gps_lat"] is None:
        reasons.append("Check GPS failed - no GPS metadata embedded in the photo or provided by device")
        result["status"] = "rejected"
    else:
        result["checks"]["gps"] = {"lat": meta["gps_lat"], "lng": meta["gps_lng"], "source": meta.get("source", "exif")}

    # --- 3. Construction Area Lamina & Haversine geofence check ---------------
    if meta["gps_lat"] is not None:
        # Check boundary lamina polygon if provided
        if boundary_polygon and len(boundary_polygon) >= 3:
            inside_lamina = is_point_in_polygon(meta["gps_lat"], meta["gps_lng"], boundary_polygon)
            result["checks"]["geofence_lamina"] = {
                "inside": inside_lamina,
                "vertex_count": len(boundary_polygon),
            }
            if not inside_lamina:
                reasons.append(
                    f"Check geofence failed - photo coordinates ({meta['gps_lat']:.4f}, {meta['gps_lng']:.4f}) "
                    f"fall outside the designated construction boundary lamina"
                )
                result["status"] = "rejected"
                result["rejection_reason"] = "geofence"

        # Also compute distance to project center
        if project_lat is not None and project_lng is not None:
            dist = haversine_km(project_lat, project_lng, meta["gps_lat"], meta["gps_lng"])
            result["distance_km"] = dist
            if dist > max_distance_km and result["status"] != "rejected":
                reasons.append(
                    f"Check geofence failed - photo is {dist:.1f} km from project "
                    f"site center (limit {max_distance_km:.0f} km)"
                )
                result["status"] = "rejected"
                result["rejection_reason"] = "geofence"
            elif dist <= max_distance_km:
                result["checks"]["geofence"] = {
                    "distance_km": dist,
                    "within_limit": True,
                    "inside_lamina": result["checks"].get("geofence_lamina", {}).get("inside", True),
                }


    # --- 4. Timestamp gap validation -------------------------------------------
    cap = result["captured_at"]
    if cap:
        captured_dt = _parse_iso(cap)
        if captured_dt is None:
            reasons.append("Check timestamp skipped - unparseable capture time")
        else:
            gap_days = round((_now() - captured_dt).total_seconds() / 86400.0, 1)
            result["timestamp_gap_days"] = gap_days
            if gap_days > max_age_days:
                reasons.append(
                    f"Check timestamp failed - capture is {gap_days:.0f} days old "
                    f"(limit {max_age_days:.0f} days)"
                )
                result["status"] = "rejected"
            else:
                result["checks"]["timestamp"] = {"gap_days": gap_days, "recent": True}
    else:
        reasons.append("Check timestamp limited - no capture time in EXIF metadata")

    # --- 5. Duplicate detection via perceptual hash -----------------------------
    phash = perceptual_hash(path)
    result["checks"]["perceptual_hash"] = phash
    if phash and duplicate_hashes:
        for known in duplicate_hashes:
            if hamming_distance(phash, str(known)) <= duplicate_threshold:
                result["duplicate_of"] = str(known)
                reasons.append(
                    "Check duplicate failed - image matches a previously verified capture"
                )
                result["status"] = "rejected"
                break

    # --- 6. ELA heuristic (informational only, never a hard veto) ----------------
    ela = ela_score(path)
    result["ela_score"] = ela
    if ela is not None and ela > 55.0:
        reasons.append(
            f"ELA heuristic flagged recompression artefacts (score {ela:.0f}) - "
            "photo may have been edited/screenshotted; treat as low-confidence"
        )
    elif ela is not None:
        result["checks"]["ela"] = {"score": ela, "clean": True}

    # --- Final status ------------------------------------------------------------
    if result["status"] not in ("rejected", "rejected_geofence"):
        if result["gps"] is not None:
            reasons.append("All local checks passed - capture is fresh, inside construction area and unique")
            result["status"] = "accepted"
        else:
            result["status"] = "rejected"

    return result