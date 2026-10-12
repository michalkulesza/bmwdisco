"""Small, dependency-free Mach-O evidence extractor for the supplied iOS bundle."""
from pathlib import Path
import bisect
import struct

APP = Path(__file__).resolve().parents[1] / 'com.bimmerlight.prod-3.8-eeveedecrypter/Payload/BimmerLight.app'


def uleb(data, offset):
    value = shift = 0
    while True:
        byte = data[offset]
        offset += 1
        value |= (byte & 127) << shift
        if byte < 128:
            return value, offset
        shift += 7


class MachO:
    def __init__(self, path):
        self.path = Path(path)
        self.data = b = self.path.read_bytes()
        self.sections = []
        self.exports = {}
        self.starts = []
        self.symbols = []
        self.cryptid = None
        pos = 32
        for _ in range(struct.unpack_from('<I', b, 16)[0]):
            cmd, size = struct.unpack_from('<II', b, pos)
            if cmd == 0x19:
                for i in range(struct.unpack_from('<I', b, pos + 64)[0]):
                    sec = pos + 72 + i * 80
                    name = b[sec:sec+16].split(b'\0')[0].decode()
                    addr, length, offset = struct.unpack_from('<QQI', b, sec+32)
                    self.sections.append((name, addr, length, offset))
            elif cmd == 0x80000033:
                off, length = struct.unpack_from('<II', b, pos+8)
                trie = b[off:off+length]

                def visit(node, prefix):
                    terminal, p = uleb(trie, node)
                    child_start = p + terminal
                    if terminal:
                        flags, p = uleb(trie, p)
                        if not flags & 8:
                            addr, p = uleb(trie, p)
                            self.exports[prefix] = addr
                    p = child_start
                    children = trie[p]
                    p += 1
                    for _ in range(children):
                        end = trie.index(0, p)
                        edge = trie[p:end].decode()
                        child, p = uleb(trie, end+1)
                        visit(child, prefix+edge)

                visit(0, '')
            elif cmd == 0x26:
                off, length = struct.unpack_from('<II', b, pos+8)
                pos2 = off
                addr = 0
                while pos2 < off+length:
                    delta, pos2 = uleb(b, pos2)
                    if not delta:
                        break
                    addr += delta
                    self.starts.append(addr)
            elif cmd in (0x21, 0x2c):
                self.cryptid = struct.unpack_from('<I', b, pos+16)[0]
            elif cmd == 2:
                symoff, count, stroff, _ = struct.unpack_from('<4I', b, pos+8)
                for i in range(count):
                    ix, typ, sect, desc, addr = struct.unpack_from('<IBBHQ', b, symoff+16*i)
                    end = b.find(b'\0', stroff+ix)
                    self.symbols.append((b[stroff+ix:end].decode('utf8','replace'), addr, typ))
            pos += size

    def offset(self, addr):
        for name, va, size, offset in self.sections:
            if va <= addr < va+size and offset:
                return offset+addr-va
        return addr

    def function(self, addr):
        i = bisect.bisect_right(self.starts, addr)-1
        return self.starts[i] if i >= 0 else 0

    def cstring(self, addr):
        offset = self.offset(addr)
        end = self.data.find(b'\0', offset, offset+300)
        if end < 0:
            return ''
        raw = self.data[offset:end]
        return raw.decode('ascii') if raw and all(32 <= c < 127 for c in raw) else ''

    def references(self):
        """Recover ADR/ADRP+ADD addresses, enough to locate string users."""
        _, start, size, offset = next(s for s in self.sections if s[0] == '__text')
        regs = {}
        for pc in range(start, start+size, 4):
            ins = struct.unpack_from('<I', self.data, offset+pc-start)[0]
            rd = ins & 31
            if ins & 0x9f000000 in (0x90000000, 0x10000000):
                imm = ((ins >> 5 & 0x7ffff) << 2) | (ins >> 29 & 3)
                if imm & 0x100000:
                    imm -= 0x200000
                regs[rd] = (((pc & ~4095) + (imm << 12)) if ins & 0x80000000 else pc+imm, pc)
            elif ins & 0x7f000000 == 0x11000000:
                rn = ins >> 5 & 31
                imm = (ins >> 10 & 4095) << (12 if ins >> 22 & 1 else 0)
                if rn in regs and pc-regs[rn][1] < 60:
                    addr = regs[rn][0]+imm
                    regs[rd] = (addr, pc)
                    yield pc, addr, self.cstring(addr)


if __name__ == '__main__':
    m = MachO(APP/'Frameworks/EdiabasKit.framework/EdiabasKit')
    dest = Path(__file__).parent
    (dest/'EdiabasKit.exports.txt').write_text('\n'.join(f'{addr:#010x} {name}' for name, addr in sorted(m.exports.items(), key=lambda x:x[1])), encoding='utf8')
    (dest/'EdiabasKit.references.txt').write_text('\n'.join(f'{pc:#010x} fn={m.function(pc):#010x} -> {addr:#010x} {value}' for pc,addr,value in m.references()),encoding='utf8')
    print(f'cryptid={m.cryptid}; exports={len(m.exports)}; function starts={len(m.starts)}')
