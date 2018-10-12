
module.exports = {
    "testEnvironment": "node",
    "transform": {
        "^.+\\.tsx?$": "ts-jest"
    },
    "testRegex": "(/__tests__/.*|(\\.|/)(test|spec))\\.(tsx?)$",
    "moduleFileExtensions": [
        "ts",
        "tsx",
        "js",
        "jsx",
        "json",
        "node"
    ],
    "collectCoverage": true,
    "collectCoverageFrom": [
        "src/**/*.ts",
        "!<rootDir>/src/__tests__/*",
        "!<rootDir>/src/entity/migration/*",
        "!<rootDir>/src/primitives/*",
        "!<rootDir>/src/shipchain/contracts/**/*"
    ],
    "coverageReporters": [
        "clover",
        "text"
    ],
    "coverageThreshold": {
        "global": {
            "branches": 0,
            "functions": 0,
            "lines": 0,
            "statements": 0
        }
    },
    "coverageDirectory": "<rootDir>/reports/",
    "testResultsProcessor": "<rootDir>/node_modules/jest-junit"
};
