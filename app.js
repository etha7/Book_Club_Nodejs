//Server Code
const port = process.env.PORT || 3000;
const hostname = 'localhost';
const express = require('express');
var app = express();
var path = require('path');
const favicon = require('serve-favicon');

app.use(favicon(path.join(__dirname,'static','images','favicon.ico')));
app.use(express.static(__dirname +'/static'));
app.set('views', path.join(__dirname, 'views'));

//Handle MongoDB
var db;
var db_str = 'bookclub';
const MongoClient = require('mongodb').MongoClient
const mongo_uri = 'mongodb://admin:admin@ds014648.mlab.com:14648/'+db_str;
//MongoClient.connect('mongodb://localhost:27018/bookClub', (err,client) => {
MongoClient.connect(mongo_uri, (err,client) => {
  if(!err){
    console.log("Connected to MongoDB");
    db = client.db(db_str);//
    run_app();
  }else{
    console.log(err);
  }
});

function run_app(){
   //Handle GETS
   app.get('/', (req, res) => {
     res.sendFile(path.join(__dirname,'static/index.html'));
   });
   
   app.get('/about', (req, res) => {
     res.send('\n\nI made this for our book club!\n\n');
   
   });
   
   //Start socket.io server
   var server = app.listen(port, () => {
     console.log('Server running at http://'+hostname+':'+port+'/');
   });
   const io = require('socket.io')(server);
   
   
   //TEMP DATA
   var speaker_str = "Default"; //Stores current speaker
   var current_users = [];
   var pagenumber_semaphore = { num_procs: 0 };  
   function acquire_lock() {
      while(pagenumber_semaphore.num_procs != 0){
      }
      pagenumber_semaphore.num_procs -= 1;
   }
   function release_lock(){
      pagenumber_semaphore.num_procs += 1;
   }
   //Locking wrapper function
   function lock_w(f){
     var wrapped = (data) => {
       acquire_lock();
       f(data);
       release_lock();
    };
    return wrapped;
   }

   //Handle server/client events:
   io.on('connection', function(socket) {
   
      //Initiate a new connection
      console.log("New Connection");
      var welcome_str = 'Welcome!';
      //Send welcome, speaker, and all saved comments from MongoDB database;
      var comments = db.collection('comments');
      comments.find({}).toArray((err, result) => {
         if(err) throw err;
         socket.emit('init', { 
                               welcome: welcome_str, 
                               comments: result, 
                               speaker: speaker_str, 
                               users: current_users
                             });
      });
   
      socket.on('username_button', (data) => {
        var entry = {
                      'username': data.username
                    }
        var users = db.collection('users');
        users.insert(entry); 
      });
      
      socket.on('round_button', (data) => {
        var users = db.collection('users');
        users.find({}).toArray((err, result) => {  
           if(err) throw err;
           if (result.length == 0){
              data = { user: 'Default'};
           } else {
              var rand_index = Math.floor(Math.random()*result.length);
              data = { user: result[rand_index]['username'] };
           }
           speaker_str = data.user; //Update global current speaker
           io.sockets.emit('new_round', data); 
        });
      });
      //Handle comment submittions
      socket.on('comment_button', (data) => {
        var entry = {
                     'user': data.user, 
                     'comment' : data.comment
                    };
        var comments = db.collection('comments');
        comments.insert(entry);
        io.sockets.emit('new_comment', data);
      });
   
      //Initliaze pagenumber
      var init_pagenumber = (data) => {
         var pagenumbers = db.collection('pagenumbers'); 

         //Find and send min page number
         pagenumbers.find({}).sort({'pagenumber': 1}).limit(1).toArray((err, result)=> {
               if(err) throw err;
               if (result.length == 0) {
                  data = { pagenumber: 0 }; 
               }
               else {
                  data = { pagenumber: result[0]['pagenumber'] };
               }
               io.sockets.emit('new_lowest_pagenumber', data);
         });
      };
      lock_w(init_pagenumber)();
     
      //Handle pagenumber submittions
      socket.on('pagenumber_button', lock_w((data) => {
           //BROKEN BECAUSE pagenumber_button events are affecting each other
           console.log('pagenumber:');
           console.log(data.pagenumber);
           var pagenumbers = db.collection('pagenumbers');
           var pagenumber = data.pagenumber;
           var entry = { 
                        'pagenumber': pagenumber
                       };
           var find_and_emit_min = () => { 
              pagenumbers.find({}).sort({'pagenumber': 1}).limit(1).toArray((err, result)=> { 
                 var new_min = result[0]['pagenumber']; 
                 if(pagenumber <= new_min){
                    io.sockets.emit('new_lowest_pagenumber', data);
                 }
                 console.log('finished '+data.pagenumber);
              });
           }
           pagenumbers.insert(entry, find_and_emit_min);
         })
      ); 
   
      socket.on('pagenumber_reset_button', lock_w( (data) => {
          console.log('reset');
          var pagenumbers = db.collection('pagenumbers');   
          //Delete all stored pagenumbers
          pagenumbers.remove({}, (err, obj) => {console.log('finished reset')});
         })
      ); 
      //Handle new logins
      socket.on('login', (data) => {
       current_users.push(data.user);
       io.sockets.emit('new_user', data);
      });
      socket.on('signout', (data) => {
       current_users.splice(current_users.indexOf(data.user), 1);
       io.sockets.emit('signout', data);
      });
   });
}
//Use io.sockets.emit to emit to all sockets






