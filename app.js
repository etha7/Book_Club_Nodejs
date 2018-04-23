var express = require('express');

const hostname = '127.0.0.1';
const port = 3000;
var app = express();


app.get('/', (req, res) => {
  res.send(' \n\nHello, world!\n\n');
});

app.get('/about', (req, res) => {
  res.send('\n\nI made this for our book club!\n\n');
});

app.set('views', path.join(__dirname, 'views'));




app.listen(port, hostname, () => {
  console.log('Server running at http://'+hostname+':'+port+'/');
});



