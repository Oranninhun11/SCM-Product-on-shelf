#!/usr/bin/env bash
#
# shot.sh — screenshot index.html in headless Chrome for quick visual verification.
#
# The app is a single self-contained index.html (no build step), so the fastest way to
# eyeball a change is to render it. This wraps the Chrome headless incantation and can
# optionally drive the page first (open a view, seed the cart) so you can shoot any state.
#
# Usage:
#   tools/shot.sh                                  # home, desktop 1280x800 -> /tmp/pos-shot.png
#   tools/shot.sh --nav custom                     # open the Custom-estimate view
#   tools/shot.sh --nav custom --seed-cart         # ...with a sample line in the cart
#   tools/shot.sh --width 500 --height 860         # mobile (NB: Chrome clamps min width ~500px)
#   tools/shot.sh --nav firewall --out /tmp/fw.png
#
# Then open the PNG (or Read it, if you're an agent).

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # repo: product-on-shelf/
SRC="$HERE/index.html"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

NAV="" ; SEED=0 ; W=1280 ; H=800 ; OUT="/tmp/pos-shot.png"
while [ $# -gt 0 ]; do
  case "$1" in
    --nav)       NAV="$2"; shift 2 ;;
    --seed-cart) SEED=1; shift ;;
    --width)     W="$2"; shift 2 ;;
    --height)    H="$2"; shift 2 ;;
    --out)       OUT="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

[ -x "$CHROME" ] || { echo "Chrome not found at: $CHROME" >&2; exit 1; }
[ -f "$SRC" ]     || { echo "index.html not found at: $SRC" >&2; exit 1; }

TARGET="$SRC"

# If we need to drive the page, build a throwaway harness (keeps index.html untouched).
if [ -n "$NAV" ] || [ "$SEED" = "1" ]; then
  TARGET="$(mktemp /tmp/pos-harness.XXXXXX.html)"
  {
    js="window.addEventListener('load',function(){setTimeout(function(){"
    if [ "$SEED" = "1" ]; then
      js="$js if(window.PoSEstimate){window.PoSEstimate.set({id:'Firewall',category:'Firewall',title:'Fortinet',desc:'FortiGate 120G',breakdown:[{label:'Device',value:'฿120,000'}],total:473000});}"
    fi
    if [ -n "$NAV" ]; then
      js="$js var n=document.querySelector('[data-nav=\"$NAV\"]'); if(n)n.click();"
    fi
    js="$js if(window.lucide)lucide.createIcons();},250);});"
    # inject the harness script just before </body>
    sed "s#</body>#<script>$js</script></body>#" "$SRC"
  } > "$TARGET"
fi

"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --virtual-time-budget=6000 --window-size="$W,$H" \
  --screenshot="$OUT" "file://$TARGET" 2>/dev/null

echo "wrote $OUT  (${W}x${H}${NAV:+, nav=$NAV}${SEED:+, seeded})"
