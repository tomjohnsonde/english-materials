"""Regenerate the QR from siteUrl. Requires Pillow and qrcode==8.2."""
import json
from pathlib import Path
import qrcode
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
data_source = (ROOT / 'assets/data.js').read_text()
site = json.JSONDecoder().raw_decode(data_source.split('=', 1)[1].lstrip())[0]
code = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_Q, box_size=1, border=4)
code.add_data(site['siteUrl'])
code.make(fit=True)
# Integral scaling keeps every module sharp; retain a white margin of >=4 modules.
raw = code.make_image(fill_color='black', back_color='white').convert('RGB')
scale = 1200 // raw.width
scaled = raw.resize((raw.width * scale, raw.height * scale), Image.Resampling.NEAREST)
canvas = Image.new('RGB', (1200, 1200), 'white')
canvas.paste(scaled, ((1200 - scaled.width) // 2, (1200 - scaled.height) // 2))
canvas.save(ROOT / 'assets/qr-english-materials.png', optimize=True)
print(f"QR generated for {site['siteUrl']}")
