#!/usr/bin/env node

import sync from './';
import yargs = require('yargs');

const {
	check,
	files,
	primary,
	languages,
	space
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

	.describe('s', 'Space value used for JSON.stringify')
	.alias('s', 'space')

	.help('h')
	.alias('h', 'help')

	.argv;

sync({
	check,
	files,
	primary,
	createResources: languages,
	space
});