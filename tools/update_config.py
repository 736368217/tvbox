#!/usr/bin/env python3
"""Rewrite only the md5 inside the api.json `spider` declaration.

Keeps the upstream file byte-for-byte except for the 32 hex digits after
`;md5;`, so the branch diff stays minimal and reviewable.

Usage:  python update_config.py UPSTREAM_api.json OUT_api.json PATCHED_spider.jar
Exit:   0 ok, 2 if the declaration cannot be found (fail closed).
"""
import hashlib
import re
import sys

MD5_RE = re.compile(rb'("spider"\s*:\s*"[^"]*?;md5;)([0-9a-fA-F]{32})(")')


def main():
    if len(sys.argv) != 4:
        print(__doc__)
        return 1
    src, dst, jar = sys.argv[1], sys.argv[2], sys.argv[3]
    raw = open(src, "rb").read()
    new_md5 = hashlib.md5(open(jar, "rb").read()).hexdigest().encode()

    m = MD5_RE.search(raw)
    if not m:
        print("FAIL: no `\"spider\": \"...;md5;<32hex>\"` declaration in %s" % src, file=sys.stderr)
        return 2
    old_md5 = m.group(2)
    out = raw[:m.start(2)] + new_md5 + raw[m.end(2):]
    open(dst, "wb").write(out)
    print("spider md5: %s -> %s" % (old_md5.decode(), new_md5.decode()))
    if old_md5.lower() == new_md5.lower():
        print("(unchanged)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
