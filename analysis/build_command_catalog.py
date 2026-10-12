"""Offline resource verification and lossless command catalog; never connects to a car."""
from pathlib import Path
import base64
import collections
import csv
import hashlib
import json
import plistlib
import re

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from inspect_macho import APP

ROOT = Path(__file__).resolve().parent
RES = APP / 'Frameworks/EdiabasKit.framework'
DEC = ROOT / 'decrypted'


def main():
    cipher = AESGCM(b'D8645993BA8BE1550000000764876174')
    codes = plistlib.loads((RES / '_CodeSignature/CodeResources').read_bytes())
    verification = []
    for file in sorted(RES.glob('*.bimmerlight')):
        raw = file.read_bytes()
        container = base64.b64decode(raw, validate=True)
        plain = cipher.decrypt(container[:12], container[28:] + container[12:28], None)
        parsed = json.loads(plain)
        extracted = DEC / (file.stem + '.json')
        assert parsed == json.loads(extracted.read_text(encoding='utf8')), file.name
        stored = codes['files2'][file.name]
        checks = {k: v == getattr(hashlib, 'sha256' if k == 'hash2' else 'sha1')(raw).digest()
                  for k, v in stored.items() if k in ('hash', 'hash2')}
        assert all(checks.values()), (file.name, checks)
        verification.append({'resource': file.relative_to(APP).as_posix(),
                             'encrypted_sha256': hashlib.sha256(raw).hexdigest(),
                             'plaintext_sha256': hashlib.sha256(plain).hexdigest(),
                             'aes_gcm_authenticated': True, 'extracted_json_equal': True,
                             'code_resources_hashes_match': checks})
    contract = RES / 'CONTRACT.md'
    stored = codes['files2']['CONTRACT.md']
    contract_check = {k: v == getattr(hashlib, 'sha256' if k == 'hash2' else 'sha1')(contract.read_bytes()).digest()
                      for k, v in stored.items() if k in ('hash', 'hash2')}
    assert all(contract_check.values())
    bundles = {}
    for file in sorted(DEC.glob('*.uds.json')):
        data = json.loads(file.read_text(encoding='utf8'))
        bundles[file.name.removesuffix('.uds.json').upper()] = (file, data)
    commands = []
    addresses = []
    jobs = []
    packs = []
    for name, (file, data) in bundles.items():
        addresses.append({'sgbd': name, 'embedded_sgbd': data['sgbd'],
                          'address_hex': data.get('addr'), 'source': file.relative_to(ROOT.parent).as_posix() + ':3'})
        for job, template in data['jobs'].items():
            jobs.append({'sgbd': name, 'address_hex': data.get('addr'), 'job': job, 'template_hex': template})
    for file in sorted(DEC.glob('*.json')):
        data = json.loads(file.read_text(encoding='utf8'))
        if isinstance(data, dict) and 'actions' in data:
            packs.append({'file': file.name, 'title': data['title'], 'actions': len(data['actions']),
                          'action_titles': [a['title'] for a in data['actions']],
                          'sequence_steps': sum(len(a.get('sequence', [])) for a in data['actions']),
                          'disable_steps': sum(len(a.get('disable', [])) for a in data['actions'])})
        if not isinstance(data, list) or not data or 'command' not in data[0]:
            continue
        source_lines = [i for i, line in enumerate(file.read_text(encoding='utf8').splitlines(), 1)
                        if re.match(r'    "command":', line)]
        assert len(source_lines) == len(data)
        for i, mapping in enumerate(data):
            _, bundle = bundles.get(mapping['sgbd'].upper(), (None, {}))
            fn = mapping['function']
            args = mapping['args']
            light = bundle.get('lights', {})
            target = args[1] if len(args) > 1 and args[0] == 'ARG' else fn
            candidates = [x for x in bundle.get('fns', []) if x['n'] == target]
            compact_fns = [{k: v for k, v in x.items() if k in ('n', 's', 'id', 'a')} for x in candidates]
            if fn in ('RAW_UDS', 'COMMUNICATION_CONTROL', 'IO_RETURN_CONTROL'):
                route = 'service_intercept'
            elif fn in ('DIAGNOSE_MODE', 'DIAGNOSE_AUFRECHT', 'DIAGNOSE_ENDE'):
                route = 'session_or_fixed'
            elif fn in light.get('fixed', {}):
                route = 'fixed_light_payload'
            elif fn == light.get('function'):
                route = 'light_template'
            elif args and args[0] == 'ARG':
                route = 'arg_dispatch'
            elif fn in bundle.get('jobs', {}):
                route = 'job_template'
            elif candidates:
                route = 'direct_function'
            else:
                route = 'unresolved'
            item = dict(mapping)
            item.update({'mapping_source': file.relative_to(ROOT.parent).as_posix() + ':' + str(source_lines[i]),
                         'address_hex': bundle.get('addr'), 'route_candidate': route,
                         'bundle_source': 'analysis/decrypted/' + mapping['sgbd'] + '.uds.json' if bundle else None,
                         'job_template_hex': bundle.get('jobs', {}).get(fn),
                         'function_candidates': compact_fns,
                         'parameters': sorted(set(re.findall(r'\{([^{}]+)\}', ' '.join(args))))})
            if fn == light.get('function'):
                item['light_template_hex'] = light['template']
                item['light_channels'] = {a: light['channels'].get(a) for a in args if '{' not in a}
                item['light_state'] = light.get('state')
            if fn in light.get('fixed', {}):
                item['fixed_payload_hex'] = light['fixed'][fn]
            commands.append(item)
    stats = {'encrypted_resources_verified': len(verification), 'mapping_files': 51,
             'mapping_rows': len(commands), 'distinct_command_strings_including_empty': len(set(x['command'] for x in commands)),
             'uds_bundles': len(bundles), 'jobs': len(jobs),
             'functions': sum(len(x['fns']) for _, x in bundles.values()),
             'pack_files': len(packs), 'pack_actions': sum(p['actions'] for p in packs),
             'routes': dict(collections.Counter(x['route_candidate'] for x in commands))}
    payload = {'scope': 'Offline static resources, no traffic observed. Routes are candidates, not a verified runtime compiler.',
               'stats': stats, 'contract_code_resources_hashes_match': contract_check,
               'verification': verification, 'addresses': addresses, 'packs': packs, 'commands': commands}
    (ROOT / 'command-catalog.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    with (ROOT / 'command-catalog.csv').open('w', encoding='utf8', newline='') as stream:
        fields = ['sgbd', 'group', 'address_hex', 'command', 'description', 'function', 'args', 'route_candidate', 'job_template_hex', 'mapping_source']
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        for item in commands:
            row = {k: item[k] for k in fields}
            row['args'] = json.dumps(row['args'], ensure_ascii=False)
            writer.writerow(row)
    with (ROOT / 'job-catalog.csv').open('w', encoding='utf8', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=['sgbd', 'address_hex', 'job', 'template_hex'])
        writer.writeheader()
        writer.writerows(jobs)
    print(json.dumps(stats, indent=2))


if __name__ == '__main__':
    main()
