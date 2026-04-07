const { S3Client } = require('@aws-sdk/client-s3'),
	fs = require('fs');
exports.handler = function (event, context) {
	'use strict';
	new S3Client({region: 'us-east-1'});
	context.succeed({
		endpoint: 'https://s3.us-east-1.amazonaws.com/',
		modules: fs.readdirSync('node_modules')
	});
};
