const PythonShell = require('python-shell');
const pyshell = new PythonShell('./nodepy.py', {mode:'text'});

pyshell.on('message', (msg)=>{
   console.log(msg);
});




PythonShell.run('./nodepy.py', (err)=>{
	console.log("About to process script call")
	if (err) throw err;
	// for(let i =0; i<10; ++i){
	// 	pyshell.send('hello');
	// }
	
	pyshell.send('exasdgsgdit');
	pyshell.send('exit');
});


