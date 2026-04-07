const listWrappableFunctions = require('../src/util/list-wrappable-functions');
describe('listWrappableFunctions', () => {
	'use strict';
	it('should identify function properties', () => {
		expect(listWrappableFunctions({ a: () => {}, b: () => {} })).toContain('a');
		expect(listWrappableFunctions({ a: () => {}, b: () => {} })).toContain('b');
	});
	it('should ignore constructors', () => {
		expect(listWrappableFunctions({ constructor: () => {}, a: () => {} })).not.toContain('constructor');
		expect(listWrappableFunctions({ constructor: () => {}, a: () => {} })).toContain('a');
	});
	it('should not contain any properties that are not functions', () => {
		expect(listWrappableFunctions({ a: () => {}, b: 5 })).toEqual(['a']);
	});
	it('should return an empty array for objects with no functions', () => {
		expect(listWrappableFunctions({ x: 1, y: 'hello' })).toEqual([]);
	});
});
