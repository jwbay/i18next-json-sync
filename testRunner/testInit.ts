import fs = require('fs');
import path = require('path');
import sh = require('shelljs');
const { process: compile } = require('./testPreprocessor');

const runnerPath = path.join(__dirname, 'testRunner.ts');
const runnerSource = fs.readFileSync(runnerPath, 'utf8');
const runnerJS = compile(runnerSource, runnerPath);

sh.config.silent = true;
sh.pushd('./tests');
sh.ls().forEach(testCase => {
	sh.pushd(testCase);
	sh.rm('-rf', 'actual');
	sh.cp('-Rf', 'project', 'actual');
	fs.writeFileSync('testRunner.js', runnerJS);
	sh.popd();
});
sh.popd();
