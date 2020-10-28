#!/usr/bin/env node

import * as yargs from 'yargs';
import sync from './';

const {
	check,
	files,
	primary,
	languages,
	space,
	lineendings,
	finalnewline,
	newkeysempty,
	localesFolder
} = yargs
	.describe(
		'check',
		'Audit files in memory instead of changing them on the filesystem and throw an error if any changes would be made'
	)
	.alias('check', 'c')
	.boolean('check')

	.describe('files', 'Glob pattern for the resource JSON files')
	.example('--files', `'**/locales/*.json'`)
	.alias('files', 'f')
	.string('files')

	.describe('localesFolder', 'Locale folder name which by it translations will be grouped')
	.alias('localesFolder', 'lf')
	.string('localesFolder')

	.describe(
		'primary',
		'Primary localization language. Other language files will be changed to match'
	)
	.alias('primary', 'p')
	.string('primary')

	.describe('languages', `Language files to create if they don't exist`)
	.example('--languages', 'es fr pt-BR ja')
	.alias('languages', 'l')
	.array('languages')

	.describe('space', 'Space value used for JSON.stringify when writing JSON files to disk')
	.alias('space', 's')
	.string('space')

	.describe('lineendings', 'Line endings used when writing JSON files to disk -- either LF or CRLF')
	.alias('lineendings', 'le')
	.string('lineendings')

	.describe('finalnewline', 'Insert a final newline when writing JSON files to disk')
	.alias('finalnewline', 'fn')
	.boolean('finalnewline')

	.describe('newkeysempty', 'Use empty string for new keys instead of the primary language value')
	.alias('newkeysempty', 'e')
	.boolean('newkeysempty')

	.help('help')
	.alias('help', 'h').argv;

sync({
	check,
	files,
	primary,
	languages: languages as string[],
	space,
	lineEndings: lineendings as any,
	finalNewline: finalnewline,
	newKeysEmpty: newkeysempty,
	localesFolder
});
