module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    // Syntax checks stay fast; TypeScript performs type-aware checks in build.
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
    },
    env: { browser: true, es2022: true },
    plugins: ['@typescript-eslint', 'import'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
    ],
    rules: {
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        // Closures may read a forward declaration before its later assignment.
        'prefer-const': ['error', { ignoreReadBeforeAssign: true }],
        'import/no-duplicates': 'error',
    },
    settings: {
        'import/resolver': { typescript: { project: './tsconfig.json' } },
    },
};
