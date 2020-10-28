import * as path from 'path';
import { DirectoryMap } from '../index';

function extractLanguagesFromPath(filepath: string, allLanguages: string[]) {
	return allLanguages.find(language => filepath.includes(language));
}

function extractNamespaceFromPath(filepath: string, language: string) {
	const filename = path.basename(filepath, '.json');
	if (filename === language) {
		return ''; // empty namespace
	}

	return filepath.substring(
		filepath.lastIndexOf(language) + language.length,
		filepath.length - '.json'.length
	);
}

function extractBaseDirectory(filepath: string, localesFolder: string): string {
	return filepath.substring(0, filepath.lastIndexOf(localesFolder) + localesFolder.length);
}

export function groupFilesByDirectory(
	allFiles: string[],
	allLanguages: string[],
	localesFolder: string
): DirectoryMap {
	return allFiles.reduce((directories, filepath) => {
		const language = extractLanguagesFromPath(filepath, allLanguages);

		if (!language) {
			return directories;
		}

		const namespace = extractNamespaceFromPath(filepath, language);
		const directory = extractBaseDirectory(filepath, localesFolder);

		directories[directory] = directories[directory] || {};
		directories[directory][language] = directories[directory][language] || {};
		directories[directory][language][namespace] = directories[directory][language][namespace] || {};

		directories[directory][language][namespace] = { filepath, content: null };

		return directories;
	}, {});
}
