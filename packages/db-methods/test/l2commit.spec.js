import test from 'ava'

import { Command } from 'ioredis'

import Redis from '@stakan/redis'

import { l2commit } from '..'

/**
 *
 */

/**
 * Helpers
 */

const TOPIC = 'hopar:exo-nyx'

const keyFor = sub =>
  `${TOPIC}:${sub}`

const Entry = (side, price, amount = 1) => [
  'side', side,
  'price', price,
  'amount', amount
]

const BidRow = (...args) =>
  Entry('bids', ...args)

const AskRow = (...args) =>
  Entry('asks', ...args)

/**
 *
 */

const redis = new Redis()

/**
 * Commands
 */

async function addEntries (ctx = {}, entries) {
  const { seed = Date.now() } = ctx

  let { offset = 0 } = ctx

  //

  const add = members =>  {
    const key = keyFor('journal')
    const id = `${seed}-${++offset}`

    return redis
      .xadd(key, id, ...members)
  }

  const ps = entries.map(add)

  return Promise.all(ps)
}

const tearDown = _ => {
  const SUBS = [
    'journal',
    'data:rev',
    'data:bids',
    'data:asks'
  ]

  const ps = SUBS
    .map(keyFor)
    .map(sub => redis.del(sub))

  return Promise.all(ps)
}

test.before(tearDown)

test.after.always(tearDown)

test.serial('import', async t => {
  const entries = [
    BidRow(24.5),    // 1-1
    BidRow(25),      // 1-2
    AskRow(25.5),    // 1-3
    AskRow(25.5, 2), // 1-4
    BidRow(25, 0),   // 1-5
    AskRow(25)       // 1-6
  ]

  const assertRev = (expected, message) => rev =>
    t.is(rev, expected, message)

  const assertList = (expected, message) => list =>
    t.deepEqual(list, expected, message)


  const ids = await addEntries({ seed: 1 }, entries)

  await l2commit(redis, TOPIC, '1-2')
    .then(assertRev(null, 'bad start'))

  await l2commit(redis, TOPIC, 0, ids[2])
    .then(assertRev('1-3'))

  await l2commit(redis, TOPIC, '1-4', '1-5')
    .then(rev => t.is(rev, '1-5', 'ok start end'))

  await l2commit(redis, TOPIC)
    .then(rev => t.is(rev, '1-6', 'internal rev as start, till end'))

  await redis
    .zrangebylex(keyFor('data:bids'), '-', '+')
    .then(assertList([ '2450000000' ]))

  await redis
    .zrangebylex(keyFor('data:asks'), '-', '+')
    .then(assertList([ '2500000000', '2550000000' ]))
})

test.serial('next seed', async t => {
  const entries = [
    BidRow(35),
    AskRow(35.5)
  ]

  const assertList = (expected, message) => list =>
    t.deepEqual(list, expected, message)

  const ids = await addEntries({ seed: 2 }, entries)

  await l2commit(redis, TOPIC)

  await redis
    .zrangebylex(keyFor('data:bids'), '-', '+')
    .then(assertList(['3500000000'], 'reset on new seed'))

  await redis
    .zrangebylex(keyFor('data:asks'), '-', '+')
    .then(assertList(['3550000000'], 'reset on new seed'))
})
