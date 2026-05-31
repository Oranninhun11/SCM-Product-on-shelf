#!/usr/bin/env python3
"""
Build index.html for the Product on Shelf Apps Script web app from src/ partials.

Why: Apps Script has no build step and one 5,300-line index.html is hard to maintain.
We keep editable source split by concern (head, shell, one panel per product, one
script IIFE per flow) and concatenate them — in the SAME order as the original file —
into a single self-contained index.html that clasp pushes and that still opens directly
in a browser for local preview. Logic stays load-order-sensitive (core/router/cart load
before the flow IIFEs), so the manifest order is the contract.

Usage:
  python3 build.py                 # concatenate src/ -> index.html
  python3 build.py --out FILE      # write somewhere else (for diff verification)
  python3 build.py --split         # one-time: slice an existing index.html into src/
                                   #   files using the line ranges below

Header row of the manifest is (relative_path, start_line, end_line). start/end are only
used by --split; --build ignores them and just concatenates in listed order.
"""
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src")

# Ordered partition of the original index.html. Lines are 1-based, inclusive,
# contiguous, no gaps/overlaps — so concatenation reproduces the file exactly.
MANIFEST = [
    ("00_head.html",                  1,   140),
    ("01_shell_top.html",             141, 216),
    ("panels/guide.html",             217, 303),
    ("panels/home.html",              304, 454),
    ("panels/firewall.html",          455, 599),
    ("panels/switch.html",            600, 755),
    ("panels/hci.html",               756, 926),
    ("panels/storage.html",           927, 1089),
    ("panels/backup.html",            1090, 1148),
    ("panels/wireless.html",          1149, 1229),
    ("panels/endpoint.html",          1230, 1302),
    ("panels/m365.html",              1303, 1367),
    ("panels/ws.html",                1368, 1425),
    ("panels/nac.html",               1426, 1490),
    ("panels/dlp.html",               1491, 1563),
    ("panels/captive.html",           1564, 1636),
    ("panels/siem.html",              1637, 1709),
    ("panels/server.html",            1710, 1790),
    ("panels/router.html",            1791, 1864),
    ("panels/adc.html",               1865, 1945),
    ("panels/ups.html",               1946, 2030),
    ("panels/esec.html",              2031, 2102),
    ("panels/virt.html",              2103, 2184),
    ("panels/custom.html",            2185, 2224),
    ("panels/uikit.html",             2225, 2286),
    ("panels/settings.html",          2287, 2305),
    ("02_shell_bottom.html",          2306, 2310),
    ("flows/_core.html",              2311, 2369),
    ("flows/_navdrawer.html",         2370, 2393),
    ("flows/_cart.html",              2394, 2572),
    ("flows/_quote.html",             2573, 2660),
    ("flows/firewall.html",           2661, 2845),
    ("flows/hci.html",                2846, 3011),
    ("flows/switch.html",             3012, 3164),
    ("flows/storage.html",            3165, 3331),
    ("flows/backup.html",             3332, 3446),
    ("flows/firewall_new.html",       3447, 3600),
    ("flows/switch_new.html",         3601, 3746),
    ("flows/server_new.html",         3747, 3904),
    ("flows/storage_new.html",        3905, 4051),
    ("flows/wireless.html",           4052, 4170),
    ("flows/endpoint.html",           4171, 4279),
    ("flows/m365.html",               4280, 4383),
    ("flows/ws.html",                 4384, 4506),
    ("flows/nac.html",                4507, 4610),
    ("flows/dlp.html",                4611, 4714),
    ("flows/captive.html",            4715, 4816),
    ("flows/siem.html",               4817, 4913),
    ("flows/virt.html",               4914, 5035),
    ("flows/server_standalone.html",  5036, 5108),
    ("flows/router.html",             5109, 5178),
    ("flows/adc.html",                5179, 5250),
    ("flows/ups.html",                5251, 5323),
    ("flows/emailsase.html",          5324, 5391),
    ("99_foot.html",                  5392, 5393),
]


def do_split(index_path):
    with open(index_path, encoding="utf-8") as f:
        lines = f.readlines()  # keeps '\n'
    for rel, a, b in MANIFEST:
        dst = os.path.join(SRC, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        with open(dst, "w", encoding="utf-8") as out:
            out.write("".join(lines[a - 1:b]))
    print(f"split {index_path} -> {len(MANIFEST)} files under {SRC}/")


def do_build(out_path):
    parts = []
    for rel, _a, _b in MANIFEST:
        src = os.path.join(SRC, rel)
        with open(src, encoding="utf-8") as f:
            parts.append(f.read())
    with open(out_path, "w", encoding="utf-8") as out:
        out.write("".join(parts))
    print(f"built {out_path} from {len(MANIFEST)} files")


if __name__ == "__main__":
    args = sys.argv[1:]
    if "--split" in args:
        do_split(os.path.join(ROOT, "index.html"))
    else:
        out = "index.html"
        if "--out" in args:
            out = args[args.index("--out") + 1]
        do_build(os.path.join(ROOT, out))
