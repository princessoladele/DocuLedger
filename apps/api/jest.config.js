/** @type {import('jest').Config} */
module.exports = {
  rootDir: ".",
  testEnvironment: "node",
  transform: { "^.+\\.ts$": "ts-jest" },
  testMatch: ["<rootDir>/src/**/*.spec.ts"],
  moduleFileExtensions: ["js", "json", "ts"],
};
