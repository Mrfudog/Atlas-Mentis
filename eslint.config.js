import js from '@eslint/js';
import ts from 'typescript-eslint';

export default ts.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.angular/**', 'legacy/**', 'prototype/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    /* Node-Skripte im Repo (Erzeuger, Prüfaufbau) laufen nicht im Browser.
       Ohne diese Zeile hält eslint `process` und `console` für Tippfehler. */
    files: ['**/scripts/**/*.mjs', '**/*.config.{js,mjs,ts}'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
  },
  {
    rules: {
      /* `ignoreRestSiblings`: `const { passwordHash: _hash, ...rest } = user`
         ist die Art, ein Feld wegzulassen, und kein vergessener Wert. */
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
);
