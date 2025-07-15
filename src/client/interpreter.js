import { blocks, trouble, inspect, run } from './blocks.js'

function expand(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// I N T E R P R E T E R

// https://github.com/dobbs/wiki-plugin-graphviz/blob/main/client/graphviz.js#L86-L103
export function tree(lines, here, indent) {
  while (lines.length) {
    let m = lines[0].match(/( *)(.*)/)
    let spaces = m[1].length
    let command = m[2]
    if (spaces == indent) {
      here.push({ command })
      lines.shift()
    } else if (spaces > indent) {
      var more = []
      here.push(more)
      tree(lines, more, spaces)
    } else {
      return here
    }
  }
  return here
}

export function format(nest) {
  const unique = Math.floor(Math.random() * 1000000)
  const block = (more, path) => {
    const html = []
    for (const part of more) {
      const key = `${unique}.${path.join('.')}`
      part.key = key
      if ('command' in part)
        html.push(
          `<font color=gray size=small></font><span style="display: block;" id=${key}>${expand(part.command)}</span>`,
        )
      else html.push(`<div id=${key} style="padding-left:15px">${block(part, [...path, 0])}</div>`)
      path[path.length - 1]++
    }
    return html.join('\n')
  }
  return block(nest, [0])
}
