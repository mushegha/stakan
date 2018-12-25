const debug = require('debug')('stakan:connector:bitfinex')

const { Observable } = require('rxjs/Rx')

const {
  map
} = require('ramda')

const createPool = require('./pool')

const { subscribe } = require('./remote')

const {
  rowFrom,
  isSnapshot
} = require('./remote/helpers')

const buffer = require('@stakan/rx-l2-buffer')

/**
 * Setup
 */

const pool = createPool()

/**
 *
 */

function listen (symbol) {
  const broker = 'bitfinex'

  const sync = observer => ws => {
    let chanId = null
    let session = null

    const report = message => {
      const err = new Error(message)
      return observer.error(err)
    }

    const publish = raw => {
      if (isSnapshot(raw)) {
        session = Date.now()
      }

      const rows = isSnapshot(raw)
        ? map(rowFrom, raw)
        : [ rowFrom(raw) ]

      observer.next({
        broker,
        symbol,
        session,
        rows
      })
    }

    ws.on(`origin:re`, (x, data) => {
      if (x === chanId) publish(data)
    })

    ws.on('close', _ => {
      pool
        .release(ws)
        .then(_ => report('Disconnect'))
    })

    subscribe(ws, symbol)
      .then(res => {
        session = Date.now()
        chanId = res.chanId
      })
      .catch(report)
  }

  const init = observer => {
    pool
      .acquire()
      .then(sync(observer))
  }

  return new Observable(init)
    .pipe(buffer())
}

module.exports = listen