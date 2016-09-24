export default class ActionRecorder {
	private errors: string[] = [];
	private addedKeys: string[] = [];
	private removedKeys: string[] = [];

	constructor(
		private fileName: string,
		private isReportMode: boolean
	) { }

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