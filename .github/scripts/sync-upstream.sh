#!/usr/bin/env bash
set -euo pipefail

branch="$1"
variant="$2"
upstream_ref="upstream/master"
overlay_dir="$(mktemp -d)"
trap 'rm -rf "$overlay_dir"' EXIT

overlay_files=(
  .github/scripts/ensure-aidongman.mjs
  .github/scripts/sync-upstream.sh
  .github/workflows/sync-upstream.yml
  .github/workflows/run.yml
  xiaosa/js/aidongman-drpy-core-lite.min.js
  xiaosa/js/aidongman-drpy2.min.js
  xiaosa/js/爱动漫.js
)

if [[ "$variant" == "search" ]]; then
  overlay_files+=(xiaosa/README.md xiaosa/json/aidongman-ocr.json)
fi

for file in "${overlay_files[@]}"; do
  if [[ -f "$file" ]]; then
    mkdir -p "$overlay_dir/$(dirname "$file")"
    cp "$file" "$overlay_dir/$file"
  fi
done

if git merge-base --is-ancestor "$upstream_ref" HEAD; then
  echo "$branch 已包含最新上游提交"
else
  set +e
  git merge --no-ff --no-commit "$upstream_ref"
  merge_status=$?
  set -e

  if (( merge_status != 0 )); then
    conflicts="$(git diff --name-only --diff-filter=U)"
    while IFS= read -r file; do
      [[ -z "$file" ]] && continue
      if [[ "$file" == "xiaosa/api.json" ]]; then
        git checkout --theirs -- "$file"
        git add "$file"
      elif printf '%s\n' "${overlay_files[@]}" | grep -Fxq "$file"; then
        echo "保留受保护文件：$file"
      else
        echo "检测到不能自动处理的冲突：$file" >&2
        exit 1
      fi
    done <<< "$conflicts"
  fi
fi

for file in "${overlay_files[@]}"; do
  if [[ -f "$overlay_dir/$file" ]]; then
    mkdir -p "$(dirname "$file")"
    cp "$overlay_dir/$file" "$file"
  fi
done

node .github/scripts/ensure-aidongman.mjs "$variant" "$branch"
node --check xiaosa/js/爱动漫.js
node --input-type=module --check < xiaosa/js/aidongman-drpy2.min.js
node -e "const d=require('./xiaosa/api.json'); if(d.sites.filter(x=>x.key==='爱动漫').length!==1) process.exit(1)"
grep -q 'aidongman-drpy-core-lite.min.js' xiaosa/js/aidongman-drpy2.min.js

git add --all
if git diff --cached --quiet; then
  echo "$branch 无需更新"
  exit 0
fi

git commit -m "sync: update from qist/tvbox master"
git push origin "HEAD:$branch"
