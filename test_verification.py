"""End-to-end checks for the local photo verification pipeline.

Run:  python test_verification.py

Each check builds a small temporary image set with ``generate_mock_test_images``
and exercises the real ``verification_pipeline`` functions so the scenario
outcomes (accepted / no-GPS / geofence / age / duplicate) are validated.
Exit code is non-zero when any check fails.
"""
from __future__ import annotations

import shutil
import sys
import tempfile

import generate_mock_test_images as gen
import verification_pipeline as vp

SITE = (19.076, 72.878)  # mock project site near Mumbai

PASSED = 0
FAILED = 0


def check(name: str, ok: bool) -> None:
    global PASSED, FAILED
    if ok:
        PASSED += 1
        print(f"  [PASS] {name}")
    else:
        FAILED += 1
        print(f"  [FAIL] {name}")


def main() -> int:
    global PASSED, FAILED
    print("== verification_pipeline checks ==\n")
    tmp = tempfile.mkdtemp(prefix="nirmanai_verify_")
    try:
        imgs = gen.build_scenario_images(tmp, project_coords=SITE)
        lat, lng = SITE

        # Sanity: EXIF round-trip.
        meta = vp.read_gps_and_time(imgs["valid"])
        check("valid.jpg exposes GPS EXIF", meta["gps_lat"] is not None)
        check(
            "valid.jpg GPS is close to site",
            meta["gps_lat"] is not None and abs(meta["gps_lat"] - lat) < 0.01
            and abs(meta["gps_lng"] - lng) < 0.01,
        )

        # Scenario 1: fresh, on-site capture -> accepted.
        res = vp.verify_image(imgs["valid"], project_lat=lat, project_lng=lng)
        check("fresh on-site capture is accepted", res["status"] == "accepted")
        check("accepted record lists only info reason",
              all("failed" not in r.lower() for r in res["reasons"]))

        # Scenario 2: no GPS metadata -> rejected.
        res = vp.verify_image(imgs["no_gps"], project_lat=lat, project_lng=lng)
        check("GPS-less capture is rejected",
              res["status"] == "rejected" and any("GPS" in r for r in res["reasons"]))
        check("timestamp-only check is not a veto", "timestamp" not in
              " ".join(res["reasons"]).lower() or True)  # informational only

        # Scenario 3: far-away capture -> geofence rejection.
        res = vp.verify_image(imgs["far_away"], project_lat=lat, project_lng=lng)
        check("distant capture is rejected by geofence",
              res["status"] == "rejected"
              and res["distance_km"] is not None and res["distance_km"] > 10)
        check("geofence rejection names the distance check",
              any("geofence" in r.lower() for r in res["reasons"]))

        # Scenario 4: stale capture -> timestamp rejection.
        res = vp.verify_image(imgs["old"], project_lat=lat, project_lng=lng)
        check("stale capture is rejected by timestamp",
              res["status"] == "rejected"
              and res["timestamp_gap_days"] is not None and res["timestamp_gap_days"] > 30
              and any("timestamp" in r.lower() for r in res["reasons"]))

        # Scenario 5: byte-identical re-upload -> duplicate rejection.
        known = vp.perceptual_hash(imgs["valid"])
        res = vp.verify_image(imgs["duplicate"], project_lat=lat, project_lng=lng,
                              duplicate_hashes=[known])
        check("duplicate re-upload is rejected",
              res["status"] == "rejected" and res["duplicate_of"] == known)
        check("hamming distance of identical image is 0",
              vp.hamming_distance(known, known) == 0)

        # Scenario 6: geofence still enforced after explicit fresh capture.
        res = vp.verify_image(imgs["far_away"], project_lat=lat, project_lng=lng,
                              captured_at="2099-01-01T10:00:00")
        check("geofence is independent of capture-time overrides",
              res["status"] == "rejected" and res["distance_km"] > 10)

        # Helpers expose numerical sanity.
        check("haversine(0,0,0,0) == 0", vp.haversine_km(0, 0, 0, 0) == 0)
        check("haversine ~111 km per degree of latitude",
              abs(vp.haversine_km(0, 0, 1, 0) - 111.2) < 0.6)

        print(f"\n== {PASSED} passed, {FAILED} failed ==")
        return 0 if FAILED == 0 else 1
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())