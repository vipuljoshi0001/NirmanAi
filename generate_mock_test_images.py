"""Generate deterministic mock on-site photo sets for the verification demo.

Usage:
    python generate_mock_test_images.py <out_dir>
    python generate_mock_test_images.py <out_dir> --project-coords 19.076,72.878

Outputs five JPEGs into ``<out_dir>``:

  * ``valid.jpg``      - fresh capture, GPS near the site            -> accepted
  * ``no_gps.jpg``     - fresh capture, GPS stripped from EXIF       -> rejected
  * ``far_away.jpg``   - fresh capture, GPS ~450 km from the site    -> rejected
  * ``old.jpg``        - on-site GPS but captured ~120 days ago      -> rejected
  * ``duplicate.jpg``  - pixel-identical copy of ``valid.jpg``       -> rejected

All images embed EXIF via piexif so the test can exercise the real helpers.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
from pathlib import Path
import shutil

from PIL import Image, ImageDraw

import numpy as np  # fast gradients; seeds are fixed so output is stable.

H = 720
W = 1280


def make_base_image(seed: int = 0, label: str = "") -> Image.Image:
    """1280x720 synthetic 'site photo': sky gradient + building + road."""
    rng = np.random.RandomState(seed)
    sky = np.zeros((H, W, 3), dtype=np.uint8)
    for i in range(H):
        t = i / H
        color = (rng.randint(170, 220), rng.randint(150, 200), rng.randint(90, 130))
        blend = (int(color[0] * (1 - t) + 40 * t),
                 int(color[1] * (1 - t) + 60 * t),
                 int(color[2] * (1 - t) + 90 * t))
        sky[i, :, :] = blend
    img = Image.fromarray(sky, "RGB")
    draw = ImageDraw.Draw(img)
    # Construction site ground strip
    draw.rectangle([0, int(H * 0.62), W, H], fill=(110, 96, 74))
    # Building block
    bx, by = int(W * 0.42), int(H * 0.40)
    draw.rectangle([bx, by, bx + 180, int(H * 0.62)], fill=(150, 152, 158), outline=(80, 82, 88))
    draw.rectangle([bx + 14, by + 14, bx + 166, int(H * 0.62) - 14], fill=(120, 122, 128))
    for row in range(4):
        for col in range(4):
            draw.rectangle([bx + 22 + col * 38, by + 22 + row * 34,
                            bx + 50 + col * 38, by + 46 + row * 34], fill=(70, 90, 120))
    # Tower crane
    cx = int(W * 0.68)
    draw.rectangle([cx, int(H * 0.18), cx + 14, int(H * 0.62)], fill=(60, 60, 70))
    draw.line([(cx + 7, int(H * 0.18)), (cx + 130, int(H * 0.26))], fill=(60, 60, 70), width=10)
    draw.line([(cx + 130, int(H * 0.26)), (cx + 130, int(H * 0.30))], fill=(60, 60, 70), width=10)
    # Road with lane markings
    draw.rectangle([0, int(H * 0.86), W, H], fill=(52, 52, 56))
    draw.line([(0, int(H * 0.91)), (W, int(H * 0.91))], fill=(230, 220, 60), width=6)
    if label:
        draw.text((24, 20), label, fill=(255, 255, 255))
    return img
def _dms_tuple(value: float):
    """Convert a decimal degree into an EXIF DMS ((d,1),(m,1),(s,10000)) triple."""
    deg = int(value)
    minutes_float = (abs(value) - abs(deg)) * 60
    minutes = int(minutes_float)
    seconds = round((minutes_float - minutes) * 60, 4)
    seconds_den = 10000
    return ((abs(deg), 1), (minutes, 1), (int(round(seconds * seconds_den)), seconds_den))


def save_with_exif(img: Image.Image, path, lat=None, lng=None, captured_at=None):
    """Save an image with GPS / timestamp EXIF baked in (via piexif)."""
    import piexif

    def to_deg(value, is_lat):
        if is_lat:
            ref = b"N" if value >= 0 else b"S"
        else:
            ref = b"E" if value >= 0 else b"W"
        return ref, _dms_tuple(value)

    exif_dict = {"0th": {}, "Exif": {}, "GPS": {}, "1st": {}, "thumbnail": None}
    if captured_at is not None:
        exif_dict["Exif"][piexif.ExifIFD.DateTimeOriginal] = captured_at.strftime(
            "%Y:%m:%d %H:%M:%S"
        ).encode("ascii")
    if lat is not None and lng is not None:
        lat_ref, lat_dms = to_deg(lat, True)
        lng_ref, lng_dms = to_deg(lng, False)
        gps = exif_dict["GPS"]
        gps[piexif.GPSIFD.GPSVersionID] = (2, 3, 0, 0)
        gps[piexif.GPSIFD.GPSLatitudeRef] = lat_ref
        gps[piexif.GPSIFD.GPSLatitude] = lat_dms
        gps[piexif.GPSIFD.GPSLongitudeRef] = lng_ref
        gps[piexif.GPSIFD.GPSLongitude] = lng_dms
        if captured_at is not None:
            gps[piexif.GPSIFD.GPSDateStamp] = captured_at.strftime("%Y:%m:%d").encode("ascii")
            gps[piexif.GPSIFD.GPSTimeStamp] = (
                (captured_at.hour, 1), (captured_at.minute, 1), (captured_at.second, 1)
            )
    exif_bytes = piexif.dump(exif_dict)
    img.save(str(path), "JPEG", quality=94, exif=exif_bytes)


def build_scenario_images(out_dir, project_coords=(19.076, 72.878)) -> dict:
    """Create the five demo photos and return {scenario: absolute_path}."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    now = datetime.now(timezone.utc)
    fresh = now - timedelta(hours=18)
    old = now - timedelta(days=120)
    lat, lng = project_coords
    far_lat = min(lat + 4.0, 34.0)  # ~445 km north at these latitudes

    paths = {}
    valid = out_dir / "valid.jpg"
    save_with_exif(make_base_image(seed=11, label="valid"), valid,
                   lat=lat, lng=lng, captured_at=fresh)
    paths["valid"] = str(valid)

    no_gps = out_dir / "no_gps.jpg"
    make_base_image(seed=22, label="no_gps").save(str(no_gps), "JPEG", quality=94)
    paths["no_gps"] = str(no_gps)

    far = out_dir / "far_away.jpg"
    save_with_exif(make_base_image(seed=33, label="far"), far,
                   lat=far_lat, lng=lng, captured_at=fresh)
    paths["far_away"] = str(far)

    old_img = out_dir / "old.jpg"
    save_with_exif(make_base_image(seed=44, label="old"), old_img,
                   lat=lat, lng=lng, captured_at=old)
    paths["old"] = str(old_img)

    duplicate = out_dir / "duplicate.jpg"
    shutil.copy2(valid, duplicate)
    paths["duplicate"] = str(duplicate)

    return paths


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate mock verification photos.")
    parser.add_argument("out_dir", help="Directory to write the five demo JPEGs")
    parser.add_argument("--project-coords", default="19.076,72.878",
                        help="Expected site lat,lng used for the valid/duplicate/old photos")
    args = parser.parse_args()
    try:
        lat, lng = (float(x) for x in args.project_coords.split(","))
    except ValueError:
        parser.error("--project-coords must look like '19.076,72.878'")
    paths = build_scenario_images(args.out_dir, (lat, lng))
    print(f"Wrote {len(paths)} mock images to {args.out_dir}")
    for name, path in paths.items():
        print(f"  {name:<12} -> {path}")


if __name__ == "__main__":
    main()