#!/usr/bin/env python3
"""OKLCH and sRGB colour maths for the colour desk: convert, and measure WCAG 2.2 and APCA contrast.

    python3 scripts/contrast.py "oklch(0.22 0.012 150)" "oklch(0.985 0.004 150)"
    python3 scripts/contrast.py "#1f2a22" "#f7f9f7"
    python3 scripts/contrast.py --ramp 150 0.012          # print a neutral ramp for a hue with hex values

Accepts oklch(L C h), oklch(L% C h), #rgb, #rrggbb, rgb(r g b) and rgb(r, g, b). Prints the sRGB hex of each colour
(clipped when out of gamut, with a note), the WCAG ratio with the floors it meets, and the APCA Lc value.
Sources: Ottosson, OKLab (bottosson.github.io/posts/oklab); WCAG 2.2 1.4.3 and 1.4.11; APCA-W3 0.1.9 constants.
"""
import math
import re
import sys


def oklch_to_linear_srgb(L, C, h):
    a = C * math.cos(math.radians(h))
    b = C * math.sin(math.radians(h))
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    return (
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    )


def linear_to_srgb(v):
    v = min(1.0, max(0.0, v))
    return 12.92 * v if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055


def srgb_to_linear(v):
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def parse(css):
    s = css.strip().lower()
    m = re.match(r"oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)", s)
    if m:
        L = float(m.group(1)) / (100 if m.group(2) else 1)
        lin = oklch_to_linear_srgb(L, float(m.group(3)), float(m.group(4)))
        clipped = any(v < -0.002 or v > 1.002 for v in lin)
        return tuple(min(1.0, max(0.0, v)) for v in lin), clipped
    m = re.match(r"#([0-9a-f]{3}|[0-9a-f]{6})$", s)
    if m:
        hx = m.group(1)
        if len(hx) == 3:
            hx = "".join(c * 2 for c in hx)
        rgb = tuple(int(hx[i:i + 2], 16) / 255 for i in (0, 2, 4))
        return tuple(srgb_to_linear(v) for v in rgb), False
    m = re.match(r"rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)", s)
    if m:
        rgb = tuple(float(m.group(i)) / 255 for i in (1, 2, 3))
        return tuple(srgb_to_linear(v) for v in rgb), False
    raise SystemExit(f"cannot parse colour: {css}")


def to_hex(lin):
    return "#" + "".join(f"{round(linear_to_srgb(v) * 255):02x}" for v in lin)


def luminance(lin):
    r, g, b = lin
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def wcag(fg, bg):
    l1, l2 = sorted((luminance(fg), luminance(bg)), reverse=True)
    return (l1 + 0.05) / (l2 + 0.05)


def apca(fg, bg):
    """APCA-W3 0.1.9 (SAPC-4g). Returns Lc, positive for dark text on light, negative for light on dark."""
    def y(lin):
        r, g, b = (linear_to_srgb(v) for v in lin)
        return 0.2126729 * r ** 2.4 + 0.7151522 * g ** 2.4 + 0.0721750 * b ** 2.4

    def clamp(v):
        return v if v > 0.022 else v + (0.022 - v) ** 1.414

    ytxt, ybg = clamp(y(fg)), clamp(y(bg))
    if abs(ybg - ytxt) < 0.0005:
        return 0.0
    if ybg > ytxt:
        sapc = (ybg ** 0.56 - ytxt ** 0.57) * 1.14
        out = 0.0 if sapc < 0.1 else sapc - 0.027
    else:
        sapc = (ybg ** 0.65 - ytxt ** 0.62) * 1.14
        out = 0.0 if sapc > -0.1 else sapc + 0.027
    return out * 100


def describe_pair(a, b):
    fg, clip_a = parse(a)
    bg, clip_b = parse(b)
    ratio = wcag(fg, bg)
    lc = apca(fg, bg)
    floors = []
    floors.append("AA body 4.5:1 " + ("pass" if ratio >= 4.5 else "fail"))
    floors.append("AA large and UI 3:1 " + ("pass" if ratio >= 3 else "fail"))
    floors.append("AAA body 7:1 " + ("pass" if ratio >= 7 else "fail"))
    apca_floor = "body Lc 75 " + ("pass" if abs(lc) >= 75 else "fail") + "; UI label Lc 60 " + ("pass" if abs(lc) >= 60 else "fail") + "; large Lc 45 " + ("pass" if abs(lc) >= 45 else "fail")
    print(f"fg {a} -> {to_hex(fg)}{' (clipped to gamut)' if clip_a else ''}")
    print(f"bg {b} -> {to_hex(bg)}{' (clipped to gamut)' if clip_b else ''}")
    print(f"WCAG {ratio:.2f}:1   {'; '.join(floors)}")
    print(f"APCA Lc {lc:+.1f}   {apca_floor}")


def ramp(hue, chroma):
    print(f"Neutral ramp for hue {hue}, chroma {chroma}")
    for L in (0.985, 0.965, 0.93, 0.90, 0.80, 0.70, 0.62, 0.56, 0.45, 0.35, 0.28, 0.22, 0.17, 0.13):
        lin, clipped = parse(f"oklch({L} {chroma} {hue})")
        print(f"  L {L:<5} {to_hex(lin)}{'  clipped' if clipped else ''}")


if __name__ == "__main__":
    argv = sys.argv[1:]
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        sys.exit(0)
    if argv[0] == "--ramp":
        ramp(float(argv[1]), float(argv[2]) if len(argv) > 2 else 0.008)
    elif len(argv) == 1:
        lin, clipped = parse(argv[0])
        print(f"{argv[0]} -> {to_hex(lin)}{' (clipped to gamut)' if clipped else ''}  luminance {luminance(lin):.4f}")
    else:
        describe_pair(argv[0], argv[1])
