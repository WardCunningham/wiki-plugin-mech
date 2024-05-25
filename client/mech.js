
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
        here.push(command)
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
        const key = `K${unique}P${path.join('.')}`
        index[key] = part
        part.key = key
        if(typeof part == 'string')
          html.push(`<span id=${key}>${expand(part.trim())}</span>`)
        else
          html.push(`<div id=${key} style="padding-left:15px">${block(part,[...path,0])}</div>  `)
        path[path.length-1]++
      }
      return html.join("<br>\n")
    }
    return block(nest,[0])
  }


  function emit($item, item) {
    const lines = item.text.split(/\n/)
    const nest = tree(lines,[],0)
    const index = {}
    $item.append(`
      <div style="background-color:#eee;padding:15px;border-top:8px;">${format(nest,index)}</div>`)
    console.log({nest,index,entries:Object.entries(index)})
    const happy = Object.entries(index)
      .filter(([k,v]) => (typeof v == 'string') && v.match(/HELLO/))
      .map(([k,v]) => document.getElementById(k))
    happy.forEach(elem => elem.innerHTML += ' 😀')
    console.log({happy})
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
