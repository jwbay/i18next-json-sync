[![Build Status](https://travis-ci.org/jwbay/i18next-json-sync.svg?branch=master)](https://travis-ci.org/jwbay/i18next-json-sync)
[![codecov](https://codecov.io/gh/jwbay/i18next-json-sync/branch/master/graph/badge.svg)](https://codecov.io/gh/jwbay/i18next-json-sync)
[![npm](https://img.shields.io/npm/v/i18next-json-sync.svg)](https://www.npmjs.com/package/i18next-json-sync)
[![BADGINATOR](https://badginator.herokuapp.com/jwbay/i18next-json-sync.svg)](https://github.com/defunctzombie/badginator)
# i18next-json-sync

Keeps [i18next](https://github.com/i18next/i18next) JSON resource files in sync against a primary
language, including plural forms. When hooked up to a build process/CI server, ensures keys
added/removed from one language are correctly propagated to the other languages, reducing the chance
for missing or obselete keys, merge conflicts, and typos.

## Example
Given these files:
```
 locales
 ├── en.json
 ├── fr.json
 └── ru.json
```

```json
en.json
{
  "key_one": "value",
  "book": "book",
  "book_plural": "books"
}

fr.json
{
  "key_one": "french value"
}

ru.json
{
  "extra_key": "extra value"
}
```


`fr.json` and `ru.json` can be synced against `en.json`:

```js
import sync from 'i18next-json-sync'
sync({
  files: 'locales/*.json',
  primary: 'en'
});
```

(or via CLI: `sync-i18n --files locales/*.json --primary en`)

resulting in:

```json
en.json
{
  "key_one": "value",
  "book": "book",
  "book_plural": "books"
}

fr.json
{
  "key_one": "french value",
  "book": "book",
  "book_plural": "books"
}

ru.json
{
  "key_one": "value",
  "book_0": "books",
  "book_1": "books",
  "book_2": "books"
}
```

`key_one` was left alone in fr.json since it's already localized, but `book` and `book_plural` were copied over.
An extraneous key in ru.json was deleted and keys from en.json copied over. Plurals are mapped between
languages according to the [i18next suffix rules](http://i18next.com/docs/plurals/).

This works on one folder at a time, but can deal with whatever the files glob returns. Files are
grouped into directories before processing starts. Folders without a 'primary' found are ignored.

## Node.js Usage

`$ npm install i18next-json-sync --save-dev`

```js
import sync from 'i18next-json-sync';
//or in ES5 world:
//const sync = require('i18next-json-sync').default;

//defaults are inline:
sync({
  /** Audit files in memory instead of changing them on the filesystem and
    * throw an error if any changes would be made */
  check: false,
  /** Glob pattern for the resource JSON files */
  files: '**/locales/*.json',
  /** Primary localization language. Other language files will be changed to match */
  primary: 'en',
  /** Language files to create if they don't exist, e.g. ['es, 'pt-BR', 'fr'] */
  createResources: [],
  /** Space value used for JSON.stringify */
  space: 4
})
```

## CLI Usage

It can be installed globally, but npm's [package.json scripts](https://docs.npmjs.com/misc/scripts) are a better fit.

```json
{
  "name": "foo",
  "scripts": {
    "i18n": "sync-i18n --files **/locales/*.json --primary en --languages es fr ja zh ko --space 2",
    "check-i18n": "npm run i18n -- --check"
  },
  "devDependencies": {
    "i18next-json-sync" : "^1.0.0"
  }
}
```

Then use `npm run i18n` to sync on the filesystem and `npm run check-i18n` to validate.

Use `sync-i18n -h` to get help output:

```
Options:
  -c, --check      Audit files in memory instead of changing them on the
                   filesystem and throw an error if any changes would be made
                                                                       [boolean]
  -f, --files      Glob pattern for the resource JSON files
  -p, --primary    Primary localization language. Other language files will be
                   changed to match
  -l, --languages  Language files to create if they don't exist          [array]
  -s, --space      Space value used for JSON.stringify
  -h, --help       Show help                                           [boolean]

Examples:
  --files      **/locales/*.json
  --languages  es fr pt-BR ja
```

## License

[MIT](LICENSE)