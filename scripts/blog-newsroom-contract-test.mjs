import assert from 'node:assert/strict'
import fs from 'node:fs'

const read=path=>fs.readFileSync(path,'utf8')
const header=read('components/public/PublicHeader.tsx')
const footer=read('components/public/PublicFooter.tsx')
const listing=read('components/blog/BlogExplorer.tsx')
const article=read('app/blog/[id]/page.tsx')
const blogContent=read('lib/blogContent.ts')
const editor=read('components/hq/SimpleArticleEditor.tsx')
const sitemap=read('app/sitemap.ts')

assert.match(header,/\['\/blog', 'News & Guides'\]/,'shared public navigation must expose the blog')
assert.match(footer,/href="\/blog"/,'public footer must expose the blog')
assert.match(listing,/aria-label="Article categories"/,'category controls must be labelled')
assert.match(listing,/aria-pressed=/,'category controls must expose selection state')
assert.match(listing,/No matching guides yet/,'search must have an empty state')
assert.match(article,/generateMetadata/,'published blog articles must have dynamic metadata')
assert.match(article,/'@type':'Article'/,'published blog articles must expose Article structured data')
assert.match(blogContent,/\.eq\('status', 'published'\)/,'article reader must remain published-only')
assert.match(blogContent,/filter\(isPublicBlogReady\)/,'unfinished publications must not enter the newsroom')
assert.match(editor,/Substantial article body \(150\+ words\)/,'editor must prevent thin article publishing')
assert.match(editor,/At least one discovery tag/,'editor must require discovery metadata')
assert.match(sitemap,/format === 'vibepress' \? `\$\{SITE_URL\}\/blog\/\$\{publication.id\}`/,'VibePress sitemap entries must use canonical blog routes')
assert.match(sitemap,/listKnowledgeArticles/,'verified Kenya education guides must be included in the sitemap')

console.log('Blog newsroom contract: PASS')
