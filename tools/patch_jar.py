#!/usr/bin/env python3
"""xiaosa spider.jar -> "unlimited" (identity gate removed) patcher.

Deterministic, stdlib-only DEX byte patcher.

  required  Init.a(Context)Z -> return true
  required  Init.b(Context)Z -> return true
  required  Init.c(Context)Z -> return false
  required  Init$3.run()V    -> drop Process.killProcess
            (also stops the upstream TVBoxOS white shell from classifying the
             jar as a "protected jar": that heuristic requires a killProcess
             call inside a Lcom/github/catvod/spider/Init* class)
  optional  Market.restartApp(Context)V / merge.m.HH$1.run()V -> drop killProcess

Method bodies are overwritten in place (stub + nop padding) so no DEX offset
moves; only the header checksum (Adler-32) and SHA-1 signature are recomputed.
Output JAR keeps only classes.dex; the original META-INF signature records are
invalid after patching and are dropped.

Usage:  python patch_jar.py IN.jar OUT.jar [--report]
Exit:   0 ok, 2 fingerprint/parse failure (fail closed -> do not publish)
"""
import hashlib
import os
import struct
import sys
import zipfile
import zlib

DEX_MAGIC = b"dex\n"

# ---- required patches: (class, method, return type, params, mode) ----------
REQUIRED = [
    ("Lcom/github/catvod/spider/Init;", "a", "Z", ["Landroid/content/Context;"], True),
    ("Lcom/github/catvod/spider/Init;", "b", "Z", ["Landroid/content/Context;"], True),
    ("Lcom/github/catvod/spider/Init;", "c", "Z", ["Landroid/content/Context;"], False),
]
KILL_CLASS, KILL_NAME, KILL_RET, KILL_PARAMS = "Landroid/os/Process;", "killProcess", "V", ["I"]
REQUIRED_KILLS = [("Lcom/github/catvod/spider/Init$3;", "run", "V", [])]
OPTIONAL_KILLS = [
    ("Lcom/github/catvod/spider/Market;", "restartApp", "V", ["Landroid/content/Context;"]),
    ("Lcom/github/catvod/spider/merge/m/HH$1;", "run", "V", []),
    ("Lcom/github/catvod/spider/merge/m.1/HH$1;", "run", "V", []),
]

# ---- instruction widths (code units) --------------------------------------
WIDTH = {}
for op in range(0x00, 0x100):
    WIDTH[op] = 1
for op in (0x02, 0x04, 0x06, 0x11, 0x13, 0x14, 0x17, 0x18, 0x1A, 0x1D, 0x1E,
           0x20, 0x21, 0x27, 0x2B, 0x2C, 0x2D, 0x2E, 0x2F):
    WIDTH[op] = 2
for op in range(0x30, 0x3E):
    WIDTH[op] = 2
for op in range(0x44, 0x6E):
    WIDTH[op] = 2
for op in range(0x90, 0xB0):
    WIDTH[op] = 2
for op in range(0xD0, 0xE3):
    WIDTH[op] = 2
for op in (0x03, 0x05, 0x07, 0x12, 0x15, 0x19, 0x22, 0x23, 0x24, 0x28,
           0x29, 0x2A, 0x6E, 0x6F, 0x70, 0x71, 0x72,
           0x74, 0x75, 0x76, 0x77, 0x78, 0xFC, 0xFD):
    WIDTH[op] = 3
WIDTH[0x16] = 5
WIDTH[0xFA] = 4
WIDTH[0xFB] = 4
WIDTH[0xFE] = 2
WIDTH[0xFF] = 2


class DexError(Exception):
    pass


