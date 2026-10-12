"""Check recovered assets and candidate packet bytes against explicit vectors."""
import hashlib
import base64
import json
import unittest

from inspect_macho import APP, MachO
from f32_packets import indicator_request, hsfz_frame, internal_frame, load, example_sequence


class Findings(unittest.TestCase):
    def test_original_manifest_hashes(self):
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM

        root = APP/'Frameworks/EdiabasKit.framework'
        cipher = AESGCM(b'D8645993BA8BE1550000000764876174')
        files = [file for section in load('manifest')['sections'].values() for file in section['files']]
        matched = 0
        for entry in files:
            path = root/entry['path'].split('/')[-1]
            if path.is_file():
                with self.subTest(file=path.name):
                    data = path.read_bytes()
                    self.assertEqual(len(data), entry['size'])
                    raw = base64.b64decode(data, validate=True)
                    plain = cipher.decrypt(raw[:12], raw[28:]+raw[12:28], None)
                    # The manifest hashes the original plaintext JSON, while size
                    # describes the base64 container. Re-encryption changes hashes.
                    self.assertEqual(hashlib.sha256(plain).hexdigest(), entry['sha256'])
                    self.assertEqual(json.loads(plain), load(path.stem))
                    matched += 1
        self.assertEqual(matched, 115)  # Manifest itself is not self-referenced.

    def test_executable_is_not_fairplay_encrypted(self):
        self.assertEqual(MachO(APP/'Frameworks/EdiabasKit.framework/EdiabasKit').cryptid, 0)
        self.assertEqual(MachO(APP/'BimmerLight').cryptid, 0)

    def test_two_indicator_vectors(self):
        for command, channel in [('INDICATOR_FRONT_LEFT', '0D'), ('INDICATOR_FRONT_RIGHT', '0E')]:
            for state in (0, 1):
                with self.subTest(command=command, state=state):
                    destination, payload = indicator_request(command, state)
                    self.assertEqual(destination, 0x40)
                    self.assertEqual(payload, bytes.fromhex(f'2F 45 01 03 {channel} {state:02X}'))

    def test_internal_checksum_vector(self):
        self.assertEqual(internal_frame(0x40, bytes.fromhex('2F 45 01 03 0D 01')),
                         bytes.fromhex('86 40 F1 2F 45 01 03 0D 01 3D'))

    def test_hsfz_length_address_and_payload_vector(self):
        self.assertEqual(hsfz_frame(0x40, bytes.fromhex('2F 45 01 03 0D 01')),
                         bytes.fromhex('00 00 00 08 00 01 F4 40 2F 45 01 03 0D 01'))

    def test_release_is_separate_from_off(self):
        _, steps = example_sequence('INDICATOR_FRONT_LEFT')
        self.assertEqual(steps[-2][1], bytes.fromhex('2F 45 01 00 FE'))
        self.assertEqual(steps[-1][1], bytes.fromhex('10 01'))

    def test_no_unsupported_command_or_state(self):
        for command, state in [('ALL', 1), ('INDICATOR_FRONT_LEFT', 2)]:
            with self.assertRaises(ValueError):
                indicator_request(command, state)


if __name__ == '__main__':
    unittest.main(verbosity=2)
