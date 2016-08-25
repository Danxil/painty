var Q = require('q')
var _ = require('lodash')
var wsResponses = require('../services/wsResponses')

/**
* Game.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {
  attributes: {
    task: {
      model: 'Task',
    },
    game_actions: {
      collection: 'GameAction',
      via: 'game'
    },
    game_users: {
      collection: 'GameUser',
      via: 'game'
    },
    residue_time: {
      type: 'integer',
      defaultsTo: sails.config.constants.GAME_DURATION
    },
    getGameWinnerGameUserId: Q.async(function *() {
      if (this.residue_time) throw 'This game does not finished yet';

      var gameActions = yield GameAction
        .find({game: this.id})
        .populate('game_user')

      var estimatorsGameActions = _.filter(gameActions, function(estimatorsGameAction) {
        return estimatorsGameAction.game_user.is_estimator
      })

      estimatorsGameActions = _.uniqBy(estimatorsGameActions.reverse(), 'game_user.id')

      var result = _.groupBy(estimatorsGameActions, 'action.gameUserId')

      result = _.map(result, function(group, gameUserId) {
        var obj = {}

        obj[gameUserId] = group.length

        return obj
      })

      var checkNonWinner = _.uniqBy(result, function(obj) {
        return obj[_.keys(obj)[0]]
      }).length == 1 && result.length != 1

      if (checkNonWinner) return null

      result = _.max(result, function(obj) {
        return obj[_.keys(obj)[0]]
      })

      return parseInt(_.keys(result)[0])
    }),
    isEstimatorsPresent: Q.async(function *() {
      var game = yield Game.findOne({id: this.id}).populate('game_users');

      return !!_.filter(game.game_users, {is_estimator: true, is_bot: false}).length;
    }),
    addAction: Q.async(function *(gameUserId, action, req) {
      if (this.residue_time <= 0) throw 'This Game is finished'

      var gameAction = yield GameAction.create({
        action: action,
        game: this.id,
        game_user: gameUserId
      })

      Game.message(this.id, wsResponses.message('actionAdded', gameAction), req || null)

      return gameAction
    })
  },
  findWithMinEstimators: Q.async(function *(finderId) {
    var games = yield Game.find().populate('game_users')

    var filteredGames = _.filter(games, function(game) {
      return !(_.find(game.game_users, function(gameUser) {
        return gameUser.user == finderId
      }) || game.residue_time <= sails.config.constants.RESIDUE_TIME_TRESHOLD_FOR_GAME_SEARCH)
    })

    return _.sortBy(filteredGames, function(game) {
      return game.game_users.length
    })[0]
  }),
  createNew: Q.async(function *() {
    var tasks = yield Task.find();

    var task = _.sample(tasks);

    var game = yield Game.create({
      task: task.id
    });

    var gameTimeInterval = setInterval(Q.async(function *() {
      game.residue_time--

      game.save(Q.async(function *() {
        if (game.residue_time <= 0) {
          clearInterval(gameTimeInterval);

          game.getGameWinnerGameUserId().then(function(gameWinnerGameUserId) {
            var message = wsResponses.message('finishGame', {gameWinnerGameUserId: gameWinnerGameUserId});
            Game.message(game.id, message);
          })
        } else {
          var isEstimatorsPresent = yield game.isEstimatorsPresent();

          if (game.residue_time <= sails.config.constants.RESIDUE_TIME_FOR_ESTIMATOR_BOTS &&
            game.residue_time >= 1 &&
            !isEstimatorsPresent) {
            GameUser.createBotForGame(game.id, true);
          }
          message = wsResponses.message('residueTime', {residue_time: game.residue_time});

          Game.message(game.id, message);
        }
      }))
    }), 1000)

    return game
  })
};