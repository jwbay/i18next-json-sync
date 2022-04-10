jest.mock('./');
import type { Options } from '.';
let sync: jest.MockInstance<any, any>;

beforeEach(() => {
	jest.resetModules();
	sync = require('./index').default;
});

test('kitchen sink', () => {
	callWithFlags(`--check --files '**/locales/*.json' --excludefiles '**/pattern1' 'other/*/pattern' --primary en --languages es fr pt-BR ja --space \t --lineendings LF --finalnewline --newkeysempty`);
	expect(getParams()).toMatchInlineSnapshot(`
Object {
  "check": true,
  "createResources": Array [
    "es",
    "fr",
    "pt-BR",
    "ja",
  ],
  "excludeFiles": Array [
    "'**/pattern1'",
    "'other/*/pattern'",
  ],
  "files": "'**/locales/*.json'",
  "finalNewline": true,
  "lineEndings": "LF",
  "newKeysEmpty": true,
  "primary": "en",
  "space": "	",
}
`);
});

test('kitchen sink shorthand aliases', () => {
	callWithFlags(`-c -f '**/locales/*.json' --ef '**/pattern1' 'other/*/pattern' -p en -l es fr pt-BR ja -s \t --le LF --fn -e`);
	expect(getParams()).toMatchInlineSnapshot(`
Object {
  "check": true,
  "createResources": Array [
    "es",
    "fr",
    "pt-BR",
    "ja",
  ],
  "excludeFiles": Array [
    "'**/pattern1'",
    "'other/*/pattern'",
  ],
  "files": "'**/locales/*.json'",
  "finalNewline": true,
  "lineEndings": "LF",
  "newKeysEmpty": true,
  "primary": "en",
  "space": "	",
}
`);
});

test('no flags passed', () => {
	callWithFlags('');
	expect(getParams()).toMatchInlineSnapshot(`
Object {
  "check": false,
  "createResources": undefined,
  "excludeFiles": Array [
    "**/node_modules/**",
  ],
  "files": undefined,
  "finalNewline": false,
  "lineEndings": undefined,
  "newKeysEmpty": false,
  "primary": undefined,
  "space": undefined,
}
`);
});

test('single language', () => {
	callWithFlags('--languages fr');
	expect(getParams('createResources')).toEqual(['fr']);
});

test('single files exclusion', () => {
	callWithFlags('--excludefiles "my/**/pattern"');
	expect(getParams('excludeFiles')).toEqual(['"my/**/pattern"']);
});

test('glob pattern double quotes', () => {
	callWithFlags('--files "**/locales/*.json"');
	expect(getParams('files')).toEqual('"**/locales/*.json"');
});

function callWithFlags(argv: string) {
	process.argv = `node ./someScript.js ${argv}`.split(' ');
	require('./cli');
}

function getParams(key?: keyof Options) {
	const params = sync.mock.calls[0][0];
	if (key) {
		return params[key];
	}

	return params;
}
