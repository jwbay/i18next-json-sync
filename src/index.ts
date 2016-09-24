import * as glob from 'glob';
import * as path from 'path';
import ActionRecorder from './ActionRecorder';
import LocalizationFolder from './LocalizationFolder';
import pluralForms from './pluralForms';

export interface IOptions {
	/** If true, audit files in memory instead of changing them on the filesystem. Throws an error if any changes would be made */
	check?: boolean;
	/** Glob pattern for the resource JSON files */
	files?: string;
	/** Primary localization language. Other language files will be changed to match */
	primary?: string;
	/** Language files to create if they don't exist, e.g. ['es, 'pt-BR', 'fr'] */
	createResources?: string[];
}

export interface IDirectoryMap { [directory: string]: IFileMap; }
export interface IFileMap { [filename: string]: Object; }
type localizationValue = { [key: string]: string } | string;

export default function sync({
	check: isReportMode = false,
	files = '**/locales/*.json',
	primary: primaryLanguage = 'en',
	createResources: createFiles = []
}: IOptions) {
	const allFiles = glob.sync(files);
	const directories = groupFilesByDirectory(allFiles);
	let targetLanguage: string;
	let record: ActionRecorder;
	let hasAnyErrors = false;
	let hasAnyChanges = false;
	for (const currentDirectory of Object.keys(directories)) {
		const folder = new LocalizationFolder(directories[currentDirectory], primaryLanguage, isReportMode);
		folder.populateFromDisk(createFiles);
		const sourceObject = folder.getSourceObject();

		if (!sourceObject) {
			continue;
		}

		for (const filename of folder.getFilenames()) {
			targetLanguage = normalizeLanguageFromFilename(filename);
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

	function normalizeLanguageFromFilename(filename: string) {
		return path.basename(filename, '.json').replace(/-/g, '_').toLowerCase();
	}

	function syncObjects(source: Object, target: Object) {
		for (const key of Object.keys(source)) {
			mergeKey(source, target, key);
		}

		for (const key of Object.keys(target)) {
			if (!source.hasOwnProperty(key) && !isValidMappedPluralForm(key, source)) {
				removeKey(source, target, key);
			}
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
				} else if (
					keyMatchesPluralForLanguage(key, primaryLanguage) &&
					!keyMatchesPluralForLanguage(key, targetLanguage)
				) {
					removeKey(source, target, key);
					syncObjects(createPlurals(key, sourceValue as string), target);
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
		} else if (
			keyMatchesPluralForLanguage(key, primaryLanguage) &&
			!keyMatchesPluralForLanguage(key, targetLanguage)
		) {
			syncObjects(createPlurals(key, sourceValue as string), target);
		} else {
			//base case: source contains key not present in target
			target[key] = sourceValue;
			record.keyAdded(key);
		}
	}

	function keyMatchesPluralForLanguage(key: string, language: string) {
		for (const form of getPluralsForLanguage(language)) {
			const plural = form.replace('key', '');
			if (plural && key.endsWith(plural)) {
				return true;
			}
		}

		return false;
	}

	function isValidMappedPluralForm(key: string, sourceObject: Object) {
		const singular = getSingularForm(key);

		for (const key of Object.keys(sourceObject)) {
			if (isPluralFormForSingular(key, singular)) {
				return true;
			}
		}

		return false;
	}

	function getSingularForm(key: string) {
		return key.replace(/_(plural|\d)/, '');
	}

	function isPluralFormForSingular(key: string, singular: string) {
		return getPluralsForLanguage(primaryLanguage)
			.map(form => form.replace('key', singular))
			.indexOf(key) > -1;
	}

	function getPluralsForLanguage(language: string) {
		if (pluralForms.hasOwnProperty(language)) {
			return pluralForms[language];
		}

		if (language.indexOf('_') > -1) {
			const baseLanguage = language.split('_')[0];
			if (pluralForms.hasOwnProperty(baseLanguage)) {
				return pluralForms[baseLanguage];
			}
		}

		return [];
	}

	function removeKey(source: Object, target: Object, key: string) {
		if (getTypeName(target[key]) === 'Object') {
			gatherKeysFor(target[key]).forEach(k => record.keyRemoved(k));
		} else {
			record.keyRemoved(key);
		}

		//base case: key in target not found in source
		delete target[key];
	}

	function createPlurals(key: string, fillValue: string) {
		const singular = getSingularForm(key);
		const plurals = {};
		for (const form of getPluralsForLanguage(targetLanguage)) {
			plurals[form.replace('key', singular)] = fillValue;
		}
		return plurals;
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
