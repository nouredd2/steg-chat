/** 
 first start by setting up the http server 
 that must handle the set up of the connection 
 between the peers. This guys should be run on 
 one of the machines or on a separate one
 Note that this will run on port 2013
 */
var static = require('node-static');
var http = require('http');
var file = new(static.server);
var host = 'localhost'; // for running on the server this should be 130.126.136.114
var app = http.createServer(function (req, res) {
	file.serve(req, res);
}).listen(2013, host);

/**
 Here we start using the socket.io API to 
 handle the incoming requests and serve them
 */
// this ish the io socket tied to the http server
var io = require('socket.io').listen(app);
io.sockets.on('connection', function(socket) {

	// this is just the logging function
	function log() {
		var array = [">>> Message from server: "];
		for (var i = 0; i < arguments. length; i++) {
			array.push(arguments[i]);
		}
		socket.emit('log', array);
	}

	// function handler when receiving a connection request
	// room is the chat room to be established or joined
	socket.on('message', function(room) {
		log ('Got message: ', message);
		// broadcast the message
		socket.broadcast.emit('message', message);
	});

	// function handle when receiving a creation of a room
	// or joining it
	socket.on('create or join', function(room) {
		// get the number of connected clients (in the room)
		var numClients = io.sockets.clients(room).length;

		log ('Room ' + room + ' has ' + numClients + ' client(s)');
		log ('Request to create or join room ', room);

		if (numClients == 0) {
			// empty room, create it!
			socket.join(room);
			socket.emit('created', room);
		} else if (numClients == 1) {
			// someone else is already there
			io.socket.in(room).emit('join', room);
			socket.join(room);
			socket.emit('joined', room);
		} else {
			// full room, max is 2 clients 
			socket.emit('full', room);
		}

		// just being verbose, not really needed
		socket.emit('emit(): client ' + socket.id + ' joined room ' + room);
		socket.broadcast.emit('broadcast(): client ' + socket.id + ' joined room ' + room);
	});
});