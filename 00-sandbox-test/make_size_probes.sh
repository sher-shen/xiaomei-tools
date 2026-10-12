#!/bin/bash
# 生成 3 个体积探针 zip（整体约 5/15/30 MB，随机数据不可压缩；macOS 的 stat -f%z），用于测试小红书小工具 zip 上传大小上限
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/../dist/probes"
mkdir -p "$OUT"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
for MB in 5 15 30; do
  D="$TMP/probe-${MB}mb"
  mkdir -p "$D"
  cp "$HERE/index.html" "$D/"
  cp -R "$HERE/fonts" "$D/"
  # 填充文件 = 目标体积 - 测试页与字体已占体积，使整个 zip 约等于 MB
  BASE=$(( $(stat -f%z "$HERE/index.html") + $(stat -f%z "$HERE/fonts/test.woff2") + $(stat -f%z "$HERE/fonts/OFL.txt") ))
  PAD=$(( MB * 1048576 - BASE ))
  head -c "$PAD" /dev/urandom > "$D/pad.bin"
  rm -f "$OUT/probe-${MB}mb.zip"
  (cd "$D" && zip -qr "$OUT/probe-${MB}mb.zip" index.html fonts pad.bin)
  echo "probe-${MB}mb.zip  $(du -h "$OUT/probe-${MB}mb.zip" | cut -f1)  ($(stat -f%z "$OUT/probe-${MB}mb.zip" 2>/dev/null || stat -c%s "$OUT/probe-${MB}mb.zip") bytes)"
done
echo "输出目录: $(cd "$OUT" && pwd)"
