const Jasmine = require('jasmine'),
	{ SpecReporter } = require('jasmine-spec-reporter'),
	jrunner = new Jasmine(),
	runJasmine = function () {
		'use strict';
		let filter;
		process.argv.slice(2).forEach(option => {
			if (option === 'full') {
				jrunner.env.clearReporters();
				jrunner.env.addReporter(new SpecReporter({
					spec: {
						displayStacktrace: 'raw'
					}
				}));
			}
			if (option === 'ci') {
				jrunner.env.clearReporters();
				jrunner.env.addReporter(new SpecReporter({
					spec: {
						displayStacktrace: 'raw',
						displayDuration: true
					},
					suite: {
						displayNumber: true
					},
					colors: {
						enabled: false
					},
					prefixes: {
						successful: '[pass] ',
						failed: '[fail] ',
						pending: '[skip] '
					}
				}));
			}
			if (option.match('^filter=')) {
				filter = option.match('^filter=(.*)')[1];
			}
		});
		jrunner.loadConfig({
			'spec_dir': 'spec',
			'spec_files': [
				'**/*[sS]pec.js'
			],
			'helpers': [
				'helpers/**/*.js'
			]
		});
		jrunner.execute(undefined, filter);
	};

runJasmine();
