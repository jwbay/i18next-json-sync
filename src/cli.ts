#!/usr/bin/env node

import sync from './';
import yargs = require('yargs');

const {
	check,
	files,
	primary,
	languages,
	space,
	lineendings
} = yargs
	.describe('c','Audit files in memory instead of changing them on the filesystem and throw an error if any changes would be made')
	.alias('c','check')
	.boolean('c')

	.describe('f', 'Glob pattern for the resource JSON files')
	.example('--files', '**/locales/*.json')
	.alias('f', 'files')

	.describe('p', 'Primary localization language. Other language files will be changed to match')
	.alias('p', 'primary')

	.describe('l', `Language files to create if they don't exist`)
	.example('--languages', 'es fr pt-BR ja')
	.alias('l', 'languages')
	.array('l')

	.describe('s', 'Space value used for JSON.stringify when writing JSON files to disk')
	.alias('s', 'space')

	.describe('le', 'Line endings used when writing JSON files to disk -- either LF or CRLF')
	.alias('le', 'lineendings')

	.help('h')
	.alias('h', 'help')

	.argv;

sync({
	check,
	files,
	primary,
	createResources: languages,
	space,
	lineEndings: lineendings
});