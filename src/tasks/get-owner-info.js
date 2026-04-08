const loggingWrap = require('../util/logging-wrap'),
	NullLogger = require('../util/null-logger'),
	{ STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts'),
	awsClientConfig = require('../util/aws-client-config');
module.exports = function getOwnerInfo(region, optionalLogger, options) {
	'use strict';
	const logger = optionalLogger || new NullLogger(),
		sts = loggingWrap(new STSClient(awsClientConfig(region, options)), {log: logger.logApiCall, logName: 'sts'});
	return sts.send(new GetCallerIdentityCommand({}))
	.then(callerIdentity => ({
		account: callerIdentity.Account,
		partition: callerIdentity.Arn.split(':')[1]
	}));
};
