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
   app.get('/createAccount', (req, res) => {
     res.sendFile(path.join(__dirname,'static/createAccount.html'));
   })
   
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
   
      
      socket.on('round_button', (data) => {
           if (current_users.length == 0){
              data = { username: 'Default'};
           } else {
              var rand_index = Math.floor(Math.random()*current_users.length);
              data = { username: current_users[rand_index] };
           }
           speaker_str = data.username; //Update global current speaker
           io.sockets.emit('new_round', data); 
        /*var users = db.collection('users');
        //users.find({}).toArray((err, result) => {  
        //   if(err) throw err;
           if (result.length == 0){
              data = { username: 'Default'};
           } else {
              var rand_index = Math.floor(Math.random()*result.length);
              data = { username: result[rand_index]['username'] };
           }
           speaker_str = data.username; //Update global current speaker
           io.sockets.emit('new_round', data); 
       
        });
       */
      });
      //Handle comment submittions
      socket.on('comment_button', (data) => {
        var entry = {
                     'user': data.user, 
                     'comment' : data.comment
                    };
        var comments = db.collection('comments');
        comments.insert(entry, () => {
           io.sockets.emit('new_comment', data);
        });
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
              });
           }
           pagenumbers.insert(entry, find_and_emit_min);
         })
      ); 
   
      socket.on('pagenumber_reset_button', lock_w( (data) => {
          var pagenumbers = db.collection('pagenumbers');   
          //Delete all stored pagenumbers
          pagenumbers.remove({}, (err, obj) => {console.log('finished reset')});
         })
      ); 
      //Handle new logins
      socket.on('login', (data) => {
       
       var users = db.collection('users');
       users_cursor = users.find({'username': data.username, 
                                  'password': data.password});
       users_cursor.toArray((err, result) => { 
           if(result.length != 0){
              current_users.push(data.username);
              io.sockets.emit('new_user', data);
              socket.emit('login_success', data);
           }else{
              data.error = "Username or password incorrect";
              socket.emit('login_failure', data);
           }
       });
      });

      socket.on('signout', (data) => {
       var username_index = current_users.indexOf(data.username);
       if (!(username_index == -1)){
         current_users.splice(current_users.indexOf(data.username), 1); 
       } 
       socket.broadcast.emit('signout', data);

      });
   
      //Handle account creation
      socket.on('create_account', (data) => {
       var users = db.collection('users'); 
       var username = data.username;
       var password = data.password;
       var user =  users.find({'username': username}).limit(1).toArray();
       if(user.length == 0 || user === undefined){
         socket.emit('create_failure', {error: 'Username Taken'}); 
       }else{
         users.insert({'username': username, 'password': password}, () => {
            socket.emit('create_success', {username: data.username, error: null}); 
         });
       }
         
       
      });
   });
}
//Use io.sockets.emit to emit to all sockets