class Dex:
    def __init__(self, data):
        if len(data) < 112 or data[:4] != DEX_MAGIC:
            raise DexError("not a dex file")
        self.d = bytearray(data)
        u = lambda o: struct.unpack_from("<I", self.d, o)[0]
        self.file_size = u(32)
        self.string_ids_size, self.string_ids_off = u(56), u(60)
        self.type_ids_size, self.type_ids_off = u(64), u(68)
        self.proto_ids_size, self.proto_ids_off = u(72), u(76)
        self.method_ids_size, self.method_ids_off = u(88), u(92)
        self.class_defs_size, self.class_defs_off = u(96), u(100)

    # ---------- readers ----------
    def _uleb(self, off):
        result, shift = 0, 0
        while True:
            b = self.d[off]
            off += 1
            result |= (b & 0x7F) << shift
            if not b & 0x80:
                break
            shift += 7
        return result, off

    def string(self, idx):
        if idx >= self.string_ids_size:
            return ""
        off = struct.unpack_from("<I", self.d, self.string_ids_off + idx * 4)[0]
        n, p = self._uleb(off)
        return bytes(self.d[p:p + n]).rstrip(b"\x00").decode("utf-8", "replace")

    def type_desc(self, idx):
        if idx >= self.type_ids_size:
            return ""
        s_idx = struct.unpack_from("<I", self.d, self.type_ids_off + idx * 4)[0]
        return self.string(s_idx)

    def proto(self, idx):
        off = self.proto_ids_off + idx * 12
        ret_idx, params_off = struct.unpack_from("<II", self.d, off + 4)
        params = []
        if params_off:
            size = struct.unpack_from("<I", self.d, params_off)[0]
            for i in range(size):
                t = struct.unpack_from("<H", self.d, params_off + 4 + i * 2)[0]
                params.append(self.type_desc(t))
        return self.type_desc(ret_idx), params

    def method(self, idx):
        off = self.method_ids_off + idx * 8
        class_idx, proto_idx, name_idx = struct.unpack_from("<HHI", self.d, off)
        ret, params = self.proto(proto_idx)
        return self.type_desc(class_idx), self.string(name_idx), ret, params

    def class_defs(self):
        for i in range(self.class_defs_size):
            off = self.class_defs_off + i * 32
            class_idx = struct.unpack_from("<I", self.d, off)[0]
            class_data_off = struct.unpack_from("<I", self.d, off + 24)[0]
            yield self.type_desc(class_idx), class_data_off

    def methods_of(self, class_data_off):
        out = []
        if not class_data_off:
            return out
        static_fields, p = self._uleb(class_data_off)
        instance_fields, p = self._uleb(p)
        direct, p = self._uleb(p)
        virtual, p = self._uleb(p)
        for _ in range(static_fields + instance_fields):
            _, p = self._uleb(p)   # field_idx_diff
            _, p = self._uleb(p)   # access_flags
        for count in (direct, virtual):
            # method_idx_diff is a difference from the previous element *of the
            # same list*, so the index resets for the virtual list.
            method_idx = 0
            for _ in range(count):
                diff, p = self._uleb(p)
                method_idx += diff
                _, p = self._uleb(p)
                code_off, p = self._uleb(p)
                out.append((method_idx, code_off))
        return out

    def find_method_ids(self, class_desc, name, ret, params):
        hits = set()
        for idx in range(self.method_ids_size):
            c, n, r, p = self.method(idx)
            if c == class_desc and n == name and r == ret and p == params:
                hits.add(idx)
        return hits

    def code_item(self, code_off):
        registers_size, ins_size, outs_size, tries_size = struct.unpack_from("<HHHH", self.d, code_off)
        insns_size = struct.unpack_from("<I", self.d, code_off + 12)[0]
        return registers_size, insns_size, code_off + 16

    def iter_units(self, code_off):
        """Yield (index, opcode, width) walking the instruction stream safely."""
        _, insns_size, insns_off = self.code_item(code_off)
        i = 0
        while i < insns_size:
            unit = struct.unpack_from("<H", self.d, insns_off + i * 2)[0]
            op = unit & 0xFF
            hi = unit >> 8
            if op == 0x00 and hi in (0x01, 0x02):          # packed-/sparse-switch payload
                size = struct.unpack_from("<H", self.d, insns_off + (i + 1) * 2)[0]
                width = 4 + size * 2 if hi == 0x01 else 2 + size * 4
            elif op == 0x00 and hi == 0x03:                # fill-array-data payload
                size = struct.unpack_from("<I", self.d, insns_off + (i + 1) * 2)[0]
                width = 4 + size
            else:
                width = WIDTH.get(op, 1)
            yield i, op, width
            i += width

    # ---------- patchers ----------
    def stub(self, code_off, truthy):
        registers_size, insns_size, insns_off = self.code_item(code_off)
        if registers_size < 1:
            raise DexError("no registers available to stub this method")
        if insns_size < 2:
            raise DexError("method too small to stub (%d insns)" % insns_size)
        body = bytearray(insns_size * 2)                   # nop padding
        cst = 0x0012 | ((1 if truthy else 0) << 12)        # const/4 v0, #imm
        struct.pack_into("<H", body, 0, cst)
        struct.pack_into("<H", body, 2, 0x000F)            # return v0
        self.d[insns_off:insns_off + insns_size * 2] = body
        return insns_size

    def nop_kill_invoke(self, code_off, kill_ids):
        _, insns_size, insns_off = self.code_item(code_off)
        patched = 0
        for idx, op, width in list(self.iter_units(code_off)):
            if op != 0x71:                                  # invoke-static (35c)
                continue
            method_idx = struct.unpack_from("<H", self.d, insns_off + (idx + 1) * 2)[0]
            if method_idx in kill_ids:
                for k in range(3):
                    struct.pack_into("<H", self.d, insns_off + (idx + k) * 2, 0x0000)
                patched += 1
        return patched

    def finish(self):
        self.d[12:32] = hashlib.sha1(bytes(self.d[32:])).digest()
        struct.pack_into("<I", self.d, 8, zlib.adler32(bytes(self.d[12:])) & 0xFFFFFFFF)
        return bytes(self.d)


