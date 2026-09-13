"""Database Manager for NirmanAI: manages connections and schemas across the 3 databases:
1. project_monitoring.db  -- Core infrastructure projects, monthly snapshots, 16 features & ML risk scores
2. contractors_admin.db   -- Contractor profiles, admin credentials, state assignments & geofences
3. reports_photos.db      -- Contractor on-site progress reports, photo uploads & verification audits
"""
from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List

import mock_data

BASE_DIR = Path(__file__).resolve().parent

DB_CORE = str(BASE_DIR / "project_monitoring.db")
DB_CONTRACTORS_ADMIN = str(BASE_DIR / "contractors_admin.db")
DB_REPORTS_PHOTOS = str(BASE_DIR / "reports_photos.db")


def get_core_conn() -> sqlite3.Connection:
    return sqlite3.connect(DB_CORE, check_same_thread=False)


def get_contractors_admin_conn() -> sqlite3.Connection:
    return sqlite3.connect(DB_CONTRACTORS_ADMIN, check_same_thread=False)


def get_reports_photos_conn() -> sqlite3.Connection:
    return sqlite3.connect(DB_REPORTS_PHOTOS, check_same_thread=False)


def init_contractors_admin_db() -> None:
    """Initialize contractors_admin.db with admins, contractors, assignments, and geofences."""
    conn = get_contractors_admin_conn()
    try:
        cur = conn.cursor()

        # 1. Admins table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS admins (
                admin_id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                name TEXT NOT NULL,
                role TEXT DEFAULT 'admin',
                title TEXT,
                company TEXT,
                agency TEXT,
                email TEXT,
                created_at TEXT NOT NULL
            )
        """)

        # 2. Contractors table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS contractors (
                contractor_id TEXT PRIMARY KEY,
                password TEXT NOT NULL,
                company_name TEXT NOT NULL,
                contact_person TEXT,
                email TEXT,
                phone TEXT,
                rating NUMERIC DEFAULT 4.5,
                active_contracts INT DEFAULT 0,
                created_at TEXT NOT NULL
            )
        """)

        # 3. Contractor Assignments table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS contractor_assignments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                contractor_id TEXT NOT NULL,
                package_name TEXT,
                assigned_date TEXT,
                contract_value_cr NUMERIC,
                UNIQUE(project_id, contractor_id)
            )
        """)

        # 4. Project Geofences table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS project_geofences (
                project_id TEXT PRIMARY KEY,
                center_lat NUMERIC NOT NULL,
                center_lng NUMERIC NOT NULL,
                radius_km NUMERIC DEFAULT 3.5,
                boundary_geojson TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)

        # Seed default Admin account if empty
        cur.execute("SELECT COUNT(*) FROM admins")
        if cur.fetchone()[0] == 0:
            now_str = datetime.now(timezone.utc).isoformat()
            cur.execute("""
                INSERT INTO admins (admin_id, username, password, name, role, title, company, agency, email, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                "ADM-DG-01",
                "admin",
                "admin123",
                "Director General",
                "admin",
                "Director General / Oversight Administrator",
                "Govt of India (MoSPI Oversight)",
                "National Infrastructure Monitoring Authority",
                "dg.oversight@gov.in",
                now_str
            ))

        # Seed contractors (migrate from project_monitoring.db or mock_data.CONTRACTORS)
        cur.execute("SELECT COUNT(*) FROM contractors")
        if cur.fetchone()[0] == 0:
            now_str = datetime.now(timezone.utc).isoformat()
            # Check if project_monitoring.db has existing contractors
            migrated_cnt = 0
            if os.path.exists(DB_CORE):
                try:
                    c_core = sqlite3.connect(DB_CORE)
                    rows = c_core.execute("SELECT contractor_id, company_name, contact_person, email, phone, rating, active_contracts FROM contractors").fetchall()
                    for r in rows:
                        cur.execute("""
                            INSERT OR REPLACE INTO contractors
                            (contractor_id, password, company_name, contact_person, email, phone, rating, active_contracts, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (r[0], "contractor123", r[1], r[2], r[3], r[4], r[5], r[6], now_str))
                        migrated_cnt += 1
                    c_core.close()
                except Exception:
                    pass

            if migrated_cnt == 0:
                for c in mock_data.CONTRACTORS:
                    cur.execute("""
                        INSERT OR REPLACE INTO contractors
                        (contractor_id, password, company_name, contact_person, email, phone, rating, active_contracts, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        c["contractor_id"],
                        "contractor123",
                        c["company_name"],
                        c["contact_person"],
                        c["email"],
                        c["phone"],
                        c.get("rating", 4.5),
                        c.get("active_contracts", 4),
                        now_str
                    ))

        # Migrate or seed contractor assignments
        cur.execute("SELECT COUNT(*) FROM contractor_assignments")
        if cur.fetchone()[0] == 0:
            migrated_asgn = 0
            if os.path.exists(DB_CORE):
                try:
                    c_core = sqlite3.connect(DB_CORE)
                    rows = c_core.execute("SELECT project_id, contractor_id, package_name, assigned_date, contract_value_cr FROM contractor_assignments").fetchall()
                    for r in rows:
                        cur.execute("""
                            INSERT OR IGNORE INTO contractor_assignments
                            (project_id, contractor_id, package_name, assigned_date, contract_value_cr)
                            VALUES (?, ?, ?, ?, ?)
                        """, (r[0], r[1], r[2], r[3], r[4]))
                        migrated_asgn += 1
                    c_core.close()
                except Exception:
                    pass

            if migrated_asgn == 0:
                for pid, cid in mock_data.EXPLICIT_ASSIGNMENTS.items():
                    cur.execute("""
                        INSERT OR IGNORE INTO contractor_assignments
                        (project_id, contractor_id, package_name, assigned_date, contract_value_cr)
                        VALUES (?, ?, ?, ?, ?)
                    """, (pid, cid, f"Civil Works Pkg - {pid}", "2024-01-15", 1250.0))

        # Migrate project geofences
        cur.execute("SELECT COUNT(*) FROM project_geofences")
        if cur.fetchone()[0] == 0 and os.path.exists(DB_CORE):
            try:
                c_core = sqlite3.connect(DB_CORE)
                rows = c_core.execute("SELECT project_id, center_lat, center_lng, radius_km, boundary_geojson, created_at FROM project_geofences").fetchall()
                for r in rows:
                    cur.execute("""
                        INSERT OR REPLACE INTO project_geofences
                        (project_id, center_lat, center_lng, radius_km, boundary_geojson, created_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (r[0], r[1], r[2], r[3], r[4], r[5] or datetime.now(timezone.utc).isoformat()))
                c_core.close()
            except Exception:
                pass

        conn.commit()
    finally:
        conn.close()


def init_reports_photos_db() -> None:
    """Initialize reports_photos.db with contractor_progress_reports, verification_records, and photo_uploads."""
    conn = get_reports_photos_conn()
    try:
        cur = conn.cursor()

        # 1. Contractor Progress Reports table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS contractor_progress_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                submission_id TEXT UNIQUE NOT NULL,
                project_id TEXT NOT NULL,
                contractor_id TEXT NOT NULL,
                physical_progress_pct NUMERIC,
                financial_expenditure_cr NUMERIC,
                notes TEXT,
                photo_url TEXT,
                gps_lat NUMERIC,
                gps_lng NUMERIC,
                inside_geofence INT,
                verification_status TEXT,
                counts_towards_progress INT,
                submitted_at TEXT NOT NULL,
                details_json TEXT,
                ai_intelligence_json TEXT
            )
        """)

        # 2. Verification Records table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS verification_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_name TEXT NOT NULL,
                original_name TEXT,
                capture_time TEXT,
                client_lat NUMERIC,
                client_lng NUMERIC,
                extracted_lat NUMERIC,
                extracted_lng NUMERIC,
                distance_meters NUMERIC,
                result_json TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)

        # 3. Photo Uploads metadata table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS photo_uploads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_name TEXT UNIQUE NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER,
                content_type TEXT,
                project_id TEXT,
                contractor_id TEXT,
                uploaded_at TEXT NOT NULL
            )
        """)

        # Migrate existing reports and verification records from project_monitoring.db if empty
        cur.execute("SELECT COUNT(*) FROM contractor_progress_reports")
        if cur.fetchone()[0] == 0 and os.path.exists(DB_CORE):
            try:
                c_core = sqlite3.connect(DB_CORE)
                rows = c_core.execute("""
                    SELECT submission_id, project_id, contractor_id, physical_progress_pct,
                           financial_expenditure_cr, notes, photo_url, gps_lat, gps_lng,
                           inside_geofence, verification_status, counts_towards_progress,
                           submitted_at, details_json, ai_intelligence_json
                    FROM contractor_progress_reports
                """).fetchall()
                for r in rows:
                    cur.execute("""
                        INSERT OR IGNORE INTO contractor_progress_reports
                        (submission_id, project_id, contractor_id, physical_progress_pct,
                         financial_expenditure_cr, notes, photo_url, gps_lat, gps_lng,
                         inside_geofence, verification_status, counts_towards_progress,
                         submitted_at, details_json, ai_intelligence_json)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, r)
                c_core.close()
            except Exception:
                pass

        cur.execute("SELECT COUNT(*) FROM verification_records")
        if cur.fetchone()[0] == 0 and os.path.exists(DB_CORE):
            try:
                c_core = sqlite3.connect(DB_CORE)
                # Check column structure of verification_records in DB_CORE
                info = [col[1] for col in c_core.execute("PRAGMA table_info(verification_records)").fetchall()]
                if "file_name" in info and "result_json" in info:
                    cols = ["file_name", "original_name", "capture_time", "client_lat", "client_lng",
                            "extracted_lat", "extracted_lng", "distance_meters", "result_json", "status", "created_at"]
                    avail_cols = [c for c in cols if c in info]
                    query = f"SELECT {', '.join(avail_cols)} FROM verification_records"
                    rows = c_core.execute(query).fetchall()
                    for r in rows:
                        row_dict = dict(zip(avail_cols, r))
                        cur.execute("""
                            INSERT INTO verification_records
                            (file_name, original_name, capture_time, client_lat, client_lng,
                             extracted_lat, extracted_lng, distance_meters, result_json, status, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            row_dict.get("file_name", "upload.jpg"),
                            row_dict.get("original_name", "upload.jpg"),
                            row_dict.get("capture_time", ""),
                            row_dict.get("client_lat"),
                            row_dict.get("client_lng"),
                            row_dict.get("extracted_lat"),
                            row_dict.get("extracted_lng"),
                            row_dict.get("distance_meters", 0.0),
                            row_dict.get("result_json", "{}"),
                            row_dict.get("status", "accepted"),
                            row_dict.get("created_at", datetime.now(timezone.utc).isoformat()),
                        ))
                c_core.close()
            except Exception:
                pass

        conn.commit()
    finally:
        conn.close()


def init_all_databases() -> None:
    """Initialize both dedicated databases and perform automatic data migrations."""
    init_contractors_admin_db()
    init_reports_photos_db()


def get_all_database_status() -> Dict[str, Any]:
    """Inspect and report the status, file sizes, and table counts of all 3 databases."""
    databases = {}

    configs = [
        ("core", DB_CORE, "Core Infrastructure Telemetry, 16-Feature ML Models & Risk Scores"),
        ("contractors_admin", DB_CONTRACTORS_ADMIN, "Contractors Registry, Admin Authentication & State Package Geofences"),
        ("reports_photos", DB_REPORTS_PHOTOS, "On-Site Work Reports, Uploaded Photos & Telemetry Verification Audits"),
    ]

    for key, path_str, purpose in configs:
        p = Path(path_str)
        exists = p.is_file()
        size_bytes = p.stat().st_size if exists else 0
        tables = {}
        if exists:
            try:
                conn = sqlite3.connect(path_str)
                table_names = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall()]
                for t in table_names:
                    cnt = conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
                    tables[t] = cnt
                conn.close()
            except Exception as e:
                tables = {"error": str(e)}

        databases[key] = {
            "filename": p.name,
            "path": str(p),
            "exists": exists,
            "size_kb": round(size_bytes / 1024, 1),
            "purpose": purpose,
            "tables": tables,
        }

    return {
        "status": "healthy",
        "total_databases": len(databases),
        "databases": databases,
    }


if __name__ == "__main__":
    print("Initializing dedicated databases...")
    init_all_databases()
    status = get_all_database_status()
    import json
    print(json.dumps(status, indent=2))
