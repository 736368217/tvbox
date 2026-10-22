import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const xiaosaDir = path.join(root, "xiaosa");
const apiPath = path.join(xiaosaDir, "api.json");
const data = JSON.parse(fs.readFileSync(apiPath, "utf8"));

const keep = new Set(["api.json", "README.md", "spider.jar"]);

function addReference(value) {
  if (typeof value !== "string") return;
  const match = value.match(/^\.\/([^;?#]+)/);
  if (!match) return;
  const rel = match[1].replace(/\\/g, "/").replace(/\/+$/, "");
  if (rel) keep.add(rel);
}

function walk(value) {
  if (typeof value === "string") {
    addReference(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(walk);
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach(walk);
  }
}

walk(data);

for (const rel of keep) {
  const file = path.join(xiaosaDir, rel);
  if (!fs.existsSync(file)) {
    throw new Error(`api.json 引用的文件不存在: xiaosa/${rel}`);
  }
}

function pruneDirectory(dir, prefix = "") {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      pruneDirectory(full, rel);
      if (fs.readdirSync(full).length === 0) fs.rmdirSync(full);
    } else if (!keep.has(rel)) {
      fs.rmSync(full);
      console.log(`删除 xiaosa/${rel}`);
    }
  }
}

pruneDirectory(xiaosaDir);

const keepTop = new Set([".git", ".github", ".gitignore", "README.md", "xiaosa"]);
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (keepTop.has(entry.name)) continue;
  fs.rmSync(path.join(root, entry.name), { recursive: true, force: true });
  console.log(`删除 ${entry.name}`);
}

console.log("保留的 xiaosa 文件:");
for (const rel of [...keep].sort()) {
  console.log(`  xiaosa/${rel}`);
}
