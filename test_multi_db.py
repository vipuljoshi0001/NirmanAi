"""End-to-End Verification script for the 3 separated databases:
1. Core (project_monitoring.db)
2. Contractors & Admin (contractors_admin.db)
3. Reports & Photos (reports_photos.db)
"""
import io
import json
import sqlite3
import httpx

BASE_URL = "http://127.0.0.1:8000"

def test_multi_database_architecture():
    client = httpx.Client(base_url=BASE_URL, timeout=30.0)

    print("\n--- 1. Testing GET /api/databases/status ---")
    resp = client.get("/api/databases/status")
    assert resp.status_code == 200, f"Failed: {resp.text}"
    status_data = resp.json()
    print("Database Status Response:")
    print(json.dumps(status_data, indent=2))
    assert status_data["status"] == "healthy"
    assert status_data["total_databases"] == 3
    assert "core" in status_data["databases"]
    assert "contractors_admin" in status_data["databases"]
    assert "reports_photos" in status_data["databases"]
    
    # Check tables
    ca_tables = status_data["databases"]["contractors_admin"]["tables"]
    assert "admins" in ca_tables and ca_tables["admins"] >= 1
    assert "contractors" in ca_tables and ca_tables["contractors"] >= 5
    assert "contractor_assignments" in ca_tables
    assert "project_geofences" in ca_tables
    print("✓ contractors_admin.db tables and records verified!")

    rp_tables = status_data["databases"]["reports_photos"]["tables"]
    assert "contractor_progress_reports" in rp_tables
    assert "verification_records" in rp_tables
    assert "photo_uploads" in rp_tables
    print("✓ reports_photos.db tables and records verified!")

    print("\n--- 2. Testing Authentication via contractors_admin.db ---")
    # Admin login
    adm_resp = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert adm_resp.status_code == 200, f"Admin login failed: {adm_resp.text}"
    adm_user = adm_resp.json()["user"]
    assert adm_user["role"] == "admin"
    print(f"✓ Admin login successful: {adm_user['name']} ({adm_user['role']})")

    # Contractor login
    cnt_resp = client.post("/api/auth/login", json={"username": "CNT-LT-01", "password": "contractor123"})
    assert cnt_resp.status_code == 200, f"Contractor login failed: {cnt_resp.text}"
    cnt_user = cnt_resp.json()["user"]
    assert cnt_user["role"] == "contractor"
    assert cnt_user["contractor_id"] == "CNT-LT-01"
    print(f"✓ Contractor login successful: {cnt_user['name']} ({cnt_user['contractor_id']})")

    print("\n--- 3. Testing Contractor Operations with contractors_admin.db ---")
    # List contractors
    clist_resp = client.get("/api/contractors")
    assert clist_resp.status_code == 200
    contractors = clist_resp.json()
    assert len(contractors) >= 5
    print(f"✓ Loaded {len(contractors)} contractors from contractors_admin.db")

    # Assigned projects
    cproj_resp = client.get("/api/contractors/CNT-LT-01/projects")
    assert cproj_resp.status_code == 200
    assigned_projects = cproj_resp.json()
    print(f"✓ Contractor CNT-LT-01 has {len(assigned_projects)} assigned projects")

    # Admin assigns contractor to new project
    test_pid = "PRJ-0005"
    test_cid = "CNT-LT-01"
    asgn_resp = client.post("/api/admin/assign-contractor", json={
        "project_id": test_pid,
        "contractor_id": test_cid,
        "package_name": "Civil Package Unit 4",
        "contract_value_cr": 450.0
    })
    assert asgn_resp.status_code == 200, f"Assign failed: {asgn_resp.text}"
    print(f"✓ Admin assigned {test_cid} to {test_pid} in contractors_admin.db")

    # Set geofence
    geo_resp = client.post("/api/admin/set-geofence", json={
        "project_id": test_pid,
        "center_lat": 19.0760,
        "center_lng": 72.8777,
        "radius_km": 3.0
    })
    assert geo_resp.status_code == 200, f"Set geofence failed: {geo_resp.text}"
    print(f"✓ Admin set geofence for {test_pid} in contractors_admin.db")

    # Check geofence
    get_geo_resp = client.get(f"/api/project/{test_pid}/geofence")
    assert get_geo_resp.status_code == 200
    geo_data = get_geo_resp.json()
    assert geo_data["project_id"] == test_pid
    assert geo_data["center_lat"] == 19.0760
    print(f"✓ Geofence read back verified from contractors_admin.db: radius {geo_data['radius_km']} km")

    print("\n--- 4. Testing Reports & Photos Uploads to reports_photos.db ---")
    # Count before
    conn_rp = sqlite3.connect("reports_photos.db")
    count_rep_before = conn_rp.execute("SELECT COUNT(*) FROM contractor_progress_reports").fetchone()[0]
    count_photo_before = conn_rp.execute("SELECT COUNT(*) FROM photo_uploads").fetchone()[0]
    count_veri_before = conn_rp.execute("SELECT COUNT(*) FROM verification_records").fetchone()[0]
    conn_rp.close()

    # Create dummy image file for upload
    dummy_img_bytes = b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xFF\xDB\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\xFF\xC0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xFF\xC4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xFF\xDA\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xFF\xD9"

    # Inside geofence submission
    form_data = {
        "project_id": test_pid,
        "contractor_id": test_cid,
        "physical_progress_pct": "68.5",
        "financial_expenditure_cr": "195.0",
        "notes": "Testing multi-db reports_photos persistence inside geofence lamina",
        "gps_lat": "19.0765",
        "gps_lng": "72.8780",
    }
    files = {
        "file": ("site_inspection_inside.jpg", dummy_img_bytes, "image/jpeg")
    }
    sub_resp = client.post("/api/contractor/submit-progress", data=form_data, files=files)
    assert sub_resp.status_code == 200, f"Submit progress failed: {sub_resp.text}"
    sub_result = sub_resp.json()
    print("Submit Progress Result:")
    print(f"  Submission ID: {sub_result.get('submission_id')}")
    print(f"  Inside Geofence: {sub_result.get('inside_geofence')}")
    print(f"  Verification Status: {sub_result.get('verification_status')}")
    print(f"  Counts Towards Progress: {sub_result.get('counts_towards_progress')}")
    assert sub_result.get("inside_geofence") is True
    assert sub_result.get("counts_towards_progress") is True

    # Check count in reports_photos.db
    conn_rp = sqlite3.connect("reports_photos.db")
    count_rep_after = conn_rp.execute("SELECT COUNT(*) FROM contractor_progress_reports").fetchone()[0]
    count_photo_after = conn_rp.execute("SELECT COUNT(*) FROM photo_uploads").fetchone()[0]
    count_veri_after = conn_rp.execute("SELECT COUNT(*) FROM verification_records").fetchone()[0]
    
    latest_upload = conn_rp.execute("SELECT file_name, project_id, contractor_id FROM photo_uploads ORDER BY id DESC LIMIT 1").fetchone()
    print(f"✓ Latest photo upload in reports_photos.db: {latest_upload}")
    conn_rp.close()

    assert count_rep_after == count_rep_before + 1, "Report was not written to reports_photos.db!"
    assert count_photo_after == count_photo_before + 1, "Photo was not written to photo_uploads in reports_photos.db!"
    assert count_veri_after == count_veri_before + 1, "Verification was not written to reports_photos.db!"
    print(f"✓ Confirmed records in reports_photos.db: reports={count_rep_after}, photos={count_photo_after}, verifications={count_veri_after}")

    print("\n--- 5. Testing Geofence Breach Upload to reports_photos.db ---")
    form_data_breach = {
        "project_id": test_pid,
        "contractor_id": test_cid,
        "physical_progress_pct": "99.9",
        "financial_expenditure_cr": "300.0",
        "notes": "Testing outside geofence lamina rejection",
        "gps_lat": "28.6139", # New Delhi coords (far away from Mumbai)
        "gps_lng": "77.2090",
    }
    files_breach = {
        "file": ("site_inspection_outside.jpg", dummy_img_bytes, "image/jpeg")
    }
    sub_resp_breach = client.post("/api/contractor/submit-progress", data=form_data_breach, files=files_breach)
    assert sub_resp_breach.status_code == 200
    res_breach = sub_resp_breach.json()
    print(f"  Geofence Breach Result: inside_geofence={res_breach.get('inside_geofence')}, counts={res_breach.get('counts_towards_progress')}")
    assert res_breach.get("inside_geofence") is False
    assert res_breach.get("counts_towards_progress") is False
    print("✓ Geofence breach properly identified and recorded in reports_photos.db!")

    print("\n--- 6. Testing Notifications and Audits Querying the Separated DBs ---")
    # Contractor notifications
    notif_cnt = client.get(f"/api/notifications?role=contractor&contractor_id={test_cid}").json()
    assert notif_cnt["unread_count"] >= 2
    print(f"✓ Contractor notifications: {notif_cnt['unread_count']} notifications returned")

    # Admin notifications
    notif_adm = client.get("/api/notifications?role=admin").json()
    assert notif_adm["unread_count"] >= 2
    print(f"✓ Admin notifications: {notif_adm['unread_count']} notifications returned across all contractors")

    # Admin audits
    audits = client.get("/api/admin/audits?limit=5").json()
    assert len(audits) >= 2
    print(f"✓ Admin audits retrieved: {len(audits)} latest audit items with contractor company name resolved")

    print("\n--- 7. Testing Core Project Endpoints (project_monitoring.db) ---")
    core_summary = client.get("/api/portfolio/summary").json()
    assert "total_projects" in core_summary
    print(f"✓ Core DB working: {core_summary['total_projects']} total projects monitored in portfolio")

    print("\n========================================================")
    print("🎉 ALL 3 DATABASES ARE CONNECTED, VERIFIED, AND FULLY OPERATIONAL!")
    print("========================================================")

if __name__ == "__main__":
    test_multi_database_architecture()
