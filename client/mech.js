
(function() {

  function expand(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*(.+?)\*/g, '<i>$1</i>')
  }

 // https://github.com/dobbs/wiki-plugin-graphviz/blob/main/client/graphviz.js#L86-L103
  function tree(lines, here, indent) {
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

  function format(nest,index) {
    const unique = Math.floor(Math.random()*1000000)
    const block = (more,path) => {
      const html = []
      for (part of more) {
        const key = `${unique}.${path.join('.')}`
        index[key] = part
        part.key = key
        if(part.command)
          html.push(`<span id=${key}>${expand(part.command)}</span>`)
        else
          html.push(`<div id=${key} style="padding-left:15px">${block(part,[...path,0])}</div>  `)
        path[path.length-1]++
      }
      return html.join("<br>\n")
    }
    return block(nest,[0])
  }

  function click_emit (elem) {
  }

  function click_bind (elem) {
  }

  function hello_emit (elem) {
    elem.innerHTML += ' 😀'
  }

  function hello_bind (elem) {
  }

  const blocks = {
    CLICK: {emit:click_emit, bind:click_bind},
    HELLO: {emit:hello_emit, bind:hello_bind}
  }

  function run (nest, index) {
    console.log({nest,index})
    for (const [key,code] of Object.entries(index)) {
      if(code.command) {
        const elem = document.getElementById(key)
        const [op, ...args] = code.command.split(/ +/)
        blocks[op].emit.apply(null,[elem])
      }
    }
  }

  function emit($item, item) {
    const lines = item.text.split(/\n/)
    const nest = tree(lines,[],0)
    const index = {}
    const html = format(nest,index)
    $item.append(`<div style="background-color:#eee;padding:15px;border-top:8px;">${html}</div>`)
    run(nest,index)
  }

  function bind($item, item) {
    return $item.dblclick(() => {
      return wiki.textEditor($item, item);
    })
  }

  if (typeof window !== "undefined" && window !== null) {
    window.plugins.mech = {emit, bind}
  }

  if (typeof module !== "undefined" && module !== null) {
    module.exports = {expand}
  }

}).call(this)
