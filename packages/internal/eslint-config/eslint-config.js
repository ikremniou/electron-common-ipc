module.exports = {
    env: {
        'browser': true,
        'commonjs': true,
        'es6': true,
        'node': true,
    },
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:import/errors',
        'plugin:import/warnings',
        'plugin:import/typescript'
    ],
    rules: {
        'quotes': ['error', 'single', { "avoidEscape": true, "allowTemplateLiterals": true }],
        'eol-last': ['error', 'always'],
        'semi': ['error', 'always'],
        'max-len': ['error', { code: 120 }],
        'consistent-return': 'error',
        'no-else-return': 'error',
        'no-eq-null': 'error',
        'eqeqeq': ['error', 'always'],
        'no-implicit-coercion': 'error',
        'no-lone-blocks': 'error',
        'no-lonely-if': 'error',
        'no-multi-spaces': 'error',
        'no-return-assign': 'error',
        'no-return-await': 'error',
        'no-useless-return': 'error',
        'no-duplicate-imports': 'off',
        'no-constructor-return': 'error',
        'no-self-compare': 'error',
        'no-template-curly-in-string': 'error',
        'no-unreachable-loop': 'error',
        'no-use-before-define': 'error',
        'no-extra-bind': 'error',
        'require-await': 'error',
        "lines-between-class-members": ["error", "always", { "exceptAfterSingleLine": true }],
        'camelcase': 'error',
        'curly': 'error',
        'no-multiple-empty-lines': 'error',
        'space-before-blocks': ['error', 'always'],
        'require-atomic-updates': 'error',
        // import settings
        "import/order": [
            "error",
            {
                "alphabetize": { "order": "asc", "caseInsensitive": true },
                "groups": [["external", "builtin"], ["index", "sibling", "parent", "internal", "object"], ["type"]],
                "newlines-between": "always"
            }
        ],
        "import/newline-after-import": "error",
        "import/no-unresolved": "error",
        // typescript settings
        "@typescript-eslint/require-await": "error",
        "@typescript-eslint/semi": ["error", "always"],
        "@typescript-eslint/type-annotation-spacing": "error",
        "@typescript-eslint/no-duplicate-imports": ["error"],
        "@typescript-eslint/prefer-readonly": ["error"],
        "@typescript-eslint/return-await": "error",
        "@typescript-eslint/no-explicit-any": ["error", { "ignoreRestArgs": true }],
        "@typescript-eslint/ban-types": ["off"],
        "@typescript-eslint/no-empty-interface": ["off"],
        "@typescript-eslint/no-empty-function": ["off"],
        "@typescript-eslint/no-inferrable-types": ["off"],
        "@typescript-eslint/naming-convention": [
            "error",
            {
                "selector": "enum",
                "format": ["PascalCase"]
            }
        ],
        "@typescript-eslint/prefer-namespace-keyword": "error",
        "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
        "@typescript-eslint/consistent-type-imports": "error",
        "@typescript-eslint/indent": "off",
        "@typescript-eslint/member-delimiter-style": [
            "error",
            {
                "multiline": {
                    "delimiter": "semi",
                    "requireLast": true
                },
                "singleline": {
                    "delimiter": "semi",
                    "requireLast": false
                }
            }
        ],
    },
    settings: {
        'import/parsers': {
            '@typescript-eslint/parser': ['ts']
        }
    }
};
