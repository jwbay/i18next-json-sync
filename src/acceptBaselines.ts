import sh = require('shelljs');

sh.config.silent = true;
sh.cd('./test');

sh.ls().forEach(testCase => {
	sh.pushd(testCase);
	sh.rm('-rf', 'expected');
	sh.cp('-Rf', 'actual', 'expected');
	sh.popd();
});