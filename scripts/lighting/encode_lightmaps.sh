#!/usr/bin/env bash
# Encode the baked lightmaps (scripts/lighting/bake_studio_gi.py) to KTX2 and
# install them into the app.
#
#   scripts/lighting/encode_lightmaps.sh /tmp/wooz-lightmaps [auxRes]
#
# lm_sky.png → public/models/v2/studio-lm-sky.ktx2  2048², ETC1S q255, sRGB, mips
#              (~0.65 MB; UASTC is ~2.9 MB here and RDO barely helps because the
#              map carries plant/cloth detail. ETC1S shows no visible blocking on
#              this smooth, albedo-modulated data.)
# lm_aux.png → public/models/v2/studio-lm-aux.ktx2  1024², UASTC + RDO + zstd
#              (R/G are independent data → ETC1S would cross-talk; the lamp and
#              sun-bounce channels are very low frequency, so 1024 is plenty)
# lightmap.json → app/three/v2/lighting/lightmap.json (decode scales)
#
# Needs `basisu` (brew install basis_universal) and macOS `sips` for resizing.
set -euo pipefail
IN=${1:-/tmp/wooz-lightmaps}
AUX_RES=${2:-1024}
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
DST="$ROOT/public/models/v2"
TMP=$(mktemp -d)

AUX="$IN/lm_aux.png"
if [[ -n "$AUX_RES" ]]; then
  cp "$AUX" "$TMP/lm_aux.png"
  sips -z "$AUX_RES" "$AUX_RES" "$TMP/lm_aux.png" >/dev/null
  AUX="$TMP/lm_aux.png"
fi

enc_etc1s() {
  basisu -ktx2 -q 255 -mipmap -mip_srgb "$1" -output_file "$2" >/dev/null
  echo "$(basename "$2"): $(stat -f%z "$2") bytes"
}

enc() {
  basisu -ktx2 -uastc -uastc_level 2 -uastc_rdo_l "$3" -uastc_rdo_d 8192 \
    -ktx2_zstandard_level 20 -mipmap -mip_srgb "$1" -output_file "$2" >/dev/null
  echo "$(basename "$2"): $(stat -f%z "$2") bytes"
}

enc_etc1s "$IN/lm_sky.png" "$DST/studio-lm-sky.ktx2"
enc "$AUX" "$DST/studio-lm-aux.ktx2" 1.0
cp "$IN/lightmap.json" "$ROOT/app/three/v2/lighting/lightmap.json"
rm -rf "$TMP"
