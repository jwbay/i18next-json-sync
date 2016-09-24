import * as fs from 'fs';
import * as path from 'path';
import { IFileMap } from './sync';
import stringify = require('json-stable-stringify');

export default class LocalizationFolder {
	constructor(
		private files: IFileMap,
		private primaryLanguage: string
	) { }

	public populateFromDisk() {
		Object.keys(this.files).forEach(name => {
			const fileContent = fs.readFileSync(name, 'utf8');
			this.files[name] = JSON.parse(fileContent);
		});
	}

	public flushToDisk() {
		Object.keys(this.files).forEach(name => {
			const fileContent = stringify(this.files[name], { space: 4 });
			fs.writeFileSync(name, fileContent, { encoding: 'utf8' });
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