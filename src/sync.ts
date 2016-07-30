export interface IOptions {
	/** If true, will audit files in memory instead of changing them on the filesystem */
	check?: boolean;
	/** Glob pattern for the resource JSON files */
	files?: string;
	/** Primary localization language. Other language files will be changed to match */
	primary?: string;
}

export default function sync({
	check = false,
	files = '**/locales/*.json',
	primary = 'en'
}: IOptions) {

}
