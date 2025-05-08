module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: './tsconfig.json',
    },
    plugins: ['@typescript-eslint', 'import'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
    ],
    rules: {
        '@typescript-eslint/no-unused-vars': ['warn'],
        '@typescript-eslint/explicit-function-return-type': 'off',
        'import/order': ['warn', {
            groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
            pathGroups: [
                {
                    pattern: '@/**',
                    group: 'internal',
                },
            ],
            'newlines-between': 'always',
            alphabetize: {
                order: 'asc',
                caseInsensitive: true,
            },
        }],
        'no-multi-spaces': 'error',
        'indent': ['error', 4, { SwitchCase: 1 }],
        'semi': ['error', 'always'],
        'comma-dangle': ['error', 'always-multiline'],
        'quotes': ['error', 'single', { avoidEscape: true }],
    },
    settings: {
        'import/resolver': {
            typescript: {
                project: './tsconfig.json',
            },
        },
    },
    overrides: [
        {
            files: ['*.ts'],
        },
    ],
};
