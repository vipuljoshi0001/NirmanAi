"""Deterministic mock map data for the NIRMAN-AI interactive project map.

The live ``project_monitoring.db`` carries project rows WITHOUT geographic
coordinates, and we intentionally avoid paid geocoding APIs. This module
supplies:

  * ``STATE_CENTROIDS`` -- official state/UT capital coordinates so any DB
    project state can be placed on the Leaflet map.
  * ``MAP_PROJECTS``  -- 20 realistic demo projects across Indian states/UTs
    that always render even if the backend is empty or offline.
  * ``coordinates_for()`` -- deterministic pseudo-random jitter around a
    state centroid derived from the project id (same id -> same point).

Nothing here touches the ML models; it is display/demo data only.
"""
from __future__ import annotations

import random
from typing import Dict, List, Optional, Tuple

# State / UT name -> [lat, lng] of the capital / economically-active centre.
STATE_CENTROIDS: Dict[str, List[float]] = {
    "Andaman & Nicobar": [11.667, 92.736],
    "Andhra Pradesh": [16.506, 80.648],
    "Arunachal Pradesh": [27.083, 93.616],
    "Assam": [26.144, 91.736],
    "Bihar": [25.609, 85.123],
    "Chandigarh": [30.733, 76.779],
    "Chhattisgarh": [21.278, 81.866],
    "Dadra & Nagar Haveli and Daman & Diu": [20.398, 72.834],
    "Delhi": [28.704, 77.102],
    "Goa": [15.491, 73.818],
    "Gujarat": [23.242, 72.628],
    "Haryana": [29.058, 76.086],
    "Himachal Pradesh": [31.104, 77.173],
    "Jammu & Kashmir": [33.778, 76.576],
    "Jharkhand": [23.344, 85.315],
    "Karnataka": [12.972, 77.595],
    "Kerala": [8.524, 76.936],
    "Ladakh": [34.153, 77.577],
    "Lakshadweep": [10.578, 72.639],
    "Madhya Pradesh": [23.259, 77.412],
    "Maharashtra": [19.076, 72.878],
    "Manipur": [24.817, 93.937],
    "Meghalaya": [25.578, 91.893],
    "Mizoram": [23.164, 92.938],
    "Nagaland": [25.676, 94.109],
    "Odisha": [20.297, 85.824],
    "Puducherry": [11.941, 79.808],
    "Punjab": [30.901, 75.857],
    "Rajasthan": [26.912, 75.787],
    "Sikkim": [27.339, 88.614],
    "Tamil Nadu": [13.083, 80.270],
    "Telangana": [17.385, 78.487],
    "Tripura": [23.831, 91.287],
    "Uttar Pradesh": [26.846, 80.946],
    "Uttarakhand": [30.316, 78.032],
    "West Bengal": [22.572, 88.364],
}
# Alias normalisation so 'Maharashtra / Gujarat', 'andaman and nicobar islands'
# etc. still resolve to a usable centroid.
STATE_ALIASES: Dict[str, str] = {
    "andaman and nicobar islands": "Andaman & Nicobar",
    "jammu and kashmir": "Jammu & Kashmir",
    "dadra and nagar haveli": "Dadra & Nagar Haveli and Daman & Diu",
    "dadra & nagar haveli": "Dadra & Nagar Haveli and Daman & Diu",
    "daman and diu": "Dadra & Nagar Haveli and Daman & Diu",
    "orissa": "Odisha",
    "pondicherry": "Puducherry",
    "nct of delhi": "Delhi",
    "delhi nct": "Delhi",
}

