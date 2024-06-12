// mech plugin, server-side component
// These handlers are launched with the wiki server.


(function() {

  const fs = require('fs')
  const process = require('process')

  function startServer(params) {
    var app = params.app,
        argv = params.argv

    return app.get('/plugin/mech/run/:slug([a-z-]+)/:itemId', (req, res) => {
      console.log(req.params)
      const uptime = process.uptime()
      try {
        const slug = req.params.slug
        const itemId = req.params.itemId
        const args = JSON.parse(atob(req.query.args || 'W10='))
        const path = `${argv.db}/${slug}`
        fs.readFile(path,(err,data) => {
          const page = JSON.parse(data)
          const item = page.story.find(item => item.id == itemId) || null
          return res.json({err,uptime,item,args});
        })
      } catch(err) {
        return res.json({err:err.message,uptime})
      }
    })

  }

  module.exports = {startServer}

}).call(this)
