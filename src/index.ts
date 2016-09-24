import ActionRecorder from './ActionRecorder';
import glob = require('glob');
import LocalizationFolder from './LocalizationFolder';
import path = require('path');

export interface IOptions {
	/** If true, audit files in memory instead of changing them on the filesystem. Throws an error if any changes would be made */
	check?: boolean;
	/** Glob pattern for the resource JSON files */
	files?: string;
	/** Primary localization language. Other language files will be changed to match */
	primary?: string;
}

export interface IDirectoryMap { [directory: string]: IFileMap; }
export interface IFileMap { [filename: string]: Object; }
type localizationValue = { [key: string]: string } | string;

export default function sync({
	check: isReportMode = false,
	files = '**/locales/*.json',
	primary = 'en'
}: IOptions) {
	const allFiles = glob.sync(files);
	const directories = groupFilesByDirectory(allFiles);
	let record: ActionRecorder;
	let hasAnyErrors = false;
	let hasAnyChanges = false;
	for (const currentDirectory of Object.keys(directories)) {
		const folder = new LocalizationFolder(directories[currentDirectory], primary);
		folder.populateFromDisk();
		const sourceObject = folder.getSourceObject();

		if (!sourceObject) {
			continue;
		}

		for (const filename of folder.getFilenames()) {
			record = new ActionRecorder(filename, isReportMode);
			syncObjects(sourceObject, folder.getTargetObject(filename));
			record.flushToConsole();
			hasAnyChanges = hasAnyChanges || record.hasAnyActions();
			hasAnyErrors = hasAnyErrors || record.hasAnyErrors();
		}

		folder.flushToDisk();
	}

	if (hasAnyErrors) {
		throw new Error('[i18next-json-sync] found keys unsafe to synchronize');
	}

	if (isReportMode && hasAnyChanges) {
		throw new Error('[i18next-json-sync] check failed');
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
