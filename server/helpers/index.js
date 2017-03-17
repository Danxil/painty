import gameConfig from '../game-config';

export const checkReqFormatAsync = (arr) => {
  Promise((resolve) => {
    arr.forEach((item) => {
      if (item === undefined) {
        throw new Error('Wrong body format recieved');
      }
    });

    resolve();
  });
};

export const getNextLevelExperienceFromLevel = (level) => {
  return gameConfig.GAME_WON_EXPERIENCE_VALUE * (level + 1) * (level + 1);
};

export const getLevelFromExperience = (experience) => {
  return Math.floor(Math.sqrt(experience) / Math.sqrt(gameConfig.GAME_WON_EXPERIENCE_VALUE));
};

export const generateGameWonExperienceFromLevel = () => {
  return gameConfig.GAME_WON_EXPERIENCE_VALUE;
};

export const errorResponse = (error) => {
  return { error };
};
