export default class ActionRecorder {
	private errors: string[] = [];
	private addedKeys: string[] = [];
	private removedKeys: string[] = [];
	private fileName: string;
	private isReportMode: boolean;

	constructor(
		fileName: string,
		isReportMode: boolean
	) {
		this.fileName = fileName;
		this.isReportMode = isReportMode;
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

	public hasAnyActions() {
		return this.hasAnyErrors() ||
			this.addedKeys.length > 0 ||
			this.removedKeys.length > 0;
	}

	public flushToConsole() {
		const errors = this.getErrors();
		const added = this.getMessageForAddedKeys();
		const removed = this.getMessageForRemovedKeys();

		errors && console.error(errors);
		added && console.log(added);
		removed && console.log(removed);
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
			const prefix = this.isReportMode ? 'Missing keys in' : 'Pushed keys to';
			return `${prefix} ${this.fileName}: ${this.addedKeys.join(', ')}`;
		}
		return null;
	}

	private getMessageForRemovedKeys() {
		if (this.removedKeys.length > 0) {
			const prefix = this.isReportMode ? 'Orphaned keys found in' : 'Removed keys from';
			return `${prefix} ${this.fileName}: ${this.removedKeys.join(', ')}`;
		}
		return null;
	}
}
