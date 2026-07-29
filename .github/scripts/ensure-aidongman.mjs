import fs from "node:fs";

const variant = process.argv[2];
const branch = process.argv[3];
const apiPath = "xiaosa/api.json";

if (!['master', 'search'].includes(variant) || !branch) {
  throw new Error('Usage: node ensure-aidongman.mjs <master|search> <branch>');
}

const searchBase = `https://ghfast.top/https://raw.githubusercontent.com/736368217/tvbox/${branch}/xiaosa`;
const assetVersion = '3';
const site = variant === 'search'
  ? {
      key: '爱动漫',
      name: '爱动漫 • 动漫',
      type: 3,
      api: `${searchBase}/js/aidongman-drpy2.min.js?v=${assetVersion}`,
      searchable: 1,
      quickSearch: 1,
      filterable: 1,
      ext: `${searchBase}/js/%E7%88%B1%E5%8A%A8%E6%BC%AB.js?v=${assetVersion}`,
    }
  : {
      key: '爱动漫',
      name: '爱动漫｜动漫',
      type: 3,
      api: './js/aidongman-drpy2.min.js',
      ext: './js/爱动漫.js',
    };

const source = fs.readFileSync(apiPath, 'utf8');
const data = JSON.parse(source);
const sitesStart = source.indexOf('"sites"');
const arrayStart = source.indexOf('[', sitesStart);
if (sitesStart < 0 || arrayStart < 0) throw new Error('找不到 sites 数组');

function matchingBrace(text, start, open, close) {
  let depth = 0;
  let quote = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') quote = false;
      continue;
    }
    if (ch === '"') quote = true;
    else if (ch === open) depth += 1;
    else if (ch === close && --depth === 0) return i;
  }
  throw new Error(`未闭合的 ${open}${close}`);
}

const arrayEnd = matchingBrace(source, arrayStart, '[', ']');
const objects = [];
for (let i = arrayStart + 1; i < arrayEnd;) {
  if (source[i] !== '{') {
    i += 1;
    continue;
  }
  const end = matchingBrace(source, i, '{', '}') + 1;
  const raw = source.slice(i, end);
  try {
    objects.push({ start: i, end, value: JSON.parse(raw) });
  } catch {
    throw new Error(`sites 中存在无法解析的对象，位置 ${i}`);
  }
  i = end;
}

const existing = objects.filter((item) => item.value.key === '爱动漫');
const desired = site;
if (existing.length === 1 && JSON.stringify(existing[0].value) === JSON.stringify(desired)) {
  if (data.sites.filter((item) => item.key === '爱动漫').length !== 1) {
    throw new Error('爱动漫入口数量不正确');
  }
  process.exit(0);
}

let next = source;
if (existing.length > 1) throw new Error('爱动漫入口数量不正确');
if (existing.length === 1) {
  const item = existing[0];
  const lineStart = source.lastIndexOf('\n', item.start) + 1;
  const indent = source.slice(lineStart, item.start).match(/^\s*/)[0];
  const replacement = JSON.stringify(desired, null, 2).split('\n').map((line, i) => i ? indent + line : line).join('\n');
  next = source.slice(0, item.start) + replacement + source.slice(item.end);
} else {
  const anchor = objects.find((item) => item.value.key === 'Anime1') || objects.at(-1);
  const lineStart = source.lastIndexOf('\n', anchor.start) + 1;
  const indent = source.slice(lineStart, anchor.start).match(/^\s*/)[0];
  const insertion = `${JSON.stringify(desired, null, 2).split('\n').map((line, i) => i ? indent + line : line).join('\n')},\n`;
  next = source.slice(0, anchor.start) + insertion + source.slice(anchor.start);
}

const check = JSON.parse(next);
if (check.sites.filter((item) => item.key === '爱动漫').length !== 1) {
  throw new Error('爱动漫入口数量不正确');
}
fs.writeFileSync(apiPath, next);
