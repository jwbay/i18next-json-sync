export interface IOptions {
	/** If true, will audit files in memory instead of changing them on the filesystem */
	check?: boolean;
	/** Glob pattern for the resource JSON files */
	files?: string;
}

export default function sync({
	check = false,
	files = '**/locales/*.json'
}: IOptions) {

}
