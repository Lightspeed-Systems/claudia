const js = require('@eslint/js'),
	globals = require('globals');

module.exports = [
	{
		ignores: ['node_modules/**', 'spec/test-projects/**', 'eslint.config.js']
	},
	js.configs.recommended,
	{
		languageOptions: {
			ecmaVersion: 2017,
			sourceType: 'commonjs',
			globals: {
				...globals.node,
				...globals.es6
			}
		},
		rules: {
			'semi': ['error', 'always'],
			'strict': ['error', 'function'],
			'no-unused-vars': ['error', {'caughtErrors': 'none'}],
			'indent': ['error', 'tab', {'MemberExpression': 'off'}],
			'no-const-assign': 'error',
			'one-var': 'error',
			'prefer-const': 'error',
			'no-var': 'error',
			'prefer-arrow-callback': 'error',
			'no-plusplus': ['error', {'allowForLoopAfterthoughts': true}],
			'quotes': ['error', 'single', {'avoidEscape': true, 'allowTemplateLiterals': true}],
			'no-underscore-dangle': 'off',
			'no-use-before-define': ['error'],
			'require-await': ['error'],
			'eqeqeq': ['error'],
			'comma-spacing': ['error', {'before': false, 'after': true}],
			'key-spacing': ['error', {'afterColon': true, 'beforeColon': false}],
			'no-constant-binary-expression': 'off'
		}
	},
	{
		files: ['spec/**/*.js'],
		languageOptions: {
			globals: {
				...globals.jasmine
			}
		}
	}
];