# 20 realistic demo projects used when the backend map payload is unavailable.
# ``risk_score`` follows the same 0-100 convention as the XGBoost composite.
MAP_PROJECTS: List[dict] = [
    {"id": "DM-MH-001", "name": "Mumbai Coastal Road -- North Extension",
     "state": "Maharashtra", "sector": "Roads & Highways", "lat": 19.012, "lng": 72.831,
     "cost_cr": 12000, "status": "Watch", "risk_score": 52, "risk_level": "Medium",
     "agency": "MMRDA"},
    {"id": "DM-GJ-002", "name": "Vadodara--Mumbai Section, Delhi--Mumbai Expressway",
     "state": "Gujarat", "sector": "Roads & Highways", "lat": 22.301, "lng": 73.183,
     "cost_cr": 9900, "status": "On Track", "risk_score": 31, "risk_level": "Low",
     "agency": "NHAI"},
    {"id": "DM-DL-003", "name": "Delhi Metro Phase-IV Expansion",
     "state": "Delhi", "sector": "Urban Transport", "lat": 28.652, "lng": 77.232,
     "cost_cr": 24948, "status": "On Track", "risk_score": 28, "risk_level": "Low",
     "agency": "DMRC"},
    {"id": "DM-UP-004", "name": "Jewar (Noida) International Airport",
     "state": "Uttar Pradesh", "sector": "Aviation", "lat": 28.191, "lng": 77.650,
     "cost_cr": 29363, "status": "Watch", "risk_score": 48, "risk_level": "Medium",
     "agency": "YIAPL"},
    {"id": "DM-KA-005", "name": "Bengaluru Suburban Railway Project",
     "state": "Karnataka", "sector": "Railways", "lat": 12.987, "lng": 77.594,
     "cost_cr": 15767, "status": "At Risk", "risk_score": 68, "risk_level": "High",
     "agency": "K-RIDE"},
    {"id": "DM-TN-006", "name": "Chennai Metro Rail Phase-II",
     "state": "Tamil Nadu", "sector": "Urban Transport", "lat": 13.083, "lng": 80.270,
     "cost_cr": 63246, "status": "Watch", "risk_score": 55, "risk_level": "Medium",
     "agency": "CMRL"},
    {"id": "DM-WB-007", "name": "Kolkata East--West Metro Corridor",
     "state": "West Bengal", "sector": "Railways", "lat": 22.572, "lng": 88.364,
     "cost_cr": 8965, "status": "At Risk", "risk_score": 72, "risk_level": "High",
     "agency": "KMRC"},
    {"id": "DM-TG-008", "name": "Strategic Road Development Programme (ORR)",
     "state": "Telangana", "sector": "Roads & Highways", "lat": 17.385, "lng": 78.487,
     "cost_cr": 7097, "status": "On Track", "risk_score": 24, "risk_level": "Low",
     "agency": "HMDA"},
    {"id": "DM-RJ-009", "name": "Eastern Rajasthan Canal Project -- Phase 1",
     "state": "Rajasthan", "sector": "Water Resources", "lat": 26.912, "lng": 75.787,
     "cost_cr": 31000, "status": "At Risk", "risk_score": 77, "risk_level": "High",
     "agency": "WRD Rajasthan"},
    {"id": "DM-HR-010", "name": "Kundli--Manesar--Palwal Expressway",
     "state": "Haryana", "sector": "Roads & Highways", "lat": 28.533, "lng": 76.941,
     "cost_cr": 4000, "status": "On Track", "risk_score": 33, "risk_level": "Low",
     "agency": "HSIIDC"},
]
MAP_PROJECTS += [
    {"id": "DM-PB-011", "name": "Punjab Orbital Rail Corridor",
     "state": "Punjab", "sector": "Railways", "lat": 30.901, "lng": 75.857,
     "cost_cr": 2500, "status": "Watch", "risk_score": 45, "risk_level": "Medium",
     "agency": "Rail Land Development Authority"},
    {"id": "DM-BR-012", "name": "Ganga Rail--Road Bridge, Munger",
     "state": "Bihar", "sector": "Railways", "lat": 25.381, "lng": 86.465,
     "cost_cr": 1450, "status": "On Track", "risk_score": 27, "risk_level": "Low",
     "agency": "East Central Railway"},
    {"id": "DM-MP-013", "name": "Bhopal--Indore Expressway",
     "state": "Madhya Pradesh", "sector": "Roads & Highways", "lat": 23.259, "lng": 77.412,
     "cost_cr": 15000, "status": "Watch", "risk_score": 47, "risk_level": "Medium",
     "agency": "MPRDC"},
    {"id": "DM-KL-014", "name": "Kochi Water Metro -- Phase 2",
     "state": "Kerala", "sector": "Urban Transport", "lat": 9.931, "lng": 76.267,
     "cost_cr": 1137, "status": "On Track", "risk_score": 22, "risk_level": "Low",
     "agency": "KMRL"},
    {"id": "DM-AS-015", "name": "Guwahati Urban Mobility Metro",
     "state": "Assam", "sector": "Urban Transport", "lat": 26.144, "lng": 91.736,
     "cost_cr": 9000, "status": "Watch", "risk_score": 56, "risk_level": "Medium",
     "agency": "GMDA"},
    {"id": "DM-OD-016", "name": "Odisha Mineral Metro Corridor",
     "state": "Odisha", "sector": "Railways", "lat": 20.297, "lng": 85.824,
     "cost_cr": 5200, "status": "At Risk", "risk_score": 64, "risk_level": "High",
     "agency": "Odisha MMC"},
    {"id": "DM-AP-017", "name": "Amaravati Capital Region -- Seed Capital Works",
     "state": "Andhra Pradesh", "sector": "Urban Development", "lat": 16.506, "lng": 80.648,
     "cost_cr": 50000, "status": "At Risk", "risk_score": 81, "risk_level": "Critical",
     "agency": "CRDA"},
    {"id": "DM-JH-018", "name": "Deoghar Airport Expansion",
     "state": "Jharkhand", "sector": "Aviation", "lat": 24.441, "lng": 86.700,
     "cost_cr": 4500, "status": "Watch", "risk_score": 42, "risk_level": "Medium",
     "agency": "AAI"},
    {"id": "DM-UK-019", "name": "Char Dham All-Weather Road (Rishikesh--Gangotri)",
     "state": "Uttarakhand", "sector": "Roads & Highways", "lat": 30.087, "lng": 78.294,
     "cost_cr": 12000, "status": "At Risk", "risk_score": 66, "risk_level": "High",
     "agency": "Border Roads Organisation"},
    {"id": "DM-GA-020", "name": "Mopa International Airport -- Phase 2",
     "state": "Goa", "sector": "Aviation", "lat": 15.301, "lng": 73.992,
     "cost_cr": 3400, "status": "On Track", "risk_score": 30, "risk_level": "Low",
     "agency": "GMR Goa Airport"},
]

