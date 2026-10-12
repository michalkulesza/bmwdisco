"""Recover selected BLE initializer literals and AT command reference evidence offline."""
from pathlib import Path
import re, struct
from inspect_macho import APP, MachO

ROOT = Path(__file__).parent
IMAGE = MachO(APP / 'Frameworks/EdiabasKit.framework/EdiabasKit')
INIT_FUNCTIONS = [
    ('BimmerCommander', 0x18570), ('Konnwei', 0x182bc), ('OBDLink', 0x17b08),
    ('Vlinker', 0x17e94), ('UniCarScan', 0x1847c), ('Veepeak', 0x188b8),
    ('Vgate iCar', 0x18a74),
]

def ascii_prefix(raw):
    return bytes(b for b in raw[:next((i for i, x in enumerate(raw) if x == 0), len(raw))] if 32 <= b < 127).decode('ascii')

def mov_sequences(start, end):
    regs, all_values = {}, []
    for pc in range(start, end, 4):
        word = struct.unpack_from('<I', IMAGE.data, IMAGE.offset(pc))[0]
        if word & 0x1f800000 != 0x12800000:
            continue
        op = (word >> 29) & 3
        if op not in (2, 3):
            continue
        rd, bits = word & 31, (64 if word >> 31 else 32)
        shift, imm = ((word >> 21) & 3) * 16, (word >> 5) & 0xffff
        if op == 2:
            if rd in regs:
                all_values.append(regs.pop(rd))
            regs[rd] = [pc, bits, imm << shift]
        elif rd in regs and regs[rd][1] == bits:
            regs[rd][2] = (regs[rd][2] & ~(0xffff << shift)) | (imm << shift)
    all_values.extend(regs.values())
    result = []
    for pc, bits, value in sorted(all_values):
        raw = value.to_bytes(bits // 8, 'little')
        text = ascii_prefix(raw)
        if len(text) >= 3:
            result.append((pc, bits, raw.hex(), text))
    return result

out = ['# Extracted adapter constants (offline static evidence)',
       '# Addresses are Mach-O VAs. ASCII is decoded from MOVZ/MOVK immediates in selected once initializers.',
       '# Reproduce with: python analysis/adapter-constants.py']
for name, start in INIT_FUNCTIONS:
    i = IMAGE.starts.index(start)
    end = IMAGE.starts[i + 1]
    vals = mov_sequences(start, end)
    out.append(f'\n## {name}: function {start:#x}..{end:#x}')
    out.append('ASCII immediates: ' + ('; '.join(f'{pc:#x} {bits}-bit bytes={raw} text={text}' for pc, bits, raw, text in vals) if vals else 'none recovered'))
    out.append('These are literal byte sequences; config field/UUID roles are not assigned.')

strings = (ROOT / 'EdiabasKit.strings.txt').read_text(encoding='utf8').splitlines()
refs = (ROOT / 'EdiabasKit.references.txt').read_text(encoding='utf8').splitlines()
commands = []
for number, line in enumerate(strings, 1):
    match = re.match(r'(0x[0-9a-fA-F]+)\s+(AT[A-Z0-9]+)$', line)
    if match:
        commands.append(f'analysis/EdiabasKit.strings.txt:{number} {match.group(1)} {match.group(2)} (embedded string)')
out += ['\n## Embedded AT-style command literals',
        'These are literal adapter-command-like strings. Their presence alone does not show which adapters receive them.']
out.extend(commands)
out.append('Code-reference evidence:')
for line_no, line in enumerate(refs, 1):
    if re.search(r'\bAT(?:PC|Z)\b', line):
        out.append(f'analysis/EdiabasKit.references.txt:{line_no} {line.strip()}')

out += ['\n## Observed full UUID literals',
        'analysis/EdiabasKit.strings.txt:746 0x001122d0 E7810A71-73AE-499D-8C15-FAA9AEF0C3F2; reference at analysis/EdiabasKit.references.txt:1115 from function 0x1e65c.',
        'analysis/EdiabasKit.strings.txt:666 0x00111780 BEF8D6C9-9C21-4C9E-B632-BD58C1009F9F; reference at analysis/EdiabasKit.references.txt:1116 from function 0x1e65c.',
        'Both literals are referenced by the same function; this pass does not assign service/write/notify roles.']
(ROOT / 'adapter-constants.txt').write_text('\n'.join(out) + '\n', encoding='utf8')
print(ROOT / 'adapter-constants.txt')

