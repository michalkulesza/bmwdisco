"""Offline F32 candidate command demonstration. Does not open sockets.

Uses the original FEM_20 mapping and job template. This is packet generation,
not a claim of live vehicle compatibility. See REPORT.md before implementation.
"""
import argparse
import json
import struct
from pathlib import Path

RESOURCES = Path(__file__).parent/'decrypted'
COMMANDS = ('INDICATOR_FRONT_LEFT', 'INDICATOR_FRONT_RIGHT')


def load(name):
    return json.loads((RESOURCES/(name+'.json')).read_text(encoding='utf8'))


def indicator_request(command, state):
    if command not in COMMANDS or state not in (0, 1):
        raise ValueError('Only the two front indicator commands and states 0/1 are supported')
    mapping = next(row for row in load('FEM_20') if row['command'] == command)
    bundle = load('FEM_20.uds')
    args = [int(arg, 16) if arg.startswith('0x') else state for arg in mapping['args']]
    template = bytes.fromhex(bundle['jobs'][mapping['function']])
    # CONTRACT.md Form B: replace up to len(args) trailing placeholder zeros.
    trim = 0
    while trim < len(args) and trim < len(template) and template[-1-trim] == 0:
        trim += 1
    payload = template[:len(template)-trim] + bytes(args)
    return int(bundle['addr'], 16), payload


def internal_frame(destination, payload):
    if not 0 < len(payload) <= 63:
        raise ValueError('This example supports only short internal frames')
    data = bytes([0x80 | len(payload), destination, 0xF1]) + payload
    return data + bytes([sum(data) & 0xff])


def hsfz_frame(destination, payload):
    # HSFZ length includes source and destination, excludes its six-byte header.
    # App helper 0x3d398 changes its internal source F1 to ENET tester F4.
    return struct.pack('>IHBB', len(payload)+2, 1, 0xF4, destination) + payload


def example_sequence(command):
    destination, on = indicator_request(command, 1)
    _, off = indicator_request(command, 0)
    mappings = load('FEM_20')
    release = next(row for row in mappings if row['command'] == 'RETURN_CONTROL')
    release_payload = b'\x2f' + bytes(int(arg, 16) for arg in release['args'])
    return destination, [
        ('Read module identity; verify FEM_20 before any actuation', bytes.fromhex('22 F1 50')),
        ('Enter extended diagnostic session', bytes.fromhex('10 03')),
        (command+' ON', on),
        (command+' OFF', off),
        ('Return light control to ECU', release_payload),
        ('Restore default diagnostic session', bytes.fromhex('10 01')),
    ]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--side', choices=['left', 'right'], default='left')
    parser.add_argument('--json', action='store_true')
    args = parser.parse_args()
    command = 'INDICATOR_FRONT_'+args.side.upper()
    destination, sequence = example_sequence(command)
    result = {
        'status': 'offline candidate; not tested on a vehicle',
        'model_scope': 'BMW F32, pending detected FEM_20 confirmation',
        'sgbd': 'FEM_20',
        'destination': f'0x{destination:02X}',
        'steps': [{
            'label': label,
            'uds': payload.hex(' ').upper(),
            'internal_with_checksum': internal_frame(destination, payload).hex(' ').upper(),
            'enet_hsfz': hsfz_frame(destination, payload).hex(' ').upper(),
        } for label, payload in sequence],
    }
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(result['status'])
        print(f'{command} -> FEM_20, destination {result["destination"]}')
        for step in result['steps']:
            print('\n'+step['label'])
            print('  UDS:      '+step['uds'])
            print('  Internal: '+step['internal_with_checksum'])
            print('  ENET:     '+step['enet_hsfz'])
        print('\nA future live client must wait for matching ECU responses at every step.')
        print('The original flash pack also activates KOMBI feedback; necessity is unverified.')


if __name__ == '__main__':
    main()
