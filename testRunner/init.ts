import * as fs from 'fs';
import * as path from 'path';
import * as sh from 'shelljs';
import * as ts from 'typescript';

const runnerPath = path.join(__dirname, 'runner.ts');
const runnerSource = fs.readFileSync(runnerPath, 'utf8');
const { compilerOptions } = require('./tsconfig.json');
const runnerJS = ts.transpileModule(runnerSource, { compilerOptions }).outputText;

sh.config.silent = true;
sh.pushd('./tests');
sh.ls().forEach(testCase => {
	sh.pushd(testCase);
	sh.rm('-rf', 'actual');
	sh.cp('-Rf', 'project', 'actual');
	sh.mkdir('actual');
	fs.writeFileSync('runner.js', runnerJS);
	sh.popd();
});
sh.popd();
