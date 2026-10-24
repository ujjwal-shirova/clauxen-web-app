import json
import os
import io
import tarfile
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

ICONS_DIR = "public/cdn/plugins/icons"
BUNDLE_TAR = "public/cdn/plugin-icons-bundle.tar"
os.makedirs(ICONS_DIR, exist_ok=True)

with open("src/client/components/plugins/marketplace-catalog.json", "r", encoding="utf-8") as f:
    catalog = json.load(f)

plugins = catalog["plugins"]

headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def download_icon(plugin_id, url):
    dest_path = os.path.join(ICONS_DIR, f"{plugin_id}.png")
    if os.path.exists(dest_path) and os.path.getsize(dest_path) > 100:
        return plugin_id, True, "already exists"
    
    if not url:
        return plugin_id, False, "no url"
        
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            data = response.read()
            if len(data) > 0:
                with open(dest_path, "wb") as f:
                    f.write(data)
                return plugin_id, True, f"{len(data)} bytes"
            else:
                return plugin_id, False, "empty data"
    except Exception as e:
        return plugin_id, False, str(e)

print(f"Downloading icons for {len(plugins)} plugins...")

success_count = 0
fail_count = 0

with ThreadPoolExecutor(max_workers=20) as executor:
    futures = {
        executor.submit(download_icon, pid, p.get("iconUrl", "")): pid
        for pid, p in plugins.items()
    }
    for future in as_completed(futures):
        pid, success, msg = future.result()
        if success:
            success_count += 1
        else:
            fail_count += 1
            print(f"Failed {pid}: {msg}")

print(f"Downloaded: {success_count}, Failed/Missing: {fail_count}")

# Generate default icons for any missing plugins
def make_simple_png(color_bg, letter):
    # If PIL is available, use it, else make a simple valid 1x1 or SVG
    try:
        from PIL import Image, ImageDraw, ImageFont
        img = Image.new("RGBA", (128, 128), color=color_bg)
        draw = ImageDraw.Draw(img)
        # Draw letter
        draw.text((48, 40), letter, fill="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()
    except ImportError:
        # Minimal valid 64x64 PNG binary
        import zlib, struct
        # Generate basic uncompressed PNG
        width, height = 64, 64
        raw_data = b"".join(b"\x00" + bytes(color_bg) * width for _ in range(height))
        compressed = zlib.compress(raw_data)
        png = b"\x89PNG\r\n\x1a\n"
        png += struct.pack(">I", 13) + b"IHDR" + struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
        png += struct.pack(">I", zlib.crc32(b"IHDR" + struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)))
        png += struct.pack(">I", len(compressed)) + b"IDAT" + compressed
        png += struct.pack(">I", zlib.crc32(b"IDAT" + compressed))
        png += struct.pack(">I", 0) + b"IEND" + struct.pack(">I", zlib.crc32(b"IEND"))
        return png

for pid in plugins:
    path = os.path.join(ICONS_DIR, f"{pid}.png")
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        print(f"Creating fallback icon for {pid}...")
        first_char = pid[:1].upper()
        # Choose color
        if "health" in pid:
            bg = (229, 57, 53, 255)
        elif "cli" in pid:
            bg = (30, 41, 59, 255)
        else:
            bg = (14, 165, 233, 255)
        data = make_simple_png(bg, first_char)
        with open(path, "wb") as f:
            f.write(data)

# Create tar archive
print(f"Packing icons into {BUNDLE_TAR}...")
with tarfile.open(BUNDLE_TAR, "w") as tar:
    for filename in sorted(os.listdir(ICONS_DIR)):
        if filename.endswith(".png"):
            filepath = os.path.join(ICONS_DIR, filename)
            tar.add(filepath, arcname=filename)

bundle_size = os.path.getsize(BUNDLE_TAR)
print(f"Bundle created successfully! Size: {bundle_size / 1024:.2f} KB ({len(os.listdir(ICONS_DIR))} icons)")
