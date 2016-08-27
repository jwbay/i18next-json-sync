import fs = require('fs');
import glob = require('glob');
import path = require('path');

export interface IOptions {
	/** If true, audit files in memory instead of changing them on the filesystem */
	check?: boolean;
	/** Glob pattern for the resource JSON files */
	files?: string;
	/** Primary localization language. Other language files will be changed to match */
	primary?: string;
}

interface IDirectoryMap { [directory: string]: IFileMap; }
interface IFileMap { [filename: string]: Object; }
type localizationValue = { [key: string]: string } | string;

export default function sync({
	check: isReportMode = false,
	files = '**/locales/*.json',
	primary = 'en'
}: IOptions) {
	class LocalizationFolder {
		private files: IFileMap;

		constructor(files: IFileMap) {
			this.files = files;
		}

		public populateFromDisk() {
			Object.keys(this.files).forEach(name => {
				const fileContent = fs.readFileSync(name, 'utf8');
				this.files[name] = JSON.parse(fileContent);
			});
		}

		public flushToDisk() {
			Object.keys(this.files).forEach(name => {
				const fileContent = JSON.stringify(this.files[name], null, 2);
				fs.writeFileSync(name, fileContent, { encoding: 'utf8' });
				this.files[name] = null;
			});
		}

		public getSourceObject() {
			let source: Object;
			Object.keys(this.files).forEach(name => {
				if (path.basename(name, '.json') === primary) {
					source = this.files[name];
				}
			});
			return source;
		}

		public getTargetObject(name: string) {
			return this.files[name];
		}

		public getTargetFileNames() {
			return Object.keys(this.files).filter(name => {
				return path.basename(name, '.json') !== primary;
			});
		}
	}

	class ActionRecorder {
		private fileName: string;
		private errors: string[] = [];
		private addedKeys: string[] = [];
		private removedKeys: string[] = [];

		constructor(fileName: string) {
			this.fileName = fileName;
		}

		public keyAdded(key: string) {
			this.addedKeys.push(key);
		}

		public keyRemoved(key: string) {
			this.removedKeys.push(key);
		}

		public error(message: (fileName: string) => string) {
			this.errors.push(message(this.fileName));
		}

		public flushToConsole() {
			const errors = this.getErrors();
			const added = this.getMessageForAddedKeys();
			const removed = this.getMessageForRemovedKeys();

			errors && console.log(errors);
			added && console.log(added);
			removed && console.log(removed);

			return !!added || !!removed || !!errors;
		}

		private getErrors() {
			if (this.hasAnyErrors()) {
				return this.errors.join('\n');
			}
			return null;
		}

		public hasAnyErrors() {
			return this.errors.length > 0;
		}

		private getMessageForAddedKeys() {
			if (this.addedKeys.length > 0) {
				const prefix = isReportMode ? 'Missing keys in' : 'Pushed keys to';
				return `${prefix} ${this.fileName}: ${this.addedKeys.join(', ')}`;
			}
			return null;
		}

		private getMessageForRemovedKeys() {
			if (this.removedKeys.length > 0) {
				const prefix = isReportMode ? 'Orphaned keys found in' : 'Removed keys from';
				return `${prefix} ${this.fileName}: ${this.removedKeys.join(', ')}`;
			}
			return null;
		}
	}

	const allFiles = glob.sync(files);
	const directories = groupFilesByDirectory(allFiles);
	let record: ActionRecorder;
	for (const currentDirectory of Object.keys(directories)) {
		const folder = new LocalizationFolder(directories[currentDirectory]);
		folder.populateFromDisk();
		const sourceObject = folder.getSourceObject();

		if (!sourceObject) {
			continue;
		}

		for (const targetFile of folder.getTargetFileNames()) {
			record = new ActionRecorder(targetFile);
			syncObjects(sourceObject, folder.getTargetObject(targetFile));
			record.flushToConsole();
		}

		folder.flushToDisk();
	}

	function groupFilesByDirectory(allFiles: string[]) {
		const directories: IDirectoryMap = {};
		for (const filename of allFiles) {
			const directory = path.dirname(filename);
			directories[directory] = directories[directory] || {};
			directories[directory][filename] = null;
		}
		return directories;
	}

	function syncObjects(source: Object, target: Object) {
		for (const key of Object.keys(source)) {
			mergeKey(source, target, key);
		}

		for (const key of Object.keys(target)) {
			removeKey(source, target, key);
		}
	}

	function mergeKey(source: Object, target: Object, key: string) {
		const sourceValue: localizationValue = source[key];
		const sourceType = getTypeName(sourceValue);
		const targetValue: localizationValue = target[key];
		const targetType = getTypeName(targetValue);

		if (target.hasOwnProperty(key)) {
			if (sourceType === targetType) {
				if (sourceType === 'Object') {
					syncObjects(sourceValue, targetValue);
				}
				//base case: source and target agree on key name and value is string
			} else {
				record.error(file => `${file} contains type mismatch on key ${key}`);
			}
		} else {
			copyValue(sourceValue, target, key);
		}
	}

	function copyValue(sourceValue: localizationValue, target: Object, key: string) {
		if (getTypeName(sourceValue) === 'Object') {
			target[key] = {};
			syncObjects(sourceValue, target[key]);
		} else {
			//base case: source contains key not present in target
			target[key] = sourceValue;
			record.keyAdded(key);
		}
	}

	function removeKey(source: Object, target: Object, key: string) {
		if (!source.hasOwnProperty(key)) {
			if (getTypeName(target[key]) === 'Object') {
				gatherKeysFor(target[key]).forEach(k => record.keyRemoved(k));
			} else {
				record.keyRemoved(key);
			}
			//base case: key in target not found in source
			delete target[key];
		}
	}

	function gatherPrimitivesForSingleKey(object: Object, key: string): string[] {
		if (getTypeName(object[key]) === 'Object') {
			return gatherKeysFor(object[key]);
		} else {
			return [key];
		}
	}

	function gatherKeysFor(object: Object) {
		return Object.keys(object)
			.map(key => gatherPrimitivesForSingleKey(object, key))
			.reduce((all, next) => all.concat(next), []);
	}

	function getTypeName(object: any) {
		const fullName: string = Object.prototype.toString.call(object);
		return fullName.split(' ')[1].slice(0, -1);
	}
}