# Map-project ids declared above, exported so the API can key on them.
MAP_PROJECT_IDS: List[str] = [p["id"] for p in MAP_PROJECTS]


def _normalise_state(state: str) -> str:
    """Return canonical state name (or the raw value when unknown)."""
    if not state:
        return "India"
    key = state.strip().lower()
    # "Maharashtra / Gujarat" -> "Maharashtra"
    if " / " in key:
        key = key.split(" / ")[0].strip()
    key = STATE_ALIASES.get(key, key)
    for name in STATE_CENTROIDS:
        if name.lower() == key:
            return name
    return state.strip()


def get_state_centroid(state: str) -> Optional[List[float]]:
    """Return [lat, lng] for a state name or None when unknown."""
    return STATE_CENTROIDS.get(_normalise_state(state))


def coordinates_for(project_id: str, state: str) -> Optional[Tuple[float, float]]:
    """Deterministic (lat, lng) for a project id.

    Uses a seeded PRNG so the same project always lands on the same point in a
    small ~0.5 degree radius around its state centroid. Returns None only when
    the state cannot be resolved at all.
    """
    centroid = get_state_centroid(state)
    if centroid is None:
        return None
    rng = random.Random(f"{project_id}::{state}")
    lat = centroid[0] + rng.uniform(-0.45, 0.45)
    lng = centroid[1] + rng.uniform(-0.6, 0.6)
    # Keep inside approximate Indian landmass boundaries.
    lat = max(6.0, min(37.5, lat))
    lng = max(68.0, min(97.5, lng))
    return round(lat, 6), round(lng, 6)


def map_demo_projects() -> List[dict]:
    """Deep copy of the built-in demo set (so callers can mutate safely)."""
    return [{**p} for p in MAP_PROJECTS]


def demo_by_id(project_id: str) -> Optional[dict]:
    """Return the built-in demo project matching an id, if any."""
    for p in MAP_PROJECTS:
        if p["id"] == project_id or p["id"] == project_id.upper():
            return p
    return None


# --------------------------------------------------------------------------- #
# Contractors & Geofence Lamina Directory
# --------------------------------------------------------------------------- #

CONTRACTORS: List[dict] = [
    {
        "contractor_id": "CNT-LT-01",
        "company_name": "Larsen & Toubro Heavy Civil Infra",
        "contact_person": "S. Ramanathan (VP Projects)",
        "email": "ramanathan.s@lntecc.com",
        "phone": "+91 22 6752 5656",
        "rating": 4.8,
        "active_contracts": 6,
    },
    {
        "contractor_id": "CNT-AF-02",
        "company_name": "Afcons Infrastructure Limited",
        "contact_person": "Rajiv K. Menon (Chief Eng)",
        "email": "ops.infra@afcons.com",
        "phone": "+91 22 6719 1000",
        "rating": 4.6,
        "active_contracts": 5,
    },
    {
        "contractor_id": "CNT-TP-03",
        "company_name": "Tata Projects Limited",
        "contact_person": "Ananya Sharma (Project Director)",
        "email": "asharma@tataprojects.com",
        "phone": "+91 40 6623 8800",
        "rating": 4.7,
        "active_contracts": 5,
    },
    {
        "contractor_id": "CNT-DB-04",
        "company_name": "Dilip Buildcon Limited",
        "contact_person": "Rohan Suryavanshi (Exec Director)",
        "email": "highways@dilipbuildcon.co.in",
        "phone": "+91 755 402 9999",
        "rating": 4.4,
        "active_contracts": 4,
    },
    {
        "contractor_id": "CNT-ME-05",
        "company_name": "Megha Engineering & Infrastructures Ltd",
        "contact_person": "V. K. Reddy (Director Ops)",
        "email": "vkreddy@meil.in",
        "phone": "+91 40 4433 6700",
        "rating": 4.5,
        "active_contracts": 4,
    },
]

