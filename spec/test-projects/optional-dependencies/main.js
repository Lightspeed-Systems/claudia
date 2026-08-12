const { S3Client } = require('@aws-sdk/client-s3'),
	fs = require('fs');
exports.handler = function (event, context) {
	'use strict';
	// instantiate the optional dependency to ensure it is available at runtime
	new S3Client({region: 'us-east-1'});
	context.succeed({
		modules: fs.readdirSync('node_modules')
	});
};
