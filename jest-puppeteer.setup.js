const { setup: setupPuppeteer } = require('jest-environment-puppeteer');

module.exports = async () => {
  await setupPuppeteer();
  // Additional setup steps if needed
};
