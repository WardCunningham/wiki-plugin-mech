import { tree, format } from './interpreter.js'
import { run, trouble, inspect, response, button, element, jfetch, status } from './blocks.js'

// (function() {
;('use strict')
export const uniq = (value, index, self) => self.indexOf(value) === index
export const delay = time => new Promise(res => setTimeout(res, time))
export const asSlug = title =>
  title
    .replace(/\s/g, '-')
    .replace(/[^A-Za-z0-9-]/g, '')
    .toLowerCase()

function expand(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// P L U G I N

function emit($item, item) {
  const lines = item.text.split(/\n/)
  const nest = tree(lines, [], 0)
  const html = format(nest)
  const $page = $item.parents('.page')
  const pageKey = $page.data('key')
  const context = {
    item,
    itemId: item.id,
    pageKey,
    page: wiki.lineup.atKey(pageKey).getRawPage(),
    origin: window.origin,
    site: $page.data('site') || window.location.host,
    slug: $page.attr('id'),
    title: $page.data('data').title,
  }
  const api = { trouble, inspect, response, button, element, jfetch, status }
  const state = { context, api }
  $item.append(`<div style="background-color:#eee;padding:15px;border-top:8px;">${html}</div>`)
  run(nest, state)
}

function bind($item, item) {
  return $item.dblclick(() => {
    return wiki.textEditor($item, item)
  })
}

if (typeof window !== 'undefined' && window !== null) {
  window.plugins.mech = { emit, bind }
}

// if (typeof module !== "undefined" && module !== null) {
//   module.exports = {expand,tree,format,run}
// }

// export const register = typeof window == 'undefined' ? { expand,tree,format,run } : undefined
export { expand, tree, format, run }

// }).call(this)
