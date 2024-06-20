const {
  base,
  flat,
  respondJSON,
  collect,
  valueStream,
  devnull,
  filterStream,
  mapStream,
  asyncMapStream
} = await import('./push-s.mjs')

function createRunner (blocks, getElem = function (a) { return a }) {
  return function run (nest, state={}, mock) {
    const origin = mapStream()
    let source = origin
    for (let here = 0; here < nest.length; here++) {
      // const code = scope.shift()
      const code = nest[here]
      if ('command' in code) {
        const command = code.command
        const elem = mock || getElem(code)
        const [op, ...args] = code.command.split(/ +/)
        const next = nest[here+1]
        const body = next && ('command' in next) ? null : nest[++here]
        const stuff = {command,op,args,body,elem,state}
        if(state.debug) console.log(stuff)
        if (blocks[op])
          source = source.pipe(blocks[op].emit.call(null, stuff))
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

    return origin
  }
}

export { createRunner }
