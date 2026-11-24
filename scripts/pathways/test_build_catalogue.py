import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

class CatalogueTest(unittest.TestCase):
    def test_import(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            esco, onet = root/'esco', root/'onet'
            esco.mkdir()
            onet.mkdir()
            (esco/'occupations_en.csv').write_text('conceptUri,preferredLabel\nurn:doctor,Doctor\n', encoding='utf-8')
            (esco/'skills_en.csv').write_text('conceptUri,preferredLabel,skillType\nurn:skill,Communication,skill/competence\nurn:knowledge,Biology,knowledge\n', encoding='utf-8')
            (onet/'Occupation Data.txt').write_text('O*NET-SOC Code\tTitle\n1\tDoctor\n', encoding='utf-8')
            (onet/'Job Titles.txt').write_text('O*NET-SOC Code\tAlternate Title\n1\tPhysician\n', encoding='utf-8')
            for name, label in [('Abilities','Reasoning'),('Skills','Communication'),('Knowledge','Biology')]:
                (onet/(name+'.txt')).write_text('Element ID\tElement Name\n1\t'+label+'\n', encoding='utf-8')
            out = root/'catalogue.jsonl'
            cmd = [sys.executable,str(Path(__file__).with_name('build-catalogue.py')),'--esco',str(esco),'--onet',str(onet),'--esco-version','test','--onet-version','test','--out',str(out)]
            subprocess.run(cmd, check=True)
            rows = [json.loads(line) for line in out.read_text().splitlines()]
            self.assertEqual(len(rows), 5)
            self.assertEqual(len(next(r for r in rows if r['label']=='Doctor')['sources']),2)
            self.assertEqual(next(r for r in rows if r['label']=='Physician')['sources'][0]['occupation_key'],'1')
            self.assertEqual(len(next(r for r in rows if r['label']=='Communication')['sources']),2)
            first = out.read_bytes()
            subprocess.run(cmd, check=True)
            self.assertEqual(first,out.read_bytes())

if __name__ == '__main__':
    unittest.main()
