"""Normalize official ESCO and O*NET exports to reviewable JSONL.
Usage: python scripts/pathways/build-catalogue.py --esco DIR --onet DIR --out FILE
No network calls, database writes, or inferred Kenya admission requirements.
"""
import argparse
import csv
import hashlib
import json
from pathlib import Path
import unicodedata

def clean(value):
    return ' '.join(unicodedata.normalize('NFKC', value or '').split())

def read(path, delimiter):
    with path.open(encoding='utf-8-sig', newline='') as f:
        yield from csv.DictReader(f, delimiter=delimiter)

def locate(root, names):
    for name in names:
        matches = sorted(root.rglob(name))
        if len(matches) == 1:
            return matches[0]
        if len(matches) > 1:
            raise ValueError(f'Ambiguous source file: {name}')
    raise FileNotFoundError(f'Missing source in {root}: {names}')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--esco', type=Path, required=True)
    parser.add_argument('--onet', type=Path, required=True)
    parser.add_argument('--esco-version', required=True)
    parser.add_argument('--onet-version', required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    rows = {}
    def add(kind, label, source, version, key, parent=None):
        label, key = clean(label), clean(key)
        if not label or not key:
            return
        identity = (kind, label.casefold())
        row = rows.setdefault(identity, {'id': hashlib.sha256(json.dumps(identity).encode()).hexdigest(), 'kind': kind, 'label': label, 'sources': []})
        record = {'source': source, 'version': version, 'key': key}
        if parent:
            record['occupation_key'] = parent
        if record not in row['sources']:
            row['sources'].append(record)
    for row in read(locate(args.esco, ['occupations_en.csv']), ','):
        add('occupation', row.get('preferredLabel'), 'ESCO', args.esco_version, row.get('conceptUri'))
    for row in read(locate(args.esco, ['skills_en.csv']), ','):
        kind = 'knowledge' if clean(row.get('skillType')).lower() == 'knowledge' else 'skill'
        add(kind, row.get('preferredLabel'), 'ESCO', args.esco_version, row.get('conceptUri'))
    for row in read(locate(args.onet, ['Occupation Data.txt']), '\t'):
        add('occupation', row.get('Title'), 'ONET', args.onet_version, row.get('O*NET-SOC Code'))
    for row in read(locate(args.onet, ['Job Titles.txt','Alternate Titles.txt']), '\t'):
        title = row.get('Alternate Title') or row.get('Job Title') or row.get('Title')
        code = row.get('O*NET-SOC Code')
        add('job_title', title, 'ONET', args.onet_version, code, code)
    for filename, kind in [('Abilities.txt','ability'),('Skills.txt','skill'),('Knowledge.txt','knowledge')]:
        for row in read(locate(args.onet, [filename]), '\t'):
            add(kind, row.get('Element Name'), 'ONET', args.onet_version, row.get('Element ID'))
    if not rows:
        raise ValueError('Empty catalogue')
    counts = {}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open('w', encoding='utf-8') as f:
        for key in sorted(rows):
            row = rows[key]
            f.write(json.dumps(row, ensure_ascii=False, sort_keys=True)+'\n')
            counts[row['kind']] = counts.get(row['kind'], 0) + 1
    print(json.dumps({'total':len(rows),'counts':counts,'target':100000,'remaining':max(0,100000-len(rows))}, sort_keys=True))
if __name__ == '__main__':
    main()
