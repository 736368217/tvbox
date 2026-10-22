import fs from "node:fs";

const variant = process.argv[2];
const branch = process.argv[3];
const apiPath = "xiaosa/api.json";

if (!["master", "search"].includes(variant) || !branch) {
  throw new Error("Usage: node ensure-aidongman.mjs <master|search> <branch>");
}

const site = {
  key: "爱动漫",
  name: "爱动漫 • 动漫",
  type: 3,
  api: "./js/爱动漫.js?v=1",
  searchable: 1,
  quickSearch: 1,
  filterable: 1,
  timeout: 60,
};

const source = fs.readFileSync(apiPath, "utf8");
const data = JSON.parse(source);
const sitesStart = source.indexOf('"sites"');
const arrayStart = source.indexOf("[", sitesStart);
if (sitesStart < 0 || arrayStart < 0) {
  throw new Error("找不到 sites 数组");
}

function matchingBrace(text, start, open, close) {
  let depth = 0;
  let quote = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') quote = false;
      continue;
    }
    if (ch === '"') quote = true;
    else if (ch === open) depth += 1;
    else if (ch === close && --depth === 0) return i;
  }
  throw new Error(`未闭合的 ${open}${close}`);
}

const arrayEnd = matchingBrace(source, arrayStart, "[", "]");
const objects = [];
for (let i = arrayStart + 1; i < arrayEnd; ) {
  if (source[i] !== "{") {
    i += 1;
    continue;
  }
  const end = matchingBrace(source, i, "{", "}") + 1;
  const raw = source.slice(i, end);
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(`sites 中存在无法解析的对象，位置 ${i}`);
  }
  objects.push({ start: i, end, raw, value });
  i = end;
}

const siteValues = Array.isArray(data.sites) ? data.sites : [];
if (objects.length !== siteValues.length) {
  throw new Error("sites 数组解析数量不一致");
}

const indent = "    ";
const rawEntries = [JSON.stringify(site)];
for (const object of objects) {
  if (object.value.key !== "爱动漫") rawEntries.push(object.raw);
}
const arrayText = "[\n" + rawEntries.map((entry) => indent + entry).join(",\n") + "\n  ]";

let next = source.slice(0, arrayStart) + arrayText + source.slice(arrayEnd + 1);
const parsed = JSON.parse(next);
const expectedCount = siteValues.length + (siteValues.some((item) => item.key === "爱动漫") ? 0 : 1);
if (parsed.sites.length !== expectedCount || parsed.sites[0].key !== "爱动漫") {
  throw new Error("爱动漫入口定位失败");
}
if (next !== source) {
  fs.writeFileSync(apiPath, next);
  console.log("已把爱动漫移动到站点列表第一位");
}
