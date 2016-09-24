import path = require('path');
import sh = require('shelljs');

const runnerPath = path.join(process.cwd(), 'testRunner.ts');
sh.config.silent = true;
sh.pushd('./test');
sh.ls().forEach(testCase => {
	sh.pushd(testCase);
	sh.rm('-rf', 'actual');
	sh.cp('-Rf', 'project', 'actual');
	sh.cp(runnerPath, process.cwd());
	sh.popd();
});
sh.popd();
