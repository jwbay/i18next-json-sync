/** @type {import('@jest/types').Config} */
const config = {
  testEnvironment: "node",
  testRegex: "runner.js$",
  collectCoverageFrom: ["src/**/*.ts"],
};

module.exports = config;
