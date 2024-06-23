
export {
  base,
  flat,
  respondJSON,
  collect,
  valueStream,
  devnull,
  filterStream,
  mapStream,
  asyncMapStream
}

// S T R E A M S
function base () {
  return {
    paused: true,
    ended: false,
    sink: null,
    source: null,
    resume: function () {
      if(!(this.paused = this.sink.paused) && this.source) {
        this.source.resume()
      }
    },

    write: function (data) {
      if (this.sink) {
        this.paused = this.sink.paused
      }
    },

    pipe: function (sink) {
      this.sink = sink
      sink.source = this
      if (!sink.paused) this.resume()
      while (sink.sink) {
        sink = sink.sink
      }
      return sink
    },
    
    abort: function (err) {
      if (this.source) this.source.abort(err)
      else this.end(err)
    },

    end: function (err) {
      this.ended = true
      this.paused = true
      if (this.sink) {
        this.sink.end(err)
      }
    }
  }
}

function mapStream (fn) {
  const stream = base()
  stream.write = function (data) {
    if (fn == null) {
      fn = function (a) { return a }
    }
    this.sink.write(fn.call(this,data))
    this.paused = this.sink.paused
  }
  return stream
}

function asyncMapStream (fn) {
  const stream = base()
  stream.write = function (data) {
    this.paused = true
    fn.call(this, data, (err, mapped) => {
      if (err) return this.abort(err)
      this.sink.write(mapped)
      this.paused = this.sink.paused
      this.resume()
    })
  }
  return stream
}
function filterStream (fn) {
  const stream = base()
  stream.write = function (data) {
    if (fn == null) {
      fn = function (a) { return a }
    }
    const pass = fn.call(this,data)
    if (pass) {
      this.sink.write(data)
    }
    this.paused = this.sink.paused
  }
  return stream
}

function devnull () {
  let stream = base()

  stream.paused = false

  return stream
}

function valueStream (values) {
  let stream = base() 
  let it = values[Symbol.iterator]()
  stream.resume = function () {
    while (!this.sink.paused && !this.ended) {
      let step = it.next()
      if (step.done) this.end()
      else this.sink.write(step.value)
    }
  }
  return stream
}

function collect (cb) {
  let stream = base()
  let items = []

  stream.write = function (data) {
    items.push(data)
  }

  stream.end = function (err) {
    this.ended = true
    this.paused = true
    cb(err, items)
    if (this.sink) {
      this.sink.end(err)
    }
  }

  stream.paused = false

  return stream
}

function respondJSON (res, mech) {
  let stream = collect((err, items) => {
    res.json({mech, state:items})
  })
  return stream
}

function flat () {
  const stream = base()
  let pool = []

  stream.write = function (data) {
    pool = pool.concat(data)
    console.log({pool})
    this.paused = this.sink && this.sink.paused
    if (!this.paused) this.resume()
  }

  stream.resume = function () {
    while (!this.ended && this.sink && !this.sink.paused && pool.length > 0) {
      this.sink.write(pool.shift())
    }
  }
  return stream
}

function fetchJSON () {
  return asyncMapStream(function (url, next) {
    fetch(url)
      .then((res) => res.json())
      .then((json) => next(null, json))
      .catch((err) => next(err))
  })
}

