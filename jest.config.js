/** @type {import('@jest/types').Config} */
const config = {
  testEnvironment: "node",
  testRegex: "runner\.js$|\.test\.ts",
  collectCoverageFrom: ["src/**/*.ts"],
};

module.exports = config;
