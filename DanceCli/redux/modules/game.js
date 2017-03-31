import { takeLatest, put, select, race, call } from 'redux-saga/effects';
import { playerAction, estimatorAction } from 'pty-common/actions';
import Sound from 'react-native-sound';
import { Actions } from 'react-native-router-flux';
import WS from '../../helpers/ws';
import { GAME_PREPEARING_DURATION, GAME_PLAYING_DURATION } from '../../game-config';

export const addPlayerGameAction = ({ file }) => {
  return {
    type: 'ADD_PLAYER_GAME_ACTION',
    action: playerAction(file),
  };
};

export const addEstimatorGameAction = ({ gameUserId }) => {
  return {
    type: 'ADD_ESTIMATOR_GAME_ACTION',
    action: estimatorAction(gameUserId),
  };
};

export const startGamePlayback = () => {
  return {
    type: 'START_GAME_PLAYBACK',
  };
};

export const stopGamePlayback = () => {
  return {
    type: 'STOP_GAME_PLAYBACK',
  };
};

export const playerGameActionAdded = ({ file }) => {
  return { type: 'PLAYER_GAME_ACTION_ADDED', action: playerAction(file) };
};

export const estimatorGameActionAdded = (action) => {
  return { type: 'ESTIMATOR_GAME_ACTION_ADDED', action };
};

export const finishGameInit = ({ gameId, userData }) => {
  WS.instance.on('GAME_FINISHED', ({
    gameWinnerUserId,
    gameId: _gameId,
  }) => {
    if (gameId !== _gameId) {
      return;
    }

    WS.instance.off('GAME_FINISHED');
    WS.instance.off('GAME_ACTION_ADDED');
    WS.instance.off('GAME_RESIDUE_TIME');

    Actions.gameResult({ won: gameWinnerUserId === userData.id });

    setTimeout(() => {
      Actions.home();
    }, 3000);
  });
};

export const gameActionInit = ({ gameId }) => {
  return new Promise((resolve) => {
    WS.instance.on('GAME_ACTION_ADDED', ({ action, gameId: _gameId }) => {
      if (gameId !== _gameId) {
        return;
      }

      resolve(action);
    });
  });
};

export const gameResidueTimeInit = ({ gameId }) => {
  return new Promise((resolve) => {
    WS.instance.on('GAME_RESIDUE_TIME', ({ residueTime, gameId: _gameId }) => {
      if (gameId !== _gameId) {
        return;
      }

      resolve(residueTime);
    });
  });
};

export const loadPlayback = () => {
  return new Promise((resolve) => {
    const sound = new Sound(
      'https://freemusicarchive.org/music/download/0d677a99e994daf5c248dcdb4ccb73adb0ba196f',
      '',
      (err) => {
        if (err) {
          console.error(err);
        } else {
          resolve(sound);
        }
      },
    );
  });
};

export const startGamePlaybackCb = function* () {
  const { game: { playback } } = yield select();

  playback.play();
};

export const stopGamePlaybackCb = function* () {
  const { game: { playback } } = yield select();
  playback.stop();
};


export const addGameActionCb = function* ({ action }) {
  const { game: { gameId } } = yield select();
  WS.instance.send('ADD_GAME_ACTION', { action, gameId });
};

export const gameInitCb = function* () {
  const { authentication: { userData }, game: { gameId, isEstimator } } = yield select();

  const playback = yield loadPlayback();

  yield put({ type: 'SET_GAME_PLAYBACK', playback });

  if (!isEstimator) {
    Actions.capture();
  } else {
    Actions.estimation();
  }

  finishGameInit({ userData, gameId });

  while (true) {
    const { action, residueTime } = yield race({
      action: call(gameActionInit, { gameId }),
      residueTime: call(gameResidueTimeInit, { gameId }),
    });

    if (action !== undefined) {
      if (action.instrument === 'dance') {
        yield put(playerGameActionAdded(action));
      } else {
        yield put(estimatorGameActionAdded(action));
      }
    } else if (residueTime !== undefined) {
      yield put({ type: 'GAME_RESIDUE_TIME', residueTime });
    }
  }
};

const initialState = {
  gameId: undefined,
  playback: undefined,
  playersGameActions: [],
  estimatorsGameActions: [],
  residueTime: undefined,
  initResidueTime: undefined,
  prepearingResidueTime: undefined,
  playingResidueTime: undefined,
};

export const gameReducer = (
  state = initialState,
  { type, gameId, action, residueTime, isEstimator, playback },
) => {
  switch (type) {
    case 'GAME_INIT':
      return {
        ...state,
        gameId,
        isEstimator,
        residueTime,
        initResidueTime: residueTime,
        prepearingResidueTime: residueTime - (residueTime - GAME_PREPEARING_DURATION),
        playingResidueTime: residueTime - (residueTime - GAME_PLAYING_DURATION),
      };
    case 'PLAYER_GAME_ACTION_ADDED':
      return {
        ...state,
        playersGameActions: [...state.playersGameActions, action],
      };
    case 'ESTIMATOR_GAME_ACTION_ADDED':
      return {
        ...state,
        estimatorsGameActions: [...state.estimatorsGameActions, action],
      };
    case 'GAME_RESIDUE_TIME': {
      const obj = {
        ...state,
        residueTime,
      };

      const prepearingResidueTime = residueTime -
      (state.initResidueTime - GAME_PREPEARING_DURATION);
      let playingResidueTime = state.playingResidueTime;

      if (prepearingResidueTime >= 0) {
        obj.prepearingResidueTime = prepearingResidueTime;
      } else {
        obj.prepearingResidueTime = 0;

        playingResidueTime = (residueTime + GAME_PREPEARING_DURATION) -
        (state.initResidueTime - GAME_PLAYING_DURATION);
      }

      if (playingResidueTime >= 0) {
        obj.playingResidueTime = playingResidueTime;
      } else {
        obj.playingResidueTime = 0;
      }

      return obj;
    }
    case 'SET_GAME_PLAYBACK':
      return { ...state, playback };
    default:
      return state;
  }
};

export const gameSaga = function* () {
  yield takeLatest('GAME_INIT', gameInitCb);
  yield takeLatest('ADD_PLAYER_GAME_ACTION', addGameActionCb);
  yield takeLatest('ADD_ESTIMATOR_GAME_ACTION', addGameActionCb);
  yield takeLatest('START_GAME_PLAYBACK', startGamePlaybackCb);
  yield takeLatest('STOP_GAME_PLAYBACK', stopGamePlaybackCb);
};
