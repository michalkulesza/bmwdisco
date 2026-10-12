"""Decode this app's bundled resources; originals are never modified.

Requires cryptography. The key literal is referenced by the framework's
decryptDownloadedEncryptedData export at virtual address 0x779a8.
Container: base64(nonce[12] + tag[16] + AES-GCM ciphertext).
"""
import argparse
import base64
import json
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from inspect_macho import APP


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=Path(__file__).parent/'decrypted')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    cipher = AESGCM(b'D8645993BA8BE1550000000764876174')
    count = 0
    for file in sorted((APP/'Frameworks/EdiabasKit.framework').glob('*.bimmerlight')):
        raw = base64.b64decode(file.read_bytes(), validate=True)
        plain = cipher.decrypt(raw[:12], raw[28:]+raw[12:28], None)
        document = json.loads(plain)
        target = args.output/(file.stem+'.json')
        target.write_text(json.dumps(document, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
        print(f'{file.name}: authenticated; {len(plain)} bytes; {type(document).__name__}')
        count += 1
    print(f'Extracted {count} authenticated JSON resources to {args.output}')


if __name__ == '__main__':
    main()
