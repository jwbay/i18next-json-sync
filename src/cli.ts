#!/usr/bin/env node

import * as yargs from 'yargs';
import sync from './';

const params = yargs
	.options({
		check: {
			type: 'boolean',
			alias: 'c',
			description: 'Audit files in memory instead of changing them on the filesystem and throw an error if any changes would be made'
		},
		files: {
			type: 'string',
			alias: 'f',
			description: 'Glob pattern for the resource JSON files'
		},
		excludefiles: {
			type: 'array',
			alias: 'ef',
			description: 'array of glob patterns to exclude from the files search. Defaults to node_modules',
			default: ['**/node_modules/**']
		},
		primary: {
			type: 'string',
			alias: 'p',
			description: 'Primary localization language. Other language files will be changed to match'
		},
		languages: {
			type: 'array',
			alias: 'l',
			description: `Language files to create if they don't exist`
		},
		space: {
			type: 'string',
			alias: 's',
			description: 'Space value used for JSON.stringify when writing JSON files to disk'
		},
		lineendings: {
			choices: ['LF', 'CRLF'] as const,
			alias: 'le',
			description: 'Line endings used when writing JSON files to disk -- either LF or CRLF'
		},
		finalnewline: {
			type: 'boolean',
			alias: 'fn',
			description: 'Insert a final newline when writing JSON files to disk'
		},
		newkeysempty: {
			type: 'boolean',
			alias: 'e',
			description: 'Use empty string for new keys instead of the primary language value'
		}
	})
	.example([
		[`$0 --check --files '**/locales/*.json' --primary en --languages es fr pt-BR ja --space \t --lineendings LF --finalnewline --newkeysempty`]
	])
	.alias('h', 'help')
	.parseSync();

sync({
	check: Boolean(params.check),
	files: params.files,
	excludeFiles: params.excludefiles,
	primary: params.primary,
	createResources: params.languages as string[],
	space: params.space,
	lineEndings: params.lineendings,
	finalNewline: Boolean(params.finalnewline),
	newKeysEmpty: Boolean(params.newkeysempty)
});
