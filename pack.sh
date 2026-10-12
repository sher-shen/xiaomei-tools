#!/bin/bash
# 把每个小工具各自打成独立 zip（index.html 在 zip 根目录），输出到 dist/
# 用法: ./pack.sh        只打包已存在的目录
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="$ROOT/dist"
mkdir -p "$OUT"
for d in 00-sandbox-test 01-shufa-wallpaper 02-bookplate 03-crochet-chart; do
  if [ ! -f "$ROOT/$d/index.html" ]; then
    echo "跳过 $d（目录或 index.html 不存在）"
    continue
  fi
  rm -f "$OUT/$d.zip"
  # 在目录内部打包，保证 index.html 位于 zip 根；排除脚本、测试文件和系统杂项
  (cd "$ROOT/$d" && zip -qr "$OUT/$d.zip" . \
    -x '.*' -x '*/.*' -x '*.sh' -x 'test-*.js' -x '*.map')
  echo "$d.zip  $(du -h "$OUT/$d.zip" | cut -f1)  ($(stat -f%z "$OUT/$d.zip" 2>/dev/null || stat -c%s "$OUT/$d.zip") 字节)"
done
