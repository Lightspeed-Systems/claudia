#!/usr/bin/env node
const minimist = require('minimist'),
	path = require('path'),
	readCommands = require('../src/util/read-commands'),
	ConsoleLogger = require('../src/util/console-logger'),
	stsParams = require('../src/util/sts-params'),
	ask = require('../src/util/ask'),
	docTxt = require('../src/util/doc-txt'),
	readArgs = function () {
		'use strict';
		return minimist(process.argv.slice(2), {
			alias: { h: 'help', v: 'version' },
			string: ['source', 'name', 'region', 'profile', 'mfa-serial', 'mfa-token'],
			boolean: ['quiet', 'force'],
			default: {
				'source': process.cwd(),
				'mfa-serial': process.env.AWS_MFA_SERIAL,
				'sts-role-arn': process.env.AWS_ROLE_ARN,
				'mfa-duration': (process.env.AWS_MFA_DURATION || 3600)
			}
		});
	},
	main = function () {
		'use strict';
		const args = readArgs(),
			commands = readCommands(),
			command = args._ && args._.length && args._[0],
			logger = (!args.quiet) && new ConsoleLogger(),
			stsConfig = stsParams(args, ask);
		if (args.version && !command) {
			console.log(require(path.join(__dirname, '..', 'package.json')).version);
			return;
		}
		if (command && !commands[command]) {
			console.error(`unsupported command ${command}. re-run with --help for usage information`);
			process.exit(1);
			return;
		}
		if (args.help) {
			if (command) {
				console.log(docTxt.commandDoc(commands[command]));
			} else {
				console.log(docTxt.index(commands));
			}
			return;
		}
		if (!command) {
			console.error('command not provided. re-run with --help for usage information');
			process.exit(1);
			return;
		}
		if (args.profile) {
			process.env.AWS_PROFILE = args.profile;
		}
		if (args.proxy) {
			process.env.HTTPS_PROXY = args.proxy;
		}

		if (stsConfig) {
			const { fromTemporaryCredentials } = require('@aws-sdk/credential-providers'),
				credentialParams = {},
				buildCredentialOptions = function () {
					if (stsConfig.params.RoleArn) {
						credentialParams.RoleArn = stsConfig.params.RoleArn;
					}
					if (stsConfig.params.SerialNumber) {
						credentialParams.SerialNumber = stsConfig.params.SerialNumber;
						if (stsConfig.params.DurationSeconds) {
							credentialParams.DurationSeconds = stsConfig.params.DurationSeconds;
						}
					}
					const credentialOptions = { params: credentialParams };
					if (stsConfig.tokenCodeFn) {
						credentialOptions.mfaCodeProvider = (serial) => {
							return new Promise((resolve, reject) => {
								stsConfig.tokenCodeFn(serial, (err, token) => {
									if (err) {
										reject(err);
									} else {
										resolve(token);
									}
								});
							});
						};
					}
					return credentialOptions;
				};
			process.env.AWS_SDK_LOAD_CONFIG = '1';
			args._credentials = fromTemporaryCredentials(buildCredentialOptions());
		}

		commands[command](args, logger).then(result => {
			if (result && !args.quiet) {
				if (typeof result === 'string') {
					console.log(result);
				} else {
					console.log(JSON.stringify(result, null, 2));
				}
			}
			process.exit();
		}, e => {
			console.error(e);
			process.exit(1);
		});
	};
main();
