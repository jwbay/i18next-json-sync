import fs = require('fs');
import path = require('path');
import sh = require('shelljs');
const { process: compile } = require('./preprocessor');

const runnerPath = path.join(__dirname, 'runner.ts');
const runnerSource = fs.readFileSync(runnerPath, 'utf8');
const runnerJS = compile(runnerSource, runnerPath);

sh.config.silent = true;
sh.pushd('./tests');
sh.ls().forEach(testCase => {
	sh.pushd(testCase);
	sh.rm('-rf', 'actual');
	sh.cp('-Rf', 'project', 'actual');
	if (!fs.existsSync('actual')) {
		sh.mkdir('actual');
	}
	fs.writeFileSync('runner.js', runnerJS);
	sh.popd();
});
sh.popd();
