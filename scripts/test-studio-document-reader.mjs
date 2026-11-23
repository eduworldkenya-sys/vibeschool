import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TextbookSafeInlineHtml } from '../components/learn/TextbookSafeInlineHtml.tsx'

const render = content => renderToStaticMarkup(createElement(TextbookSafeInlineHtml, { content }))

test('published textbook preserves supported inline emphasis and paragraphs', () => {
  const html = render('<p data-studio-id="original"><strong>Important</strong> and <em>careful</em> &amp; clear</p>')
  assert.match(html, /<p><strong>Important<\/strong> and <em>careful<\/em> &amp; clear<\/p>/)
  assert.doesNotMatch(html, /data-studio-id/)
})

test('untrusted tags and event attributes cannot execute on the reader', () => {
  const html = render('<p onclick="steal()"><strong onmouseover="steal()">Safe</strong><img src=x onerror=steal()><script>steal()</script></p>')
  assert.match(html, /<strong>Safe<\/strong>/)
  assert.doesNotMatch(html, /<script|<img|onclick|onmouseover|onerror|src=/i)
})

test('author text is escaped and numeric entities are decoded safely', () => {
  const html = render('<p>2 &lt; 5 and &#x41; &amp; &#169; <code>x</code></p>')
  assert.match(html, /2 &lt; 5 and A &amp; © <code>x<\/code>/)
})
