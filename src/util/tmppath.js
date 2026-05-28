const os = require('os'),
	{ v4: uuidv4 } = require('uuid'),
	path = require('path'),
	fsUtil = require('./fs-util');

module.exports = function tmppath(ext, generator) {
	'use strict';
	let result;
	generator = generator || uuidv4;
	ext = ext || '';
	while (!result || fsUtil.fileExists(result))  {
		result = path.join(os.tmpdir(), generator() + ext);
	}
	return result;
};
