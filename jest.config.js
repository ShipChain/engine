
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
    "reporters": [
        "default",
        ["jest-junit", {output: "<rootDir>/reports/junit.xml"}]
    ]
};
