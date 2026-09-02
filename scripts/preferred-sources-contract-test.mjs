import assert from 'node:assert/strict'
import fs from 'node:fs'

const component = fs.readFileSync('components/google/PreferredSourceButton.tsx', 'utf8')
const article = fs.readFileSync('app/blog/[id]/page.tsx', 'utf8')
const authority = fs.readFileSync('lib/searchAuthority.ts', 'utf8')
const sitemap = fs.readFileSync('app/sitemap.ts', 'utf8')
const robots = fs.readFileSync('app/robots.ts', 'utf8')

assert.match(component, /https:\/\/news\.google\.com\/swg\/js\/v1\/publisher\.js/, 'official Google publisher library must be used')
assert.match(component, /google-add-preferred-source-btn/, 'official declarative Preferred Source control must be present')
assert.match(component, /https:\/\/www\.google\.com\/preferences\/source\?q=/, 'Google source-preferences fallback must exist')
assert.match(component, /vibeschool\.co\.ke/, 'VibeSchool domain must be the source target')
assert.match(article, /PreferredSourceButton/, 'published articles must expose the Preferred Source control')
assert.match(article, /buildArticleMetadata/, 'current Search Authority metadata path must be preserved')
assert.match(article, /buildArticleSchemas/, 'current structured-data authority must be preserved')
assert.match(article, /listRelatedBlogArticles/, 'current related-content behavior must be preserved')
assert.match(authority, /alternates:\s*\{\s*canonical/, 'canonical metadata must remain owned by Search Authority')
assert.match(authority, /robots:\s*\{\s*index:\s*true,\s*follow:\s*true/, 'published article indexing contract must remain explicit')
assert.match(sitemap, /\/blog/, 'blog must remain represented in sitemap generation')
assert.match(robots, /\/blog/, 'blog must remain represented in robots policy')

console.log('Preferred Sources current-authority contract: PASS')
