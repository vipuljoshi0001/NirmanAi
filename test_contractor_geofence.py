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

    # 2. Unified authentication with ID & Password
    # Invalid password test
    bad_admin = client.post("/api/auth/login", json={"role": "admin", "username": "admin", "password": "wrongpassword"})
    check("invalid admin password returns 401", bad_admin.status_code == 401)
    bad_cnt = client.post("/api/auth/login", json={"role": "contractor", "contractor_id": "CNT-LT-01", "password": "wrongpassword"})
    check("invalid contractor password returns 401", bad_cnt.status_code == 401)

    # Valid credentials test
    admin_login = client.post("/api/auth/login", json={"role": "admin", "username": "admin", "password": "admin123"}).json()
    check("admin login returns admin role", admin_login["role"] == "admin")
    check("admin login returns DG user profile", "Director General" in admin_login["user"]["title"])

    contractor_login = client.post("/api/auth/login", json={"role": "contractor", "contractor_id": "CNT-LT-01", "password": "contractor123"}).json()
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

    # 7. AI Intelligence derivation & Progress Bar update on existing project (PRJ-0001)
    geo_p1 = client.get("/api/projects/PRJ-0001/geofence").json()
    p1_lat = geo_p1["center_lat"]
    p1_lng = geo_p1["center_lng"]

    sub_existing = client.post(
        "/api/contractor/submit-progress",
        data={
            "project_id": "PRJ-0001",
            "contractor_id": "CNT-LT-01",
            "physical_progress_pct": 78.5,
            "financial_expenditure_cr": 190000.0,
            "notes": "Verified high-pressure pipeline welding on-site",
            "gps_lat": p1_lat,
            "gps_lng": p1_lng,
        },
        files={"file": ("site_welding.jpg", img_bytes, "image/jpeg")},
    ).json()
    check("on-site submission accepted for PRJ-0001", sub_existing["status"] == "accepted")
    check("derived ai intelligence returned", "ai_intelligence" in sub_existing and sub_existing["ai_intelligence"] is not None)
    check("ai narrative formulated", len(sub_existing["ai_intelligence"]["narrative"]) > 20)

    # Verify project detail has updated progress
    p_detail = client.get("/api/projects/PRJ-0001").json()
    check("PRJ-0001 physicalProgress updated to 78.5", p_detail["physicalProgress"] == 78.5)
    check("PRJ-0001 health score recomputed", p_detail["health"] > 0)

    # 8. Role-segregated notifications
    guest_notifs = client.get("/api/notifications?role=guest").json()
    check("no notifications for non-contractor non-admin guests", len(guest_notifs["notifications"]) == 0)

    cnt_notifs = client.get("/api/notifications?role=contractor&contractor_id=CNT-LT-01").json()
    check("contractor notifications show approved & rejected reports", len(cnt_notifs["notifications"]) >= 2)

    admin_notifs = client.get("/api/notifications?role=admin").json()
    check("admin notifications show national audit stream", len(admin_notifs["notifications"]) >= 2)

    # 9. Admin assignment & custom geofencing endpoints
    assign_res = client.post(
        "/api/admin/assign-contractor",
        json={"project_id": "PRJ-0001", "contractor_id": "CNT-AF-02", "package_name": "State Package 1", "contract_value_cr": 2500.0}
    ).json()
    check("admin assign contractor success", assign_res["status"] == "success")

    geofence_res = client.post(
        "/api/admin/geofence",
        json={"project_id": "PRJ-0001", "center_lat": 19.100, "center_lng": 72.900, "radius_km": 4.5}
    ).json()
    check("admin set geofence success", geofence_res["status"] == "success")
    check("custom geofence boundary lamina has 6 vertices", len(geofence_res["boundary_lamina"]) == 6)

    print(f"\nALL {PASS} CONTRACTOR, ADMIN & GEOFENCE TESTS PASSED!")


if __name__ == "__main__":
    main()
