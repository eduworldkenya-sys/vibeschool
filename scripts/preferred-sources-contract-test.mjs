import assert from 'node:assert/strict'
import fs from 'node:fs'

const component = fs.readFileSync('components/google/PreferredSourceButton.tsx', 'utf8')
const article = fs.readFileSync('app/blog/[id]/page.tsx', 'utf8')
const sitemap = fs.readFileSync('app/sitemap.ts', 'utf8')
const robots = fs.readFileSync('app/robots.ts', 'utf8')

assert.match(component, /https:\/\/news\.google\.com\/swg\/js\/v1\/publisher\.js/, 'official Google Preferred Sources library must be used')
assert.match(component, /google-add-preferred-source-btn/, 'official declarative Google button must be rendered')
assert.match(component, /https:\/\/www\.google\.com\/preferences\/source\?q=/, 'official source-preferences deeplink must exist')
assert.match(component, /vibeschool\.co\.ke/, 'VibeSchool domain must be the preferred-source target')
assert.match(article, /PreferredSourceButton/, 'published articles must expose the Preferred Sources control')
assert.match(article, /'@type':'NewsArticle'/, 'news surface must expose NewsArticle structured data')
assert.match(article, /alternates:\{canonical\}/, 'articles must retain canonical metadata')
assert.match(article, /robots:\{index:true,follow:true\}/, 'published articles must remain indexable')
assert.match(sitemap, /`\$\{SITE_URL\}\/blog`/, 'blog hub must remain in sitemap')
assert.match(sitemap, /`\$\{SITE_URL\}\/blog\/\$\{publication\.id\}`/, 'published blog articles must remain in sitemap')
assert.match(robots, /['"]\/blog\/?['"]/, 'blog must remain crawlable in robots rules')

console.log('Preferred Sources contract: PASS')
