import Q from 'q'

module.exports = {
  subscribe,
  unsubscribe,
  on,
  off,
  addAction
};

var prefix = ''

function subscribe(gameId) {
  var url = prefix + '/game/' + gameId + '/subscribe'

  var defer = Q.defer()
  socket.request({
    headers: {
      //userId: $.cookie('userId')
      userId: window.userId
    },
    method: 'get',
    url,
  }, defer.resolve, defer.reject)

  return defer.promise
}

function unsubscribe(gameId) {
  var url = prefix + '/game/' + gameId + '/unsubscribe'

  var defer = Q.defer()
  socket.request({
    headers: {
      //userId: $.cookie('userId')
      userId: window.userId
    },
    method: 'get',
    url,
  }, defer.resolve, defer.reject)

  return defer.promise
}

function addAction(gameId, data) {
  var url = prefix + '/game/' + gameId

  var defer = Q.defer()
  socket.request({
    headers: {
      //userId: $.cookie('userId')
      userId: window.userId
    },
    method: 'put',
    url,
    data
  }, defer.resolve, defer.reject)

  return defer.promise
}

function on(callback) {
  return socket.on('game', callback)
}

function off() {
  return socket.off('game')
}