import fs = require('fs');
import glob = require('glob');
import path = require('path');
import sh = require('shelljs');
import syncType, { Options } from '../src';
import util = require('util');
const main = (global as any).COVERAGE ? 'dist' : 'src';
const sync: typeof syncType = require(`../../${main}`).default;

sh.config.silent = true;
sh.pushd(__dirname);

let options: Options = {
	files: 'actual/**/locales/*.json'
};
try {
	options = Object.assign(options, require('./options').default);
} catch (e) { }

withCapturedConsole('log', 'stdout.txt', () => {
	withCapturedConsole('error', 'stderr.txt', () => {
		try {
			sync(options);
		} catch (err) {
			console.error('\nTHROWN:');
			if (err && err.stack) {
				console.error(err.stack.split('\n')[0], '\n', '\t...');
			} else {
				console.error(err);
			}
		}
	});
});

const resultFiles = buildFlatFileMapForDirectory('actual/**/*.*');
const testCase = path.basename(__dirname);
for (const filename of Object.keys(resultFiles)) {
	const contents = resultFiles[filename];
	test(`${testCase}:${filename}`, () => {
		expect(contents).toMatchSnapshot();
	});
}

sh.popd();

function withCapturedConsole(type: string, outFile: string, action: Function) {
	let captured = '';
	const original = console[type];
	console[type] = (...args: any[]) => captured += util.format.apply(null, args) + '\n';
	action();
	console[type] = original;
	fs.writeFileSync(`actual/${outFile}`, captured, { encoding: 'utf8' });
}

function buildFlatFileMapForDirectory(pattern: string) {
	return glob.sync(pattern).reduce((fileMap, filename) => {
		let contents = (sh.cat(filename) as any).stdout as string;
		const name = filename.slice(filename.indexOf('/') + 1);

		if (path.extname(filename) === '.json') {
			contents = contents
				.replace(/"/g, '')
				.replace(/\r\n/g, '\n');
		}

		fileMap[name] = contents;
		return fileMap;
	}, {} as { [filename: string]: string; });
}
