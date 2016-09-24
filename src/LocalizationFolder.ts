import * as fs from 'fs';
import * as path from 'path';
import { IFileMap } from './';
import stringify = require('json-stable-stringify');

export default class LocalizationFolder {
	constructor(
		private files: IFileMap,
		private primaryLanguage: string,
		private isReportMode: boolean
	) { }

	public populateFromDisk(filesToCreate: string[]) {
		const filesReadFromDisk = Object.keys(this.files).map(name => {
			const fileContent = fs.readFileSync(name, 'utf8');
			this.files[name] = JSON.parse(fileContent);
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
		}
	}

	public flushToDisk(space: string | number) {
		Object.keys(this.files).forEach(name => {
			if (!this.isReportMode) {
				const fileContent = stringify(this.files[name], { space });
				fs.writeFileSync(name, fileContent, { encoding: 'utf8' });
			}

			this.files[name] = null;
		});
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