const underTest = require('../src/util/retriable-wrap');
describe('retriableWrap', () => {
	'use strict';
	let client,
		commandsModule,
		promises,
		wrapped,
		onRetry;
	class FirstMethodCommand {
		constructor(p) { this.input = p; }
	}
	class SecondMethodCommand {
		constructor(p) { this.input = p; }
	}
	class RetryAsyncCommand {
		constructor(p) { this.input = p; }
	}
	const buildPromise = function (name) {
		promises[name] = {};
		promises[name].promise = new Promise((resolve, reject) => {
			promises[name].resolve = resolve;
			promises[name].reject = reject;
		});
		return promises[name].promise;
	};
	beforeEach(() => {
		promises = {};
		client = jasmine.createSpyObj('client', ['send']);
		client.send.and.returnValue(buildPromise('first'));
		client.thirdField = 5;
		commandsModule = { FirstMethodCommand, SecondMethodCommand, RetryAsyncCommand };
		onRetry = jasmine.createSpy('onRetry');
		wrapped = underTest(client, commandsModule, onRetry);
	});
	it('provides Promise-suffixed accessors for known commands', () => {
		expect(typeof wrapped.firstMethodPromise).toBe('function');
		expect(typeof wrapped.secondMethodPromise).toBe('function');
	});
	it('passes through non-Promise properties', () => {
		expect(wrapped.thirdField).toEqual(5);
	});
	it('returns undefined for Promise-suffixed names without a matching command', () => {
		expect(wrapped.unknownMethodPromise).toBeUndefined();
	});
	it('calls client.send with the correct Command and params', done => {
		client.send.and.returnValue(Promise.resolve('result'));
		wrapped.firstMethodPromise({a: 123}).then(res => {
			expect(res).toEqual('result');
			expect(client.send).toHaveBeenCalled();
			const sentCommand = client.send.calls.mostRecent().args[0];
			expect(sentCommand instanceof FirstMethodCommand).toBe(true);
			expect(sentCommand.input).toEqual({a: 123});
		}).then(done, done.fail);
	});
	it('calls the correct Command for different methods', done => {
		client.send.and.returnValue(Promise.resolve('second-result'));
		wrapped.secondMethodPromise({b: 456}).then(res => {
			expect(res).toEqual('second-result');
			const sentCommand = client.send.calls.mostRecent().args[0];
			expect(sentCommand instanceof SecondMethodCommand).toBe(true);
			expect(sentCommand.input).toEqual({b: 456});
		}).then(done, done.fail);
	});
	describe('when client.send resolves', () => {
		it('does not resolve or reject until the underlying promise resolves', done => {
			const resolve = jasmine.createSpy('resolve'), reject = jasmine.createSpy('reject');
			wrapped.firstMethodPromise({}).then(resolve, reject);
			Promise.resolve().then(() => {
				expect(resolve).not.toHaveBeenCalled();
				expect(reject).not.toHaveBeenCalled();
			}).then(done, done.fail);
		});
		it('resolves as soon as the underlying promise resolves', done => {
			wrapped.firstMethodPromise({}).then(res => {
				expect(res).toEqual('result');
				expect(onRetry).not.toHaveBeenCalled();
			}).then(done, done.fail);
			promises.first.resolve('result');
		});
		it('rejects as soon as the underlying promise rejects with a non retriable error', done => {
			wrapped.firstMethodPromise({}).then(done.fail, err => {
				expect(err).toEqual('result');
				expect(onRetry).not.toHaveBeenCalled();
			}).then(done);
			promises.first.reject('result');
		});
	});
	describe('retrying TooManyRequestsException', () => {
		it('retries TooManyRequestsException', done => {
			const sequence = [buildPromise('a'), buildPromise('b')];
			client.send.and.callFake(() => sequence.shift());
			wrapped = underTest(client, commandsModule, onRetry, 10, 5);
			wrapped.retryAsyncPromise({}).then(result => {
				expect(onRetry).toHaveBeenCalled();
				expect(result).toEqual('good');
			}).then(done, done.fail);
			promises.a.reject({name: 'TooManyRequestsException'});
			promises.b.resolve('good');
		});
		it('does not retry other exceptions', done => {
			const sequence = [buildPromise('a'), buildPromise('b')];
			client.send.and.callFake(() => sequence.shift());
			wrapped = underTest(client, commandsModule, onRetry, 10, 5);
			wrapped.retryAsyncPromise({}).then(done.fail, err => {
				expect(err).toEqual({name: 'TooFewRequestsException'});
			}).then(done, done.fail);
			promises.a.reject({name: 'TooFewRequestsException'});
			promises.b.resolve('good');
		});
		it('fails TooManyRequestsException if over the retry limit', done => {
			const sequence = [buildPromise('a'), buildPromise('b'), buildPromise('c')];
			client.send.and.callFake(() => sequence.shift());
			wrapped = underTest(client, commandsModule, onRetry, 10, 1);
			wrapped.retryAsyncPromise({}).then(done.fail, err => {
				expect(onRetry).not.toHaveBeenCalled();
				expect(err).toEqual({name: 'TooManyRequestsException'});
			}).then(done);
			promises.a.reject({name: 'TooManyRequestsException'});
			promises.b.resolve('good');
		});
	});
	describe('binding non-command methods', () => {
		it('binds functions from the client', () => {
			client.customMethod = jasmine.createSpy('customMethod').and.returnValue('hello');
			wrapped = underTest(client, commandsModule, onRetry);
			expect(wrapped.customMethod()).toEqual('hello');
		});
	});
});
