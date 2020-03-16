
module.exports = {
    "testEnvironment": "shipchain",
    "transform": {
        "^.+\\.tsx?$": "ts-jest"
    },
    "testRegex": "/jest.testOrder.ts$",
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
        "!<rootDir>/rpc/__tests__/primitives/*",
        "!<rootDir>/rpc/Load/1.0.2/*",
        "!<rootDir>/src/__tests__/*",
        "!<rootDir>/src/Logger.ts",
        "!<rootDir>/src/entity/migration/*",
        "!<rootDir>/src/shipchain/contracts/**/*",
        "!<rootDir>/src/shipchain/__tests__/*"
    ],
    "coverageReporters": [
        "text",
        "text-summary",
        "html"
    ],
    "coverageThreshold": {
        "global": {
            "branches": 60,
            "functions": 75,
            "lines": 75,
            "statements": 75
        }
    },
    "coverageDirectory": "<rootDir>/reports/coverage/",
    "reporters": [
        "default",
        ["jest-junit", {output: "<rootDir>/reports/junit/jest-junit.xml"}]
    ]
};