# Explicit showcase assignments (others resolved deterministically)
EXPLICIT_ASSIGNMENTS: Dict[str, str] = {
    "INF-2026-MH-892": "CNT-LT-01",
    "DM-MH-001": "CNT-LT-01",
    "DM-DL-003": "CNT-LT-01",
    "PRJ-0001": "CNT-LT-01",
    "PRJ-0006": "CNT-LT-01",
    "PRJ-0011": "CNT-LT-01",
    "INF-2026-DL-412": "CNT-AF-02",
    "DM-GJ-002": "CNT-AF-02",
    "DM-KA-005": "CNT-AF-02",
    "PRJ-0002": "CNT-AF-02",
    "PRJ-0007": "CNT-AF-02",
    "INF-2026-UP-184": "CNT-TP-03",
    "DM-UP-004": "CNT-TP-03",
    "DM-TN-006": "CNT-TP-03",
    "PRJ-0003": "CNT-TP-03",
    "PRJ-0008": "CNT-TP-03",
    "INF-2026-GJ-771": "CNT-DB-04",
    "DM-WB-007": "CNT-DB-04",
    "DM-HR-010": "CNT-DB-04",
    "PRJ-0004": "CNT-DB-04",
    "PRJ-0009": "CNT-DB-04",
    "INF-2026-KL-308": "CNT-ME-05",
    "DM-TG-008": "CNT-ME-05",
    "DM-RJ-009": "CNT-ME-05",
    "PRJ-0005": "CNT-ME-05",
    "PRJ-0010": "CNT-ME-05",
}


def get_contractor(contractor_id: str) -> Optional[dict]:
    """Return contractor record by ID."""
    for c in CONTRACTORS:
        if c["contractor_id"].upper() == contractor_id.upper():
            return {**c}
    return None


def get_contractor_for_project(project_id: str) -> dict:
    """Return the assigned contractor for any project (DB lookup with fallback)."""
    import sqlite3, os
    pid_norm = project_id.strip()
    if os.path.exists("project_monitoring.db"):
        try:
            conn = sqlite3.connect("project_monitoring.db")
            cur = conn.cursor()
            cur.execute("SELECT contractor_id FROM contractor_assignments WHERE project_id = ?", (pid_norm,))
            row = cur.fetchone()
            conn.close()
            if row and row[0]:
                c = get_contractor(row[0])
                if c:
                    return c
        except Exception:
            pass

    if pid_norm in EXPLICIT_ASSIGNMENTS:
        cid = EXPLICIT_ASSIGNMENTS[pid_norm]
        c = get_contractor(cid)
        if c:
            return c
    # Fallback to seeded hash
    idx = abs(hash(pid_norm)) % len(CONTRACTORS)
    return {**CONTRACTORS[idx]}


def geofence_for_project(project_id: str, state: str = "Maharashtra", radius_km: float = 3.5) -> dict:
    """Generate or retrieve designated construction area lamina for a project.

    Returns dict with center_lat, center_lng, radius_km, and boundary polygon vertices.
    """
    import sqlite3, json, os
    if os.path.exists("project_monitoring.db"):
        try:
            conn = sqlite3.connect("project_monitoring.db")
            cur = conn.cursor()
            cur.execute("SELECT center_lat, center_lng, radius_km, boundary_geojson FROM project_geofences WHERE project_id = ?", (project_id,))
            row = cur.fetchone()
            conn.close()
            if row:
                c_lat, c_lng, r_km, bg_json = row
                bg = json.loads(bg_json) if isinstance(bg_json, str) else bg_json
                coords = bg.get("coordinates", [[]])[0]
                poly = [[pt[1], pt[0]] for pt in coords[:-1]] if coords else []
                return {
                    "project_id": project_id,
                    "center_lat": float(c_lat),
                    "center_lng": float(c_lng),
                    "radius_km": float(r_km),
                    "boundary_lamina": poly,
                    "boundary_geojson": bg,
                }
        except Exception:
            pass

    coords = None
    demo = demo_by_id(project_id)
    if demo:
        coords = (demo["lat"], demo["lng"])
    else:
        coords = coordinates_for(project_id, state)
    if coords is None:
        centroid = get_state_centroid(state) or [20.5937, 78.9629]
        coords = (centroid[0], centroid[1])

    center_lat, center_lng = coords
    from verification_pipeline import generate_lamina_polygon
    polygon = generate_lamina_polygon(center_lat, center_lng, radius_km=radius_km, vertices=6)

    return {
        "project_id": project_id,
        "center_lat": center_lat,
        "center_lng": center_lng,
        "radius_km": radius_km,
        "boundary_lamina": polygon,
        "boundary_geojson": {
            "type": "Polygon",
            "coordinates": [[[pt[1], pt[0]] for pt in polygon] + [[polygon[0][1], polygon[0][0]]]]
        },
    }