def read_dex_from_jar(path):
    with zipfile.ZipFile(path) as z:
        names = sorted(n for n in z.namelist() if n.endswith(".dex"))
        if not names:
            raise DexError("no .dex entry in %s" % path)
        return names[0], z.read(names[0])


def write_jar(path, dex_name, dex_bytes):
    info = zipfile.ZipInfo(dex_name, date_time=(1980, 1, 1, 0, 0, 0))
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o644 << 16
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(info, dex_bytes)


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 1
    src, dst = sys.argv[1], sys.argv[2]
    verbose = "--report" in sys.argv

    dex_name, raw = read_dex_from_jar(src)
    dex = Dex(raw)
    log = []

    for class_desc, name, ret, params, truthy in REQUIRED:
        target = None
        for cd, cdo in dex.class_defs():
            if cd != class_desc:
                continue
            for m_idx, code_off in dex.methods_of(cdo):
                _, n, r, p = dex.method(m_idx)
                if n == name and r == ret and p == params and code_off:
                    target = code_off
        if target is None:
            raise DexError("fingerprint missing: %s->%s%s%s" % (class_desc, name, ret, params))
        size = dex.stub(target, truthy)
        log.append("stub  %s->%s  %d insns -> return %s" % (class_desc, name, size, truthy))

    kill_ids = dex.find_method_ids(KILL_CLASS, KILL_NAME, KILL_RET, KILL_PARAMS)
    if not kill_ids:
        raise DexError("fingerprint missing: %s->%s%s" % (KILL_CLASS, KILL_NAME, KILL_PARAMS))

    for class_desc, name, ret, params in REQUIRED_KILLS:
        hits = 0
        for cd, cdo in dex.class_defs():
            if cd != class_desc:
                continue
            for m_idx, code_off in dex.methods_of(cdo):
                _, n, r, p = dex.method(m_idx)
                if n == name and r == ret and p == params and code_off:
                    hits += dex.nop_kill_invoke(code_off, kill_ids)
        if not hits:
            raise DexError("fingerprint missing: killProcess in %s->%s" % (class_desc, name))
        log.append("nop   %s->%s  %d killProcess invoke(s)" % (class_desc, name, hits))

    for class_desc, name, ret, params in OPTIONAL_KILLS:
        hits = 0
        for cd, cdo in dex.class_defs():
            if cd != class_desc:
                continue
            for m_idx, code_off in dex.methods_of(cdo):
                _, n, r, p = dex.method(m_idx)
                if n == name and r == ret and p == params and code_off:
                    hits += dex.nop_kill_invoke(code_off, kill_ids)
        if hits:
            log.append("nop   %s->%s  %d killProcess invoke(s)" % (class_desc, name, hits))

    patched = dex.finish()
    if len(patched) != dex.file_size:
        raise DexError("patched size %d != header file_size %d" % (len(patched), dex.file_size))
    write_jar(dst, dex_name, patched)

    blob = open(dst, "rb").read()
    log.append("out   %s  %d bytes" % (dst, len(blob)))
    log.append("md5   %s" % hashlib.md5(blob).hexdigest())
    log.append("sha256 %s" % hashlib.sha256(blob).hexdigest())
    if verbose:
        print("\n".join(log))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except DexError as e:
        print("PATCH FAILED (fail closed): %s" % e, file=sys.stderr)
        sys.exit(2)
