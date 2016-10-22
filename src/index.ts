import * as glob from 'glob';
import * as path from 'path';
import ActionRecorder from './ActionRecorder';
import LocalizationFolder from './LocalizationFolder';
import pluralForms from './pluralForms';

export interface IOptions {
	/** Audit files in memory instead of changing them on the filesystem and throw an error if any changes would be made */
	check?: boolean;
	/** Glob pattern for the resource JSON files */
	files?: string;
	/** Primary localization language. Other language files will be changed to match */
	primary?: string;
	/** Language files to create if they don't exist, e.g. ['es, 'pt-BR', 'fr'] */
	createResources?: string[];
	/** Space value used for JSON.stringify when writing JSON files to disk */
	space?: string | number;
	/** Line endings used when writing JSON files to disk */
	lineEndings?: 'LF' | 'CRLF';
}

export interface IDirectoryMap { [directory: string]: IFileMap; }
export interface IFileMap { [filename: string]: Object; }
type localizationValue = { [key: string]: string } | string;
type lineEndings = 'LF' | 'CRLF';

export default function sync({
	check: isReportMode = false,
	files = '**/locales/*.json',
	primary: primaryLanguage = 'en',
	createResources: createFiles = [],
	space: jsonSpacing = 4,
	lineEndings = 'LF'
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

		folder.flushToDisk(jsonSpacing, lineEndings.toUpperCase() as lineEndings);
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
		mergeKeys(source, target);

		for (const key of Object.keys(target)) {
			if (source.hasOwnProperty(key) && target.hasOwnProperty(key)) {
				// we should remove book and book_plural if the language doesn't support singular forms
				if (keyIsOnlyPluralForPrimary(key, Object.keys(source), Object.keys(target))) {
					removeKey(source, target, key);
				}
			} else if (!isValidMappedPluralForm(key, source)) { // don't remove valid mappings from book_plural to book_0
				removeKey(source, target, key);
			}
		}
	}

	function mergeKeys(source: Object, target: Object) {
		for (const key of Object.keys(source)) {
			mergeKey(source, target, key);
		}
	}

	function mergeKey(source: Object, target: Object, key: string) {
		const sourceValue: localizationValue = source[key];
		const targetValue: localizationValue = target[key];

		if (target.hasOwnProperty(key)) {
			if (areSameTypes(sourceValue, targetValue)) {
				if (isObject(sourceValue)) {
					syncObjects(sourceValue, targetValue);
				} else if (
					keyMatchesPluralForLanguage(key, primaryLanguage) &&
					!keyMatchesPluralForLanguage(key, targetLanguage)
				) {
					removeKey(source, target, key);
					mergeKeys(createPlurals(key, sourceValue as string), target);
				}

				//base case: source and target agree on key name and value is string
			} else {
				record.error(file => `${file} contains type mismatch on key ${key}`);
			}
		} else {
			copyValue(source, target, key);
		}
	}

	function copyValue(source: Object, target: Object, key: string) {
		const sourceValue = source[key];
		if (isObject(sourceValue)) {
			target[key] = {};
			syncObjects(sourceValue, target[key]);
		} else if (
			keyMatchesPluralForLanguage(key, primaryLanguage) &&
			!keyMatchesPluralForLanguage(key, targetLanguage)
		) {
			mergeKeys(createPlurals(key, sourceValue as string), target);
		} else if (!keyIsOnlyPluralForPrimary(key, Object.keys(source), Object.keys(target))) {
			//base case: source contains key not present in target
			target[key] = sourceValue;
			record.keyAdded(key);
		}
	}

	function keyIsOnlyPluralForPrimary(key: string, allPimaryKeys: string[], allTargetKeys: string[]) {
		if (pluralFormsMatch()) {
			return false;
		}

		return (
			keyMatchesPluralForLanguageIncludingSingular(key, allPimaryKeys, primaryLanguage) &&
			!keyMatchesPluralForLanguageIncludingSingular(key, allTargetKeys, targetLanguage)
		);
	}

	function pluralFormsMatch() {
		const primaryForms = Object.keys(getPluralsForLanguage(primaryLanguage));
		const targetForms = Object.keys(getPluralsForLanguage(targetLanguage));
		return (
			primaryForms.length === targetForms.length &&
			primaryForms.every(form => targetForms.indexOf(form) > -1)
		);
	}

	function keyMatchesPluralForLanguageIncludingSingular(key: string, allKeys: string[], language: string) {
		const matchesAPlural = keyMatchesPluralForLanguage(key, language);
		if (matchesAPlural) {
			return true;
		}

		//key is now a singular form
		if (!languageHasSingularForm(language)) {
			return false;
		}

		for (const _key of allKeys) {
			if (key !== _key && isPluralFormForSingular(_key, key, language)) {
				return true;
			}
		}

		return false;
	}

	function keyMatchesPluralForLanguage(key: string, language: string) {
		const forms = getPluralsForLanguage(language).map(form => form.replace('key', ''));

		for (const form of forms) {
			if (form && key.endsWith(form)) {
				return true;
			}
		}

		return false;
	}

	function isValidMappedPluralForm(key: string, sourceObject: Object, language = primaryLanguage) {
		const singular = getSingularForm(key);

		for (const key of Object.keys(sourceObject)) {
			if (isPluralFormForSingular(key, singular, language)) {
				return true;
			}
		}

		return false;
	}

	function getSingularForm(key: string) {
		return key.replace(/_(plural|\d)$/, '');
	}

	function isPluralFormForSingular(key: string, singular: string, language = primaryLanguage) {
		return getPluralsForLanguage(language)
			.map(form => form.replace('key', singular))
			.indexOf(key) > -1;
	}

	function languageHasSingularForm(language: string) {
		return getPluralsForLanguage(language)
			.map(form => form.replace('key', ''))
			.indexOf('') > -1;
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

	function createPlurals(key: string, fillValue: string) {
		const singular = getSingularForm(key);
		const plurals = {};
		for (const form of getPluralsForLanguage(targetLanguage)) {
			plurals[form.replace('key', singular)] = fillValue;
		}
		return plurals;
	}

	function removeKey(source: Object, target: Object, key: string) {
		if (isObject(target[key])) {
			gatherKeysFor(target[key]).forEach(k => record.keyRemoved(k));
		} else {
			record.keyRemoved(key);
		}

		//base case: key in target not found in source
		delete target[key];
	}

	function gatherKeysFor(object: Object) {
		return Object.keys(object)
			.map(key => gatherPrimitivesForSingleKey(object, key))
			.reduce((all, next) => all.concat(next), []);
	}

	function gatherPrimitivesForSingleKey(object: Object, key: string): string[] {
		if (isObject(object[key])) {
			return gatherKeysFor(object[key]);
		} else {
			return [key];
		}
	}
}

function isObject(value: any): value is { [key: string]: string } {
	return getTypeName(value) === 'Object';
}

function areSameTypes(value: any, otherValue: any) {
	return getTypeName(value) === getTypeName(otherValue);
}

function getTypeName(object: any) {
	const fullName: string = Object.prototype.toString.call(object);
	return fullName.split(' ')[1].slice(0, -1);
}