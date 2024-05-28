
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

  function format(nest) {
    const unique = Math.floor(Math.random()*1000000)
    const block = (more,path) => {
      const html = []
      for (part of more) {
        const key = `${unique}.${path.join('.')}`
        part.key = key
        if('command' in part)
          html.push(`<span id=${key}>${expand(part.command)}</span>`)
        else
          html.push(`<div id=${key} style="padding-left:15px">${block(part,[...path,0])}</div>  `)
        path[path.length-1]++
      }
      return html.join("<br>\n")
    }
    return block(nest,[0])
  }

  function trouble(elem,message) {
    elem.innerHTML += `<button style="border-width:0;color:red;">✖︎</button>`
    elem.querySelector('button').addEventListener('click',event => {
      elem.outerHTML += `<span style="width:80%;color:gray;">${message}</span>` })
  }

  function click_emit ({elem,body,state}) {
    if(elem.innerHTML.match(/button/)) return
    if (!body?.length) return trouble(elem,'CLICK expects indented blocks to follow.')
    elem.innerHTML += '<button style="border-width:0;">◉</button>'
    elem.querySelector('button').addEventListener('click',event => run(body,state))
  }

  function hello_emit ({elem,args}) {
    const want = args[0] == 'world' ? ' 🌎' : ' 😀'
    elem.innerHTML += want
  }

  function from_emit ({elem,args,body,state}) {
    const line = elem.innerHTML
    elem.innerHTML = line + ' ⏳'
    fetch(`//${args[0]}.json`)
      .then(res => res.json())
      .then(page => {
        state.page = page
        elem.innerHTML = line + ' ⌛'
        run(body,state)
      })
  }

  function sensor_emit ({elem,args,body,state}) {
    const line = elem.innerHTML.replaceAll(/ ⌛/g,'')
    if(!('page' in state)) return trouble(elem,`Expect "page" as with FROM.`)
    const datalog = state.page.story.find(item => item.type == 'datalog')
    if(!datalog) return trouble(elem, `Expect Datalog plugin in the page.`)
    const want = args[0]
    if(!want) return trouble(elem, 'SENSOR needs a sensor name.')
    const sensor = datalog.text.split(/\n/)
      .map(line => line.split(/ +/))
      .filter(fields => fields[0] == 'SENSOR')
      .find(fields => fields[1] == want)
    if(!sensor) return trouble(elem, `Expect to find "${want}" in Datalog.`)
    const url = sensor[2]

    const f = c => 9/5*(c/16)+32
    const avg = a => a.reduce((s,e)=>s+e,0)/a.length
    elem.innerHTML = line + ' ⏳'
    fetch(url)
      .then (res => res.json())
      .then (data => {
        elem.innerHTML = line + ' ⌛'
        const value = f(avg(Object.values(data)))
        state.temperature = `${value.toFixed(2)}°F`
        run(body,state)
      })
  }

  function report_emit ({elem,command,state}) {
    const value = state?.temperature
    if (!value) return trouble(elem,`Expect data, as from SENSOR.`)
    elem.innerHTML = command + `<br><font face=Arial size=32>${value}</font>`
  }

  const blocks = {
    CLICK: {emit:click_emit, bind:null},
    HELLO: {emit:hello_emit, bind:null},
    FROM: {emit:from_emit, bind:null},
    SENSOR:  {emit:sensor_emit, bind:null},
    REPORT:  {emit:report_emit, bind:null}
  }

  function run (nest,state={}) {
    const scope = nest.slice()
    while (scope.length) {
      const code = scope.shift()
      if ('command' in code) {
        const command = code.command
        const elem = document.getElementById(code.key)
        const [op, ...args] = code.command.split(/ +/)
        const next = scope[0]
        const body = next && ('command' in next) ? null : scope.shift()
        const stuff = {command,op,args,body,elem,state}
        if (blocks[op])
          blocks[op].emit.apply(null,[stuff])
        else
          if (op.match(/^[A-Z]+$/))
            trouble(elem,`${op} doesn't name a block we know.`)
          else if (code.command.match(/\S/))
            trouble(elem, `Expected line to begin with all-caps keyword.`)
      } else if(typeof code == 'array') {
        run(code,state)
      }
    }
  }

  function emit($item, item) {
    const lines = item.text.split(/\n/)
    const nest = tree(lines,[],0)
    const html = format(nest)
    $item.append(`<div style="background-color:#eee;padding:15px;border-top:8px;">${html}</div>`)
    run(nest)
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
