#!/usr/bin/env python3
"""
Build index.html for the Product on Shelf Apps Script web app from src/ partials.

Why: Apps Script has no build step and one 5,300-line index.html is hard to read/maintain.
The editable source is split by concern (head, shell, one panel per product, one script
IIFE per flow) and lives under src/. clasp pushes those partials as separate Apps Script
files, and index.html is a thin "include manifest" that stitches them back together at
serve time via HtmlService templating (<?!= include('src/...') ?>). Code.gs serves it with
createTemplateFromFile('index').evaluate(). Logic stays load-order-sensitive (core/router/
cart load before the flow IIFEs), so the MANIFEST order below is the contract.

Usage:
  python3 build.py                 # regenerate index.html (the include manifest) from MANIFEST
  python3 build.py --preview       # write preview.html = concatenated monolith (browser-openable, local only)
  python3 build.py --preview --out FILE   # write the concatenation somewhere else (diff verification)
  python3 build.py --split FILE    # one-time: slice an existing monolithic FILE into src/

Header row of the manifest is (relative_path, start_line, end_line). start/end are only
used by --split; build/preview ignore them and just use the listed order.
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
    ("flows/_pricelist.html",         0,    0),    # added post-split; line range unused by build/preview
    ("flows/firewall.html",           2661, 2845),
    ("flows/fwlist.html",             0,    0),    # added post-split; line range unused by build/preview
    ("flows/hci.html",                2846, 3011),
    ("flows/switch.html",             3012, 3164),
    ("flows/storage.html",            3165, 3331),
    ("flows/backup.html",             3332, 3446),
    ("flows/firewall_new.html",       3447, 3600),
    ("flows/switch_new.html",         3601, 3746),
    ("flows/server_new.html",         3747, 3904),
    ("flows/storage_new.html",        3905, 4051),
    ("flows/wireless.html",           4052, 4170),
    ("flows/wireless_rep.html",       0,    0),    # added post-split; line range unused by build/preview
    ("flows/endpoint.html",           4171, 4279),
    ("flows/m365.html",               4280, 4383),
    ("flows/ws.html",                 4384, 4506),
    ("flows/nac.html",                4507, 4610),
    ("flows/dlp.html",                4611, 4714),
    ("flows/captive.html",            4715, 4816),
    ("flows/siem.html",               4817, 4913),
    ("flows/virt.html",               4914, 5035),
    ("flows/server_standalone.html",  5036, 5108),
    ("flows/server_rep.html",         0,    0),    # added post-split; line range unused by build/preview
    ("flows/router.html",             5109, 5178),
    ("flows/router_rep.html",         0,    0),    # added post-split; line range unused by build/preview
    ("flows/adc.html",                5179, 5250),
    ("flows/adc_rep.html",            0,    0),    # added post-split; line range unused by build/preview
    ("flows/ups.html",                5251, 5323),
    ("flows/ups_rep.html",            0,    0),    # added post-split; line range unused by build/preview
    ("flows/emailsase.html",          5324, 5391),
    ("99_foot.html",                  5392, 5393),
]


def include_name(rel):
    """src/ partial path -> the name include() / clasp use (no .html extension)."""
    return "src/" + rel[: -len(".html")]


def do_build_index(out_path):
    """Write index.html: the include manifest that Apps Script evaluates as a template."""
    lines = [
        # No-output scriptlet so the first emitted byte is still <!DOCTYPE (no quirks mode).
        "<? /* AUTO-GENERATED by build.py from src/ + MANIFEST. Edit the partials, not this file."
        " Served via HtmlService.createTemplateFromFile('index').evaluate() in Code.gs. */ ?>"
        "<?!= include('" + include_name(MANIFEST[0][0]) + "') ?>",
        # Read path: inject window.PRICING server-side, BEFORE the flow scripts run. Code.gs sets the
        # PRICING_JSON template var (ReadPath.gs:posPricingJson_); google.script.run would be too late.
        "<script>window.PRICING = <?!= PRICING_JSON ?>;</script>",
    ]
    for rel, _a, _b in MANIFEST[1:]:
        lines.append(f"<?!= include('{include_name(rel)}') ?>")
    with open(out_path, "w", encoding="utf-8") as out:
        out.write("\n".join(lines) + "\n")
    print(f"built {out_path}: include manifest of {len(MANIFEST)} partials")


def do_preview(out_path):
    """Concatenate src/ into a single browser-openable monolith (local preview only)."""
    parts = []
    for rel, _a, _b in MANIFEST:
        with open(os.path.join(SRC, rel), encoding="utf-8") as f:
            parts.append(f.read())
    with open(out_path, "w", encoding="utf-8") as out:
        out.write("".join(parts))
    print(f"built {out_path} from {len(MANIFEST)} files (preview monolith)")


def do_split(index_path):
    with open(index_path, encoding="utf-8") as f:
        lines = f.readlines()  # keeps '\n'
    for rel, a, b in MANIFEST:
        dst = os.path.join(SRC, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        with open(dst, "w", encoding="utf-8") as out:
            out.write("".join(lines[a - 1:b]))
    print(f"split {index_path} -> {len(MANIFEST)} files under {SRC}/")


if __name__ == "__main__":
    args = sys.argv[1:]
    if "--split" in args:
        i = args.index("--split")
        src_file = args[i + 1] if i + 1 < len(args) else os.path.join(ROOT, "preview.html")
        do_split(src_file)
    elif "--preview" in args:
        out = "preview.html"
        if "--out" in args:
            out = args[args.index("--out") + 1]
        do_preview(os.path.join(ROOT, out))
    else:
        do_build_index(os.path.join(ROOT, "index.html"))
