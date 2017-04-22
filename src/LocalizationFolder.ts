import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { IFileMap, lineEndings } from './';
const stringify = require('json-stable-stringify');

interface IHashMap { [filename: string]: string; }

export default class LocalizationFolder {
	private hashes: IHashMap;

	constructor(
		private files: IFileMap,
		private primaryLanguage: string,
		private isReportMode: boolean
	) {
		this.hashes = {};
	}

	public populateFromDisk(filesToCreate: string[]) {
		const filesReadFromDisk = Object.keys(this.files).map(name => {
			const fileContent = fs.readFileSync(name, 'utf8');
			this.files[name] = JSON.parse(fileContent);
			this.hashes[name] = crypto.createHash('md5').update(fileContent).digest('hex');
			return path.basename(name, '.json');
		});
		const dirname = path.dirname(Object.keys(this.files)[0]);
		this.registerMissingFiles(filesToCreate, filesReadFromDisk, dirname);
	}

	private registerMissingFiles(shouldExist: string[], doExist: string[], dirname: string) {
		for (const file of shouldExist) {
			if (doExist.indexOf(file) > -1) {
				continue;
			}

			const filename = path.join(dirname, file + '.json').split(path.sep).join('/');
			this.files[filename] = {};
			this.hashes[filename] = '';
		}
	}

	public flushToDisk(jsonSpacing: string | number, lineEnding: lineEndings, addFinalNewline: boolean) {
		const changedFiles: string[] = [];

		Object.keys(this.files).forEach(name => {
			let fileContent = stringify(this.files[name], { space: jsonSpacing });
			if (lineEnding === 'CRLF') {
				fileContent = fileContent.replace(/\n/g, '\r\n');
			}

			if (addFinalNewline) {
				switch (lineEnding) {
					case 'LF':
						fileContent += '\n';
						break;
					case 'CRLF':
						fileContent += '\r\n';
						break;
				}
			}

			const hash = crypto.createHash('md5').update(fileContent).digest('hex');
			if (this.hashes[name] !== hash) {
				changedFiles.push(name);
			}

			if (!this.isReportMode) {
				fs.writeFileSync(name, fileContent, { encoding: 'utf8' });
			}

			this.hashes[name] = null;
			this.files[name] = null;
		});

		return changedFiles;
	}

	public getSourceObject() {
		let source: Object;
		Object.keys(this.files).forEach(name => {
			if (path.basename(name, '.json') === this.primaryLanguage) {
				source = this.files[name];
			}
		});
		return source;
	}

	public getTargetObject(name: string) {
		return this.files[name];
	}

	public getFilenames() {
		return Object.keys(this.files);
	}
}