const extractAliases = require('./extract-aliases'),
	{ ListVersionsByFunctionCommand, ListAliasesCommand } = require('@aws-sdk/client-lambda'),
	extractValues = function (resultItem) {
		'use strict';
		return {
			version: resultItem.Version,
			size: resultItem.CodeSize,
			time: resultItem.LastModified,
			runtime: resultItem.Runtime
		};
	};
module.exports = async function listVersions(lambdaName, lambda, filter) {
	'use strict';
	const listVersionsFromMarker = async marker => {
			const results = await lambda.send(new ListVersionsByFunctionCommand({FunctionName: lambdaName, Marker: marker})),
				versions = results.Versions,
				next = results.NextMarker,
				remainingVersions = next && await listVersionsFromMarker(next);

			if (!remainingVersions) {
				return versions;
			}
			return versions.concat(remainingVersions);
		},
		filterResults = (versionList) => {
			if (!filter) {
				return versionList;
			}
			const stringVersion = String(filter);
			return versionList.filter(item => String(item.version) === stringVersion || item.aliases.includes(stringVersion));
		},
		awsVersions = await listVersionsFromMarker(),
		awsAliases = await lambda.send(new ListAliasesCommand({FunctionName: lambdaName})),
		claudiaAliases = extractAliases(awsAliases),
		claudiaVersions = awsVersions.map(extractValues);
	return filterResults(claudiaVersions.map(versionObject => Object.assign(versionObject, {
		aliases: claudiaAliases[versionObject.version] || []
	})));
};
