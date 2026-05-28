module.exports = () => {
  const appJson = require('./app.json');
  return {
    expo: {
      ...appJson.expo,
      extra: {
        ...(appJson.expo.extra || {}),
        previewTarget: process.env.EXPO_PUBLIC_PREVIEW_TARGET,
      },
    },
  };
};
