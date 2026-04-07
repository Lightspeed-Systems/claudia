const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3'),
	s3 = new S3Client();
exports.handler = function (event, context) {
	'use strict';
	const eventRecord = event.Records && event.Records && event.Records[0];
	console.log('got record', eventRecord);
	if (eventRecord) {
		if (eventRecord.eventSource === 'aws:s3' && eventRecord.s3) {
			s3.send(new DeleteObjectCommand({Bucket: eventRecord.s3.bucket.name, Key: eventRecord.s3.object.key}))
			.then(result => context.done(null, result))
			.catch(err => context.done(err));
		}
	}
};
