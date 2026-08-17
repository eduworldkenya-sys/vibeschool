#!/usr/bin/env python3
import json
from pathlib import Path
from urllib.parse import urlparse

root=Path(__file__).resolve().parents[1]
config=json.loads((root/'config/education-knowledge.json').read_text())
sources={s['id']:s for s in config['sources']}
articles=config['articles']
assert config['verified_on'], 'knowledge release needs verification date'
assert len(articles)>=4, 'initial knowledge authority release is too thin'
assert len({a['slug'] for a in articles})==len(articles), 'duplicate article slug'

for source in sources.values():
    assert source['authority'] and source['title'] and source['verified_on']
    parsed=urlparse(source['url'])
    assert parsed.scheme=='https' and parsed.netloc, f"invalid source URL {source['id']}"
    assert parsed.netloc.endswith(('education.go.ke','kicd.ac.ke','knec.ac.ke')), f"V1 source is not an approved Kenyan education authority: {parsed.netloc}"

for article in articles:
    assert article['title'] and article['description'] and article['updated_on'] and article['audience']
    assert article['sections'], f"article has no sections: {article['slug']}"
    for section in article['sections']:
        assert section['kind'] in {'fact','guidance','boundary'}
        assert section['body'].strip() and section['source_ids'], f"unsourced section in {article['slug']}"
        missing=set(section['source_ids'])-set(sources)
        assert not missing, f"unknown sources {missing} in {article['slug']}"

hub=(root/'app/kenya-education/page.tsx').read_text()
article_page=(root/'app/kenya-education/[slug]/page.tsx').read_text()
assert 'Fact, guidance and boundary are different content types.' in hub
assert 'getKnowledgeSources(section.source_ids)' in article_page
assert 'Official-source fact' in article_page and 'Practical guidance' in article_page and 'Important boundary' in article_page
print(f"Education Knowledge Contract: PASS ({len(articles)} articles, {len(sources)} official sources)")
