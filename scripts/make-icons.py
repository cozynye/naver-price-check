#!/usr/bin/env python3
"""둥근 사각형 배경 위에 돋보기를 그린 익스텐션 아이콘(PNG)을 만든다. 표준 라이브러리만 쓴다."""
import math, os, struct, zlib

BG = (0x2F, 0x7F, 0x6F)      # 짙은 청록. 네이버 색(초록 #03C75A)이 아니다.
FG = (0xFF, 0xFF, 0xFF)
SIZES = (16, 32, 48, 128)
SS = 4                        # 슈퍼샘플링 배수

def coverage(x, y, size):
    """점 (x, y)가 배경 안이면 1, 전경(돋보기) 안이면 2, 밖이면 0."""
    s = size
    r = s * 0.22
    # 둥근 사각형
    cx = min(max(x, r), s - r); cy = min(max(y, r), s - r)
    if (x - cx) ** 2 + (y - cy) ** 2 > r * r:
        return 0
    # 렌즈: 중심 (0.42s, 0.42s), 바깥 반지름 0.26s, 두께 0.085s
    lx, ly, lr, lw = s * 0.42, s * 0.42, s * 0.26, s * 0.085
    d = math.hypot(x - lx, y - ly)
    if lr - lw <= d <= lr:
        return 2
    # 손잡이: 렌즈 오른아래 방향 선분, 두께 0.11s
    hx0, hy0 = lx + lr * 0.72, ly + lr * 0.72
    hx1, hy1 = s * 0.80, s * 0.80
    vx, vy = hx1 - hx0, hy1 - hy0
    t = max(0.0, min(1.0, ((x - hx0) * vx + (y - hy0) * vy) / (vx * vx + vy * vy)))
    if math.hypot(x - (hx0 + t * vx), y - (hy0 + t * vy)) <= s * 0.055:
        return 2
    return 1

def render(size):
    rows = []
    for py in range(size):
        row = bytearray()
        for px in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(SS):
                for sx in range(SS):
                    x = (px * SS + sx + 0.5) / SS
                    y = (py * SS + sy + 0.5) / SS
                    c = coverage(x, y, size)
                    if c == 0:
                        continue
                    col = FG if c == 2 else BG
                    acc[0] += col[0]; acc[1] += col[1]; acc[2] += col[2]; acc[3] += 255
            n = SS * SS
            a = acc[3] // n
            if a == 0:
                row += bytes((0, 0, 0, 0))
            else:
                k = acc[3] / 255.0
                row += bytes((int(acc[0] / k), int(acc[1] / k), int(acc[2] / k), a))
        rows.append(bytes(row))
    return rows

def png(size, rows):
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    raw = b"".join(b"\x00" + r for r in rows)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))

def main():
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "icons")
    os.makedirs(out, exist_ok=True)
    for s in SIZES:
        path = os.path.join(out, f"icon{s}.png")
        with open(path, "wb") as f:
            f.write(png(s, render(s)))
        print("wrote", os.path.relpath(path))

if __name__ == "__main__":
    main()
