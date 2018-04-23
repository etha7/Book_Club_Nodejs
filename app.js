//Server Code
const express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
server.listen(80);
const hostname = '127.0.0.1';
const port = 3000;
var path = require('path');
app.use(express.static(__dirname +'/static'));
app.set('views', path.join(__dirname, 'views'));

//Handle MongoDB

var db;
const MongoClient = require('mongodb').MongoClient
MongoClient.connect('mongodb://localhost:27018/bookClub', (err,client) => {
  if(!err){
    console.log("Connected to MongoDB");
    db = client.db('bookClub');
  }else{
    console.log(err);
  }
});



//Handle GETS
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname,'static/index.html'));
});

app.get('/about', (req, res) => {
  res.send('\n\nI made this for our book club!\n\n');

});



//Handle server/client events:
io.on('connection', function(socket) {

   //Initiate a new connection
   console.log("New Connection");
   var welcome_str = 'Welcome! You\'ve connected to the server.';
   //Send welcome, and all saved comments from MongoDB database;
   
   var comments = db.collection('comments');
   comments.find({}).toArray((err, result) => {
      if(err) throw err;
      console.log(result);         
      socket.emit('init', {welcome: welcome_str, comments: result});
   });
   

   //Handle pagenumber submittions
   socket.on('pagenumber_button', (data) => {
     var pagenumber = data.pagenumber;
     console.log(pagenumber);
   });
   
   //Handle pagenumber submittions
   socket.on('comment_button', (data) => {
     var entry = {
                  'user': data.user, 
                  'comment' : data.comment
                 };
     console.log(entry);
     var comments = db.collection('comments');
     comments.insert(entry);
     io.sockets.emit('new_comment', data);
   });
   
});
//Use io.sockets.emit to emit to all sockets





app.listen(port, hostname, () => {
  console.log('Server running at http://'+hostname+':'+port+'/');
});



