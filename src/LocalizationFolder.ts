import * as crypto from 'crypto';
import * as fs from 'fs-extra';
import * as path from 'path';
import { FileMap, LineEndings } from './';

const stringify = require('json-stable-stringify');

export default class LocalizationFolder {
	private readonly hashes: Record<string, string> = {};

	constructor(private baseDir: string, private files: FileMap, private isReportMode: boolean) {
		this.hashes = {};
	}

	public populateFromDisk() {
		Object.values(this.files).forEach(langValue => {
			Object.values(langValue).forEach(file => {
				const fileContent = fs.readFileSync(file.filepath, 'utf8');
				file.content = JSON.parse(fileContent);
				this.hashes[file.filepath] = crypto.createHash('md5').update(fileContent).digest('hex');
			});
		});
	}

	public generateMissingFiles(otherLanguages: string[], primaryLanguage: string) {
		const primaryNamespaces = this.files[primaryLanguage];

		Object.keys(primaryNamespaces).forEach(namespace => {
			otherLanguages.forEach(otherLanguage => {
				if (!this.files[otherLanguage]) {
					this.files[otherLanguage] = {};
				}

				if (!this.files[otherLanguage][namespace]) {
					const filepath = path.join(this.baseDir, otherLanguage.concat(namespace, '.json'));
					this.files[otherLanguage][namespace] = { filepath, content: {} };
					this.hashes[filepath] = '';
				}
			});
		});
	}

	public flushToDisk(
		jsonSpacing: string | number,
		lineEnding: LineEndings,
		addFinalNewline: boolean
	) {
		const changedFiles: string[] = [];

		Object.values(this.files).forEach(namespaces => {
			Object.values(namespaces).forEach(file => {
				let fileContent = stringify(file.content, { space: jsonSpacing });
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
				if (this.hashes[file.filepath] !== hash) {
					changedFiles.push(file.filepath);
				}

				if (!this.isReportMode) {
					fs.outputFileSync(file.filepath, fileContent, { encoding: 'utf8' });
				}

				this.hashes[file.filepath] = null;
				file.content = null;
			});
		});

		return changedFiles;
	}

	public getSourceNamespaces(lang: string) {
		return this.files[lang];
	}
}
