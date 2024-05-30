
(function() {

  const uniq = (value, index, self) => self.indexOf(value) === index

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
    if(elem.innerText.match(/✖︎/)) return
    elem.innerHTML += `<button style="border-width:0;color:red;">✖︎</button>`
    elem.querySelector('button').addEventListener('click',event => {
      elem.outerHTML += `<span style="width:80%;color:gray;">${message}</span>` })
  }

  function click_emit ({elem,body,state}) {
    if(elem.innerHTML.match(/button/)) return
    if (!body?.length) return trouble(elem,'CLICK expects indented blocks to follow.')
    elem.innerHTML += '<button style="border-width:0;">◉</button>'
    elem.querySelector('button').addEventListener('click',event => {
      state.debug = event.shiftKey
      run(body,state)
    })
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
        if(state.debug) console.log({sensor,data})
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

  function source_emit ({elem,command,args,body,state}) {
    if (!(args && args.length)) return trouble(elem,`Expected Source topic, like "markers" for Map markers.`)
    const topic = args[0]
    const sources = requestSourceData(state.$item, topic)
    if(!sources.length) return trouble(elem,`Expected source for "${topic}" in the lineup.`)
    const count = type => {
      const count = sources
        .filter(source => [...source.div.classList].includes(type))
        .length
      return count ? `${count} ${type}` : null}
    const counts = [count('map'),count('image'),count('frame')]
      .filter(count => count)
      .join(", ")
    if (state.debug) console.log({topic,sources})
    elem.innerHTML = command + ' ⇒ ' + counts
    state[topic] = sources
    if (body) run(body,state)
  }

  function preview_emit ({elem,command,args,state}) {
    const round = digits => (+digits).toFixed(7)
    const story = []
    for (const arg of args) {
      switch (arg) {
      case 'map':
        if(!('marker' in state)) return trouble(elem,`"map" preview expects "marker" state, like from "SOURCE marker".`)
        const text = state.marker
          .map(marker => [marker.result])
          .flat(2)
          .map(latlon => `${round(latlon.lat)}, ${round(latlon.lon)} ${latlon.label||''}`)
          .filter(uniq)
          .join("\n")
        story.push({type:'map',text})
        break
      case 'graph':
        if(!('aspect' in state)) return trouble(elem,`"graph" preview expects "aspect" state, like from "SOURCE aspect".`)
        for (const {div,result} of state.aspect) {
          for (const {name,graph} of result) {
            if(state.debug) console.log({div,result,name,graph})
            story.push({type:'paragraph',text:name})
            story.push({type:'graphviz',text:dotify(graph)})
          }
          story.push({type:'pagefold',text:'.'})
        }
        break
      case 'synopsis':
        {const text = `This page has been generated by the Mech plugin. We want to tell you where. That's coming soon.`
        story.push({type:'paragraph',text})}
        break
      default:
        return trouble(elem,`"${arg}" doesn't name an item we can preview`)
      }
    }
    const title = "Mech Preview" + (state.tick ? ` ${state.tick}` : '')
    const page = {title,story}
    const options = {$page:$(elem.closest('.page'))}
    wiki.showResult(wiki.newPage(page), options)
  }

  function neighbors_emit ({elem,command,args,state}) {
    const want = args[0]
    if(state.debug) console.log({neighborhoodObject:wiki.neighborhoodObject})
    const have = Object.entries(wiki.neighborhoodObject.sites)
      .filter(([domain,site]) => !site.sitemapRequestInflight && (!want || domain.includes(want)))
      .map(([domain,site]) => (site.sitemap||[])
        .map(info => Object.assign({domain},info)))
    state.neighborhood = have.flat()
      .sort((a,b) => b.date - a.date)
    elem.innerHTML = command + ` ⇒ ${state.neighborhood.length} pages, ${have.length} sites`
  }

  function walk_emit ({elem,command,args,state}) {
    const steps = Object.groupBy(walks(state.neighborhood),({graph})=>graph?'some':'none')
    if(state.debug) console.log({steps})
    const nodes = (steps.some||[]).map(({graph}) => graph.nodes).flat()
    elem.innerHTML = command + ` ⇒ ${(steps.some||[]).length} aspects, ${(steps.none||[]).length} empty, ${nodes.length} nodes`
    const item = elem.closest('.item')
    item.classList.add('aspect-source')
    item.aspectData = () => (steps.some||[])
    state.aspect = [{div:item,result:steps.some}]
  }

  function tick_emit ({elem,args,body,state}) {
    if(elem.innerHTML.match(/button/)) return
    if (!body?.length) return trouble(elem,'TICK expects indented blocks to follow.')
    const count = args[0] || '1'
    if (!count.match(/^[1-9][0-9]?$/)) return trouble(elem,"TICK expects a count from 1 to 99")
    let clock = null
    elem.innerHTML += '<button style="border-width:0;">◉</button>'
    elem.querySelector('button').addEventListener('click',event => {
      state.debug = event.shiftKey
      if(clock){
        clock = clearInterval(clock)
        delete state.tick
      } else {
        state.tick = +count
        run(body,state)
        clock = setInterval(()=>{
          if(state.debug) console.log({tick:state.tick})
          if(--state.tick > 0)
            run(body,state)
          else
            clock = clearInterval(clock)
        },1000)
      }
    })
  }

  const blocks = {
    CLICK:   {emit:click_emit},
    HELLO:   {emit:hello_emit},
    FROM:    {emit:from_emit},
    SENSOR:  {emit:sensor_emit},
    REPORT:  {emit:report_emit},
    SOURCE:  {emit:source_emit},
    PREVIEW: {emit:preview_emit},
    NEIGHBORS:{emit:neighbors_emit},
    WALK:    {emit:walk_emit},
    TICK:    {emit:tick_emit}
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
        if(state.debug) console.log(stuff)
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
    const state = {$item} // deprecated. use elem.closest('.item')
    $item.append(`<div style="background-color:#eee;padding:15px;border-top:8px;">${html}</div>`)
    run(nest,state)
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


// library functions

  // adapted from wiki-plugin-frame/client/frame.js
  function requestSourceData($item, topic) {
    let sources = []
    for (let div of document.querySelectorAll(`.item`)) {
      if (div.classList.contains(`${topic}-source`)) {
        sources.unshift(div)
      }
      if (div === $item.get(0)) {
        break
      }
    }

    return sources.map(div => {
      let getData = div[`${topic}Data`]
      let result = getData ? getData() : null
      return {div,result}
    })
  }

  // adapted from super-collaborator/dotify.js
  function dotify(graph) {
    const tip = props => Object.entries(props).filter(e => e[1]).map(e => `${e[0]}: ${e[1]}`).join("\\n")
    const nodes = graph.nodes.map((node,id) => {
      const label = node.type ? `${node.type}\\n${node.props.name}` : node.props.name
      return `${id} [label="${label}" ${(node.props.url||node.props.tick)?`URL="${node.props.url||'#'}" target="_blank"`:''} tooltip="${tip(node.props)}"]`
    })
    const edges = graph.rels.map(rel => {
      return `${rel.from}->${rel.to} [label="${rel.type}" labeltooltip="${tip(rel.props)}"]`
    })
    return [
      'digraph {',
      'rankdir=LR',
      'node [shape=box style=filled fillcolor=palegreen]',
      ...nodes,
      ...edges,
      '}'].join("\n")
  }

  // inspired by aspects-of-recent-changes/roster-graphs.html
  function walks(neighborhood) {
    const prob = n => Math.floor(n * Math.abs(Math.random()-Math.random()))
    const rand = a => a[prob(a.length)]
    const domains = neighborhood
      .map(info => info.domain)
      .filter(uniq)
    return domains
      .map(domain => {
        const name = domain.split('.').slice(0,3).join('.')
        const done = new Set()
        const graph = new Graph()
        let nid = 0
        const here = neighborhood
          .filter(info => info.domain==domain && ('links' in info))
        if(!here.length) return {name,graph:null}
        const find = slug => neighborhood.find(info => info.slug == slug)
        const node = info => {
          nid = graph.addNode('',{
            name:info.title.replaceAll(/ /g,"\n"),
            title:info.title,
            site:domain,
            links:Object.keys(info.links||{}).filter(slug => find(slug))})
          return nid}
        const rel = (here,there) => graph.addRel('',here,there)
        const links = nid => graph.nodes[nid].props.links.filter(slug => !done.has(slug))
        const start = rand(here)
        done.add(start.slug)
        node(start)
        for (n=5;n>0;n--) {
          try {
            const slugs = links(nid)
            const slug = rand(slugs)
            done.add(slug)
            const info = find(slug)
            rel(nid,node(info))}
          catch (e) {}
        }
        return {name,graph}
      })
  }

  // adapted from graph/src/graph.js
  class Graph {

    constructor(nodes=[], rels=[]) {
      this.nodes = nodes;
      this.rels = rels;
    }

    addNode(type, props={}){
      const obj = {type, in:[], out:[], props};
      this.nodes.push(obj);
      return this.nodes.length-1;
    }

    addRel(type, from, to, props={}) {
      const obj = {type, from, to, props};
      this.rels.push(obj);
      const rid = this.rels.length-1;
      this.nodes[from].out.push(rid)
      this.nodes[to].in.push(rid);
      return rid;
    }

    stringify(...args) {
      const obj = { nodes: this.nodes, rels: this.rels }
      return JSON.stringify(obj, ...args)
    }

  }

}).call(this)
