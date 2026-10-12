"""Focused, execution-free ARM64 instruction evidence (a small explicit subset).

Not a decompiler. Unknown words remain .word. Addresses are Mach-O virtual
addresses. This helper never connects to an adapter or executes target code.
"""
import struct
from pathlib import Path
from inspect_macho import APP, MachO


def signed(n, bits):
    return n - (1 << bits) if n & (1 << (bits - 1)) else n


def decode(word, pc, image):
    rd, rn = word & 31, (word >> 5) & 31
    if word == 0xd65f03c0:
        return 'ret'
    if word & 0x7c000000 == 0x14000000:
        target = pc + signed(word & 0x3ffffff, 26) * 4
        names = [n for n, a in image.exports.items() if a == target]
        return f'{"bl" if word & 0x80000000 else "b"} {target:#x} ' + ' '.join(names[:1])
    if word & 0x1f800000 == 0x12800000:
        op = {0: 'movn', 2: 'movz', 3: 'movk'}.get((word >> 29) & 3, '?')
        imm, shift = (word >> 5) & 0xffff, ((word >> 21) & 3) * 16
        return f'{op} {"x" if word >> 31 else "w"}{rd}, #{imm:#x}, lsl #{shift}'
    if word & 0x9f000000 in (0x90000000, 0x10000000):
        imm = signed(((word >> 5 & 0x7ffff) << 2) | (word >> 29 & 3), 21)
        page = bool(word & 0x80000000)
        target = (pc & ~4095) + (imm << 12) if page else pc + imm
        return f'{"adrp" if page else "adr"} x{rd}, {target:#x}'
    if word & 0x1f000000 == 0x11000000:
        imm = (word >> 10 & 4095) << (12 if word >> 22 & 1 else 0)
        op = 'sub' if word & 0x40000000 else 'add'
        return f'{op}{"s" if word & 0x20000000 else ""} {"x" if word >> 31 else "w"}{rd}, r{rn}, #{imm:#x}'
    if word & 0x3b000000 == 0x39000000 and not word & 0x04000000:
        size = word >> 30
        opc = word >> 22 & 3
        imm = (word >> 10 & 4095) << size
        op = 'ldr' if opc == 1 else 'str' if opc == 0 else 'load-special'
        suffix = 'b' if size == 0 else 'h' if size == 1 else ''
        return f'{op}{suffix} {"x" if size == 3 else "w"}{rd}, [x{rn}, #{imm:#x}]'
    if word & 0x7fe0ffe0 == 0x2a0003e0:
        return f'mov {"x" if word >> 31 else "w"}{rd}, r{word >> 16 & 31}'
    if word & 0xff000010 == 0x54000000:
        return f'b.cond{word & 15} {pc + signed(word >> 5 & 0x7ffff, 19)*4:#x}'
    if word & 0x7e000000 == 0x34000000:
        return f'cb{"n" if word & 0x1000000 else ""}z r{rd}, {pc + signed(word >> 5 & 0x7ffff,19)*4:#x}'
    return f'.word {word:#010x}'


def main():
    image = MachO(APP / 'Frameworks/EdiabasKit.framework/EdiabasKit')
    regions = [
        ('HSFZ prepareSendData', 0x3cc70, 0x3cdb0),
        ('THOR prepareSendData', 0x3f468, 0x3f788),
        ('HSFZ source frame bounds', 0x3d2b0, 0x3d398),
        ('HSFZ network frame builder', 0x3d398, image.starts[__import__('bisect').bisect_right(image.starts, 0x3d398)]),
        ('THOR checksum helper', 0x40eec, image.starts[__import__('bisect').bisect_right(image.starts, 0x40eec)]),
        ('BimmerCommander BLE constructor', 0x16b60, 0x16bf4),
        ('Konnwei BLE constructor', 0x16de4, 0x16e88),
        ('OBDLink BLE constructor', 0x16ff0, 0x17084),
        ('UniCarScan BLE constructor', 0x171b0, 0x17244),
        ('Veepeak BLE constructor', 0x17388, 0x1742c),
        ('Vgate BLE constructor', 0x17570, 0x17614),
        ('Vlinker BLE constructor', 0x17740, 0x177d4),
    ]
    out = ['# Local static instruction evidence', '# Partial decoder; .word means undecoded, not invalid code.']
    for label, start, end in regions:
        out.append(f'\n## {label}: {start:#x}..{end:#x}')
        for pc in range(start, end, 4):
            word = struct.unpack_from('<I', image.data, image.offset(pc))[0]
            out.append(f'{pc:#010x}: {word:08x}  {decode(word, pc, image)}')
    target = Path(__file__).with_name('transport-instructions.txt')
    target.write_text('\n'.join(out) + '\n', encoding='utf8')
    print(target)


if __name__ == '__main__':
    main()
