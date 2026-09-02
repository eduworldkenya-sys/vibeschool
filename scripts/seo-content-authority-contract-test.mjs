import assert from 'node:assert/strict'
import fs from 'node:fs'
const read=path=>fs.readFileSync(path,'utf8')
const layout=read('app/layout.tsx'),article=read('app/blog/[id]/page.tsx'),authority=read('lib/searchAuthority.ts'),guide=read('app/kenya-education/[slug]/page.tsx'),sitemap=read('app/sitemap.ts'),robots=read('app/robots.ts'),blogContent=read('lib/blogContent.ts'),explorer=read('components/blog/BlogExplorer.tsx')
assert.match(layout,/EducationalOrganization/);assert.match(layout,/knowsAbout/);assert.doesNotMatch(layout,/keywords\s*:/,'root metadata must not use legacy meta keywords')
for(const field of ['cbc_aligned','cbc_subject','cbc_grade','curriculum_framework'])assert.match(blogContent,new RegExp(field),`public publication query must carry ${field}`)
assert.match(blogContent,/https:\/\/www\.vibeschool\.co\.ke/)
assert.match(authority,/classifyPublication/);assert.match(authority,/hasCurriculumAuthority/);assert.match(authority,/authoritySource:/);assert.match(authority,/curriculum_framework/);assert.match(authority,/buildArticleMetadata/);assert.match(authority,/buildArticleSchemas/);assert.match(authority,/NewsArticle/);assert.match(authority,/about:/);assert.match(authority,/relatedSearchHref/)
assert.match(explorer,/cbc_subject/);assert.match(explorer,/cbc_grade/);assert.match(explorer,/curriculum_framework/)
assert.doesNotMatch(article,/keywords=/);assert.match(article,/buildArticleMetadata/);assert.match(article,/buildArticleSchemas/)
assert.match(guide,/citation:sources\.map/);assert.match(guide,/BreadcrumbList/);assert.match(guide,/robots:\{index:true,follow:true\}/)
assert.match(blogContent,/filter\(isPublicBlogReady\)/);assert.match(sitemap,/listKnowledgeArticles/);assert.match(robots,/\/blog\//);assert.match(robots,/\/kenya-education\//)
console.log('SEO content authority contract: PASS')
