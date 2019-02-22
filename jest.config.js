
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
        "rpc/**/*.ts",
        "src/**/*.ts",
        "!<rootDir>/rpc/__tests__/*",
        "!<rootDir>/src/__tests__/*",
        "!<rootDir>/src/Logger.ts",
        "!<rootDir>/src/entity/migration/*",
        "!<rootDir>/src/shipchain/contracts/**/*"
    ],
    "coverageReporters": [
        "text",
        "html"
    ],
    "coverageThreshold": {
        "global": {
            "branches": 0,
            "functions": 0,
            "lines": 0,
            "statements": 0
        }
    },
    "coverageDirectory": "<rootDir>/reports/coverage/",
    "reporters": [
        "default",
        ["jest-junit", {output: "<rootDir>/reports/junit/jest-junit.xml"}]
    ]
};
