import zlib
import struct

def crc32(buf):
    crc = 0xffffffff
    for b in buf:
        crc ^= b
        for _ in range(8):
            crc = (crc >> 1) ^ (0xedb88320 & -(crc & 1))
    return (crc ^ 0xffffffff) & 0xffffffff

def make_chunk(type_str, data):
    length = struct.pack('>I', len(data))
    type_bytes = type_str.encode('ascii')
    crc = struct.pack('>I', crc32(type_bytes + data))
    return length + type_bytes + data + crc

def create_png(width, height, color):
    r, g, b, a = color
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    scanline = bytes([0]) + bytes([r, g, b, a]) * width
    raw = scanline * height
    compressed = zlib.compress(raw, 1)
    sig = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    png = sig + make_chunk('IHDR', ihdr) + make_chunk('IDAT', compressed) + make_chunk('IEND', b'')
    return png

colors = [
    (13, 27, 42, 255),
    (20, 40, 60, 255),
    (40, 25, 15, 255),
    (20, 45, 30, 255),
]
names = ['01-cover.png', '02-delivery.png', '03-rings.png', '04-survey.png']

for name, color in zip(names, colors):
    png = create_png(1280, 720, color)
    with open(name, 'wb') as f:
        f.write(png)
    print(f'{name}: {len(png)} bytes')