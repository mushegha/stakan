import test from 'ava'

import Redis from '@stakan/redis'

import { l2depth } from '..'

const redis = new Redis()

const TOPIC = 'hopar/exo-nyx'

/**
 * Helpers
 */

const keyFor = sub =>
  `${TOPIC}:${sub}`

const Entry = (price, amount = 1) =>
  [ amount, price ]

const tearDown = _ => {
  const SUBS = [
    'data:rev',
    'data:asks',
    'data:bids'
  ]

  const ps = SUBS
    .map(keyFor)
    .map(sub => redis.del(sub))

  return Promise.all(ps)
}

test.before(tearDown)

test.after.always(tearDown)

test.serial('l2depth', async t => {
  const bids = [
    1, 2400000000,
    1, 2450000000
  ]

  const asks = [
    1, 2500000000,
    1, 2600000000
  ]

  await redis.set(keyFor('data:rev'), '1-4')
  await redis.zadd(keyFor('data:bids'), ...bids)
  await redis.zadd(keyFor('data:asks'), ...asks)

  await l2depth(redis, TOPIC)
    .then(res => {
      const expeced = {
        broker: 'hopar',
        symbol: 'exo-nyx',
        rev: '1-4',
        rows: [
          { side: 'bids', price: 24, amount: 1 },
          { side: 'bids', price: 24.5, amount: 1 },
          { side: 'asks', price: 25, amount: 1 },
          { side: 'asks', price: 26, amount: 1 }
        ]
      }

      t.deepEqual(res, expeced)
    })
})
