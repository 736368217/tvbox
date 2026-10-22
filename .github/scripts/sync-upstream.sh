#!/usr/bin/env bash
set -euo pipefail

branch="${1:-123}"
upstream_ref="upstream/master"

if ! git remote get-url upstream >/dev/null 2>&1; then
  git remote add upstream https://github.com/qist/tvbox.git
fi

readme_backup="$(mktemp)"
aidongman_backup="$(mktemp)"
cp xiaosa/README.md "$readme_backup"
cp xiaosa/js/爱动漫.js "$aidongman_backup"
trap 'rm -f "$readme_backup" "$aidongman_backup"' EXIT

git fetch --depth=1 upstream master

# 只同步上游的 xiaosa 目录；不合并其他配置、jar、直播源等文件。
git checkout "$upstream_ref" -- xiaosa
mkdir -p xiaosa/js
cp "$readme_backup" xiaosa/README.md
cp "$aidongman_backup" xiaosa/js/爱动漫.js

# 爱动漫固定放在站点列表第一位；随后按 api.json 引用裁剪 xiaosa 文件，并清理根目录其他内容。
node .github/scripts/ensure-aidongman.mjs search "$branch"
node .github/scripts/prepare-xiaosa.mjs

node --check .github/scripts/ensure-aidongman.mjs
node --check .github/scripts/prepare-xiaosa.mjs
node -e "const d=require('./xiaosa/api.json'); if (!Array.isArray(d.sites) || !d.sites.length || d.sites[0].key !== '爱动漫') process.exit(1)"
test -f xiaosa/spider.jar
test -f xiaosa/js/爱动漫.js

git add -A
if git diff --cached --quiet; then
  echo "xiaosa 订阅已是最新"
  exit 0
fi

git commit -m "sync: update xiaosa api only"
git push origin "HEAD:$branch"
