import {blocks,trouble,inspect} from './blocks.js'

  function expand(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

 // I N T E R P R E T E R

  // https://github.com/dobbs/wiki-plugin-graphviz/blob/main/client/graphviz.js#L86-L103
  export function tree(lines, here, indent) {
    while (lines.length) {
      let m = lines[0].match(/( *)(.*)/)
      let spaces = m[1].length
      let command = m[2]
      if (spaces == indent) {
        here.push({command})
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
    const unique = Math.floor(Math.random()*1000000)
    const block = (more,path) => {
      const html = []
      for (const part of more) {
        const key = `${unique}.${path.join('.')}`
        part.key = key
        if('command' in part)
          html.push(`<font color=gray size=small></font><span style="display: block;" id=${key}>${expand(part.command)}</span>`)
        else
          html.push(`<div id=${key} style="padding-left:15px">${block(part,[...path,0])}</div>`)
        path[path.length-1]++
      }
      return html.join("\n")
    }
    return block(nest,[0])
  }

  export async function run (nest,state={},mock) {
    const scope = nest.slice()
    while (scope.length) {
      const code = scope.shift()
      if ('command' in code) {
        const command = code.command
        const elem = mock || document.getElementById(code.key)
        const [op, ...args] = code.command.split(/ +/)
        const next = scope[0]
        const body = next && ('command' in next) ? null : scope.shift()
        const stuff = {command,op,args,body,elem,state}
        if(state.debug) console.log(stuff)
        if (blocks[op])
          await blocks[op].emit.apply(null,[stuff])
        else
          if (op.match(/^[A-Z]+$/))
            trouble(elem,`${op} doesn't name a block we know.`)
          else if (code.command.match(/\S/))
            trouble(elem, `Expected line to begin with all-caps keyword.`)
      } else if(typeof code == 'array') {
        console.warn(`this can't happen.`)
        run(code,state) // when does this even happen?
      }
    }
  }
