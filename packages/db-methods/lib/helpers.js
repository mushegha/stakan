const {
  curryN,
  join
} = require('ramda')

function targetFrom (params) {
  if (typeof params === 'string') {
    const [ broker, symbol ] = params.split('/')
    return { broker, symbol }
  }

  return params
}

function targetToString (params) {
  if (typeof params === 'string') return params

  const { broker, symbol } = params

  return `${broker}/${symbol}`
}

function keyFor (root, sub) {
  const target = targetToUri(root)
  return join(':', [ target, sub ])
}

module.exports.targetFrom = targetFrom
module.exports.targetToString = targetToString
module.exports.keyFor = curryN(2, keyFor)
