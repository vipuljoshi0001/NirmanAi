"""Test contractor panel, unified login, and geofence lamina verification."""
from io import BytesIO
from PIL import Image
from fastapi.testclient import TestClient
import api
import verification_pipeline as vp

PASS = 0


def check(name: str, cond: bool):
    global PASS
    assert cond, f"FAILED: {name}"
    PASS += 1
    print(f"  PASS {name}")


def main():
    client = TestClient(api.app)

    # 1. Point-in-polygon mathematics test
    poly = vp.generate_lamina_polygon(19.076, 72.878, radius_km=3.0, vertices=6)
    check("polygon generation has 6 vertices", len(poly) == 6)
    check("center point is inside lamina polygon", vp.is_point_in_polygon(19.076, 72.878, poly))
    check("distant point (50km) is outside lamina polygon", not vp.is_point_in_polygon(19.5, 73.5, poly))

    # 2. Unified authentication endpoint
    admin_login = client.post("/api/auth/login", json={"role": "admin"}).json()
    check("admin login returns admin role", admin_login["role"] == "admin")
    check("admin login returns DG user profile", "Director General" in admin_login["user"]["title"])

    contractor_login = client.post("/api/auth/login", json={"role": "contractor", "contractor_id": "CNT-LT-01"}).json()
    check("contractor login returns contractor role", contractor_login["role"] == "contractor")
    check("contractor login returns company name", "Larsen & Toubro" in contractor_login["user"]["company"])

    # 3. Public data access (guest can view without login)
    pub_health = client.get("/api/health").json()
    check("public access: /api/health", pub_health["status"] == "connected")
    pub_projects = client.get("/api/projects").json()
    check("public access: /api/projects returns projects", len(pub_projects) >= 300)
    check("project payload includes assigned contractor", "contractor" in pub_projects[0])

    # 4. Contractor panel assigned projects
    c_proj = client.get("/api/contractors/CNT-LT-01/projects").json()
    check("contractor has assigned packages", len(c_proj) >= 3)
    target_p = c_proj[0]
    check("assigned project has geofence lamina data", "boundary_lamina" in target_p["geofence"])

    # 5. Geofence verification test with dummy photo
    buf = BytesIO()
    im = Image.new("RGB", (120, 120), color="blue")
    im.save(buf, format="JPEG")
    img_bytes = buf.getvalue()

    center_lat = target_p["geofence"]["center_lat"]
    center_lng = target_p["geofence"]["center_lng"]

    # INSIDE: Should count and update progress
    res_inside = client.post(
        "/api/contractor/submit-progress",
        data={
            "project_id": target_p["id"],
            "contractor_id": "CNT-LT-01",
            "physical_progress_pct": 68.0,
            "financial_expenditure_cr": 150.0,
            "notes": "Verified pier cap casting within construction lamina",
            "gps_lat": center_lat,
            "gps_lng": center_lng,
        },
        files={"file": ("valid_onsite.jpg", img_bytes, "image/jpeg")},
    ).json()

    check("inside submission accepted", res_inside["status"] == "accepted")
    check("inside submission counts towards progress", res_inside["counts"] is True)
    check("inside submission inside_geofence flag is true", res_inside["inside_geofence"] is True)

    # OUTSIDE: Must NOT count ("report does not count, that is, we geofence it")
    res_outside = client.post(
        "/api/contractor/submit-progress",
        data={
            "project_id": target_p["id"],
            "contractor_id": "CNT-LT-01",
            "physical_progress_pct": 99.0,
            "financial_expenditure_cr": 999.0,
            "notes": "Off-site warehouse activity far away",
            "gps_lat": center_lat + 1.2, # ~130 km away!
            "gps_lng": center_lng + 1.2,
        },
        files={"file": ("outside_violation.jpg", img_bytes, "image/jpeg")},
    ).json()

    check("outside submission rejected", res_outside["status"] == "rejected")
    check("outside submission DOES NOT COUNT towards progress", res_outside["counts"] is False)
    check("outside submission inside_geofence flag is false", res_outside["inside_geofence"] is False)
    check("outside submission returns geofence violation alert", "GEOFENCE VIOLATION" in res_outside["message"])

    # 6. Contractor submission audit history
    subs = client.get("/api/contractor/CNT-LT-01/submissions").json()
    check("audit trail recorded submissions", len(subs) >= 2)

    print(f"\nALL {PASS} CONTRACTOR & GEOFENCE TESTS PASSED!")


if __name__ == "__main__":
    main()
