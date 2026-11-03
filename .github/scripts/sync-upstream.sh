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

# 上游 spider.jar 带加固壳：运行时会校验宿主包名 / 应用名 / 签名，
# 不匹配就直接对自身进程发 SIGKILL（白盒 TVBox 十几秒必闪退）。
# 这里用它原地的 DEX 补丁：Init.a/b/c 分别改成 return true/true/false，
# 并把 Init$3.run() 等处的 killProcess 置 nop，然后回写 api.json 的 md5。
python3 tools/patch_jar.py xiaosa/spider.jar xiaosa/spider.patched.jar
mv xiaosa/spider.patched.jar xiaosa/spider.jar
python3 tools/update_config.py xiaosa/api.json xiaosa/api.patched.json xiaosa/spider.jar
mv xiaosa/api.patched.json xiaosa/api.json

# 爱动漫固定放在站点列表第一位；随后按 api.json 引用裁剪 xiaosa 文件，并清理根目录其他内容。
node .github/scripts/ensure-aidongman.mjs search "$branch"
node .github/scripts/prepare-xiaosa.mjs

node --check .github/scripts/ensure-aidongman.mjs
node --check .github/scripts/prepare-xiaosa.mjs
node -e "const d=require('./xiaosa/api.json'); if (!Array.isArray(d.sites) || !d.sites.length || d.sites[0].key !== '爱动漫') process.exit(1)"
test -f xiaosa/spider.jar
test -f xiaosa/js/爱动漫.js

# 失败关闭：声明的 md5 必须与实际 jar 一致，否则不要发布。
declared=$(python3 -c "import json;print(json.load(open('xiaosa/api.json'))['spider'].split(';md5;')[-1])")
actual=$(md5sum xiaosa/spider.jar | cut -d' ' -f1)
if [ "$declared" != "$actual" ]; then
  echo "md5 mismatch: declared=$declared actual=$actual" >&2
  exit 1
fi

git add -A
if git diff --cached --quiet; then
  echo "xiaosa 订阅已是最新"
  exit 0
fi

git commit -m "sync: update xiaosa api only (spider.jar patched)"
git push origin "HEAD:$branch"
