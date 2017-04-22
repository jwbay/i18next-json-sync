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
	lineEndings?: lineEndings;
	/** Insert a final newline when writing JSON files to disk */
	finalNewline?: boolean;
}

export interface IDirectoryMap { [directory: string]: IFileMap; }
export interface IFileMap { [filename: string]: Object; }
export type lineEndings = 'LF' | 'CRLF';
type localizationValue = { [key: string]: string } | string;

export default function sync({
	check: isReportMode = false,
	files = '**/locales/*.json',
	primary: primaryLanguage = 'en',
	createResources: createFiles = [],
	space: jsonSpacing = 4,
	lineEndings = 'LF',
	finalNewline = false
}: IOptions) {
	const allFiles = glob.sync(files);
	const directories = groupFilesByDirectory(allFiles);
	let targetLanguage: string;
	let record: ActionRecorder;
	let hasAnyErrors = false;
	let hasAnyChanges = false;
	let hasValueChanges = false;
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
			hasValueChanges = hasValueChanges || record.hasAnyActions();
			hasAnyErrors = hasAnyErrors || record.hasAnyErrors();
		}

		const changedFiles = folder.flushToDisk(jsonSpacing, lineEndings.toUpperCase() as lineEndings, finalNewline);
		hasAnyChanges = hasAnyChanges || changedFiles.length > 0;
	}

	if (hasAnyErrors) {
		throw new Error('[i18next-json-sync] found keys unsafe to synchronize');
	}

	if (isReportMode) {
		if (hasValueChanges) {
			throw new Error('[i18next-json-sync] check failed -- keys are out of sync. Run again without check mode to synchronize files');
		}
		if (hasAnyChanges) {
			throw new Error('[i18next-json-sync] check failed -- files have unordered keys or unexpected whitespace. Run again without check mode to correct files');
		}
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
				// we should remove book_plural, book_1, etc if the language doesn't support singular forms
				if (keyIsOnlyPluralForPrimary(key, Object.keys(source), Object.keys(target))) {
					removeKey(source, target, key);
				}
			} else if (!isValidMappedPluralForm(key, source, target)) { // don't remove valid mappings from book_plural to book_0
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
					mergeKeys(createPlurals(key, source), target);
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
			//do we need to transform plurals from e.g. x_plural to x_0?
			keyMatchesPluralForLanguageIncludingSingular(key, Object.keys(source), primaryLanguage) &&
			!keyMatchesPluralForLanguage(key, targetLanguage) &&
			!pluralFormsMatch()
		) {
			copyPlurals(createPlurals(key, source), target);
		} else {
			//base case: source contains key not present in target
			target[key] = sourceValue;
			record.keyAdded(key);
		}
	}

	function copyPlurals(plurals: Object, target: Object) {
		for (const key of Object.keys(plurals)) {
			if (target.hasOwnProperty(key)) {
				continue;
			}

			target[key] = plurals[key];
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
		/**
		 * It's impossible to tell whether a key is a plural for a language with one form shared between singular and plurals.
		 * With other languages we can look for relationships between e.g. value and value_plural or value and value_0. 
		 */

		if (languageOnlyHasOneForm(language)) {
			return true;
		}

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

	function isValidMappedPluralForm(key: string, sourceObject: Object, targetObject: Object) {
		const singular = getSingularForm(key);
		const isPluralForPrimaryLanguage = Object.keys(sourceObject).some(key => isPluralFormForSingular(key, singular, primaryLanguage));

		if (languageOnlyHasOneForm(targetLanguage)) {
			return singular === key && isPluralForPrimaryLanguage;
		}

		const isPluralForTargetLanguage = Object.keys(targetObject).some(key => isPluralFormForSingular(key, singular, targetLanguage));
		return isPluralForPrimaryLanguage && isPluralForTargetLanguage;
	}

	function getSingularForm(key: string) {
		return key.replace(/_(plural|\d)$/, '');
	}

	function isPluralFormForSingular(key: string, singular: string, language: string) {
		return getPluralsForLanguage(language)
			.map(form => form.replace('key', singular))
			.indexOf(key) > -1;
	}

	function languageHasSingularForm(language: string) {
		return getPluralsForLanguage(language)
			.map(form => form.replace('key', ''))
			.indexOf('') > -1;
	}

	function languageOnlyHasOneForm(language: string) {
		return getPluralsForLanguage(language).length === 1;
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

	function createPlurals(key: string, source: Object) {
		const singular = getSingularForm(key);
		const fillValue = getPluralFillValue(singular, source);
		const plurals = {};
		for (const form of getPluralsForLanguage(targetLanguage)) {
			plurals[form.replace('key', singular)] = fillValue;
		}
		return plurals;
	}

	function getPluralFillValue(singular: string, source: Object) {
		if (languageOnlyHasOneForm(primaryLanguage)) {
			return source[singular];
		}

		//prefer plural fill values because they're more likely to have
		//interpolations like {{ count }}, but fall back to singular
		const sourceKeys = Object.keys(source).filter(k => k !== singular);
		for (const form of getPluralsForLanguage(primaryLanguage)) {
			const pluralKey = form.replace('key', singular);
			if (sourceKeys.indexOf(pluralKey) > -1) {
				return source[pluralKey];
			}
		}

		return source[singular];
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