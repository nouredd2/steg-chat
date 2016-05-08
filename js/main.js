/** This is the main javascript file 
 This is where our modification should take place 
 This code will run on both ends of the communicating 
 parties.
 */
'use strict';

var isChannelReady;
var isInitiator = false;
var isStarted = false;
var localStream;
var remoteStream;
var pc;
var turnReady;

// data points for graph 
var dps = []
var start_time;
var end_time;
var time_in_mills;
var x_point = 0.0;

// no idea what these things are yet! need to figure this out
var pc_config = { 'iceServers': [{'url': 'stun:stun.l.google.com:19302'}]};
var pc_constraints =  {'optional': [{'DtlsSrtpKeyAgreement': true}]};

// this sets up audio and video 
var sdpConstraints = {'mandatory': {
  'OfferToReceiveAudio':true,
  'OfferToReceiveVideo':true }};

/* --------------------------------------------------------------------------- */
// This is the sockets.io code that will run on the clients 

// get the room name or assign it, leaving it to webchat by default
var room = 'webchat';


var socket = io.connect();

// join or create a room, this basically signals the server to create
// the room for the client or to join it if its already there. The
// server is the one that does the checking 
if (room !== '') {
	console.log ('Create or join room', room);
	// socket.emit will send create or join to the server 
	// so that the server will run the appropriate handler
	socket.emit('create or join', room);
}

// one receiving created from the server on the socket
socket.on('created', function(room) {
	console.log ('Created room' + room);
	// the current client is the initiator of the room
	isInitiator = true;
});

// room is full, message form the server
socket.on('full', function(room) {
	console.log ('Room ' + room + ' is full' );
});

socket.on('join', function(room) {
	console.log('Another peer made a request to join the room ' + room);
	console.log('I am the initiator of the room ' + room);
	// mark the channel ready since now we have two peers there
	isChannelReady = true;
});

socket.on('joined', function(room) {
	console.log('I joined the already existing room ' + room);
	// also mark the channel ready because we now have two peers there
	isChannelReady = true;
});

socket.on('log', function(array) {
	console.log.apply(console, array);
});

/* --------------------------------------------------------------------------- */
// Connection setup code from codelab 

function sendMessage(message) {
	console.log('Client sending message ', message);
	// send the server a message to launch the on message handler
	socket.emit('message', message);
}

// on message form the server handler
socket.on('message', function (message) {
	console.log('Client received message:', message);
	if (message === 'got user media') {
		maybeStart();
	} else if (message.type === 'offer') {
		if (!isInitiator && !isStarted) {
			maybeStart();
		}
		pc.setRemoteDescription(new RTCSessionDescription(message));
		doAnswer();
	} else if (message.type === 'answer' && isStarted) {
		pc.setRemoteDescription(new RTCSessionDescription(message));
	} else if (message.type === 'candidate' && isStarted) {
		var candidate = new RTCIceCandidate({
			sdpMLineIndex: message.label,
			candidate: message.candidate
		});
		pc.addIceCandidate(candidate);
	} else if (message.type === 'bye' && isStarted) {
		// when the other side hung up the conversation
		handleRemoteHangup();
	}
});

/* --------------------------------------------------------------------------- */
// seriously stuff to test out the canvas

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');

/* --------------------------------------------------------------------------- */
// this is basically the place where we get the stream from the user and 
// set up handling the messages


// got the local user media from the camera and microphone
// this function contains our actual stream that we are getting 
// from the camera, so basically this is the stream that we 
// want to modify and inject our data in 
function handleUserMedia(stream) {
	console.log('Adding local stream');
	localVideo.src = window.URL.createObjectURL(stream);
	localStream = stream;
	// this basically send get user media in a message to the server
	// the server will then broadcast the message back to the other 
	// guys in the room
	sendMessage('got user media');
	if (isInitiator) {
		maybeStart();
		//seriously.go();
	}
}

function handleUserMediaError(error) {
	console.log('getUserMedia error:', error);
}

// this is that get the user media and the handlers, basically 
// here is where we get the video form the user camera
var constraints = {'video': true};
getUserMedia(constraints, handleUserMedia, handleUserMediaError);

function dumpStats(o) {
  var s = "";
  if (o.mozAvSyncDelay !== undefined || o.mozJitterBufferDelay !== undefined) {
    if (o.mozAvSyncDelay !== undefined) s += "A/V sync: " + o.mozAvSyncDelay + " ms";
    if (o.mozJitterBufferDelay !== undefined) {
      s += " Jitter buffer delay: " + o.mozJitterBufferDelay + " ms";
    }
    s += "<br>";
  }
  s += "Timestamp: "+ new Date(o.timestamp).toTimeString() +" Type: "+ o.type +"<br>";
  if (o.ssrc !== undefined) s += "SSRC: " + o.ssrc + " ";
  if (o.packetsReceived !== undefined) {
    s += "Recvd: " + o.packetsReceived + " packets";
    if (o.bytesReceived !== undefined) {
      s += " ("+ (o.bytesReceived/1024000).toFixed(2) +" MB)";
    }
    if (o.packetsLost !== undefined) s += " Lost: "+ o.packetsLost;
  } else if (o.packetsSent !== undefined) {
    s += "Sent: " + o.packetsSent + " packets";
    if (o.bytesSent !== undefined) s += " ("+ (o.bytesSent/1024000).toFixed(2) +" MB)";
  } else {
    s += "<br><br>";
  }
  s += "<br>";
  if (o.bitrateMean !== undefined) {
    s += " Avg. bitrate: "+ (o.bitrateMean/1000000).toFixed(2) +" Mbps";
    if (o.bitrateStdDev !== undefined) {
      s += " ("+ (o.bitrateStdDev/1000000).toFixed(2) +" StdDev)";
    }
    if (o.discardedPackets !== undefined) {
      s += " Discarded packts: "+ o.discardedPackets;
    }
  }
  s += "<br>";
  if (o.framerateMean !== undefined) {
    s += " Avg. framerate: "+ (o.framerateMean).toFixed(2) +" fps";
    if (o.framerateStdDev !== undefined) {
      s += " ("+ o.framerateStdDev.toFixed(2) +" StdDev)";
    }
  }
  if (o.droppedFrames !== undefined) s += " Dropped frames: "+ o.droppedFrames;
  if (o.jitter !== undefined) {
  	s += " Jitter: "+ o.jitter;
  	end_time = new Date();
  	time_in_mills = (end_time - start_time)/1000.0;
  	start_time = end_time;
  	x_point = x_point + time_in_mills;
  	dps.push({
  		x: x_point,
  		y: o.jitter
  	});
  	addRow(x_point, o.jitter);
  }
  return s;
}

function addRow(x, y) {
	var table = document.getElementById('jittertable');
	var rowCount = table.rows.length;
	var row = table.insertRow(rowCount);

	row.insertCell(0).innerHTML = x.toString();
	row.insertCell(1).innerHTML = y.toString();
}


console.log('Getting user media with constraints', constraints);

// this is suspicious, must make sure what this thing is doing 
// if (location.hostname != 'localhost') {
	// requestTurn('https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913');
// }

function maybeStart() {
	if (!isStarted && typeof localStream != 'undefined'  && isChannelReady) {
		createPeerConnection();
		pc.addStream(localStream);
		isStarted = true;
		// basically the initiator of the room is the one that 
		// starts the call 
		if (isInitiator) {
			doCall();
		}

		repeat(100, () => Promise.all([pc.getStats(null)])
			.then(ses => {
				var s1 = ses[0];
				var s = "";
				Object.keys(s1).some(key => {
					if (s1[key].type != "outboundrtp" || s1[key].isRemote) 
						return false;
					s += "<h4>Sender side</h4>" + dumpStats(s1[key]); 
					return true;
				});
      			Object.keys(s1).some(key => {
      			  	if (s1[key].type != "inboundrtp" || s1[key].isRemote) 
      			  		return false;
      		   		s += "<h4>Receiver side</h4>" + dumpStats(s1[key]); 
      		   		return true;
      		 	});
      		update(statsdiv, "<small>"+ s +"</small>");
      	}))
	}
}

// when exiting send the server a bye message so that the 
// server can broadcast the message back to the other client 
window.onbeforeunload = function(e) {
	sendMessage('bye');
	file.end();
}

// UPDATED: For making jitter and other stuff plots 
window.onload = function(){
	var chart = new CanvasJS.Chart("chartContainer",{
		// title :{
		// 	text: "Live Random Data"
		// },			
		data: [{
			type: "line",
			dataPoints: dps 
		}]
	});

	var updateInterval = 100;
	var dataLength = 100; // number of dataPoints visible at any point

	start_time = new Date()
	var updateChart = function (count) {
		if (dps.length > dataLength)
		{
			dps.shift();				
		}
		
		chart.render();		

	};

	// generates first set of dataPoints
	// updateChart(dataLength); 

	// update chart after specified time. 
	setInterval(function(){updateChart()}, updateInterval); 
};

/* --------------------------------------------------------------------------- */
// Peer connection set up and other Peer Connection stuff!

// basically this is where the peer connection is set up and 
// the specific handlers are being handled
function createPeerConnection() {
	try {
		pc = new RTCPeerConnection(null);
		pc.onicecandidate = handleIceCandidate;
		pc.onaddstream = handleRemoteStreamAdded;
		pc.onremovestream = handleRemoteStreamRemoved;
		console.log('Created RTCPeerConnnection');
	} catch(e) {
		console.log('Failed to create PeerConnection, exception: ' + e.message);
		alert('Cannot create RTCPeerConnection object.');
		return;
	}
}

function handleIceCandidate(event) {
	console.log('handleIceCandidate event: ', event);
	if (event.candidate) {
		// send a message that contains an object with the 
		// different parameters of the ice candidate
		sendMessage({
			type: 'candidate',
			label: event.candidate.sdpMLineIndex,
			id: event.candidate.sdpMid,
			candidate: event.candidate.candidate
		});
	} else {
		console.log('End of candidates');
	}
}

function handleCreateOfferError(event) {
	console.log('createOffer() error: ', e);
}

// basically send an offer to the other peer
function doCall() {
	console.log('Sending offer to peer');
	pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
	console.log('Sending answer to peer.');
	pc.createAnswer(setLocalAndSendMessage, handleCreateAnswerError, sdpConstraints);
}

// this is needed because firefox does not take null 
// as an error handler while chrome does!
function handleCreateAnswerError(event) {
	console.log('createAnswer() error: ', e);
}

function setLocalAndSendMessage(sessionDescription) {
	// Set Opus as the preferred codec in SDP if Opus is present.
	sessionDescription.sdp = preferOpus(sessionDescription.sdp);
	pc.setLocalDescription(sessionDescription);
	console.log('setLocalAndSendMessage sending message' , sessionDescription);
	sendMessage(sessionDescription);
}

// No Idea what this fucntion does!
function requestTurn(turn_url) {
	var turnExists = false;
	for (var i in pc_config.iceServers) {
		if (pc_config.iceServers[i].url.substr(0, 5) === 'turn:') {
			turnExists = true;
			turnReady = true;
			break;
		}
	}
	if (!turnExists) {
		console.log('Getting TURN server from ', turn_url);
    	// No TURN server. Get one from computeengineondemand.appspot.com:
    	var xhr = new XMLHttpRequest();
    	xhr.onreadystatechange = function(){
    		if (xhr.readyState === 4 && xhr.status === 200) {
    			var turnServer = JSON.parse(xhr.responseText);
    			console.log('Got TURN server: ', turnServer);
    			pc_config.iceServers.push({
    				'url': 'turn:' + turnServer.username + '@' + turnServer.turn,
    				'credential': turnServer.password
    			});
    			turnReady = true;
    		}
    	};
    	xhr.open('GET', turn_url, true);
    	xhr.send();
	}
}


// this is basically where we are getting the remote stream 
// so basically this is where we get the stream containing 
// our modified injected data
function handleRemoteStreamAdded(event) {
	console.log('Remote stream added.');
	remoteVideo.src = window.URL.createObjectURL(event.stream);
	remoteStream = event.stream;
}

function handleRemoteStreamRemoved(event) {
	console.log('Remote stream removed. Event: ', event);
}

function hangup() {
	console.log('Hanging up.');
	stop();
	sendMessage('bye');
}

function handleRemoteHangup() {
	console.log('Session terminated.');
  // stop();
  // isInitiator = false;
}

function stop() {
	isStarted = false;
	pc.close();
	pc = null;
}

/* --------------------------------------------------------------------------- */
// Code from google codelab simply to chose audio and video codes, I don't think 
// there is much for us to do here!

// Set Opus as the default audio codec if it's present.
function preferOpus(sdp) {
  var sdpLines = sdp.split('\r\n');
  var mLineIndex = null;
  // Search for m line.
  for (var i = 0; i < sdpLines.length; i++) {
      if (sdpLines[i].search('m=audio') !== -1) {
        mLineIndex = i;
        break;
      }
  }
  if (mLineIndex === null) {
    return sdp;
  }

  // If Opus is available, set it as the default in m line.
  for (i = 0; i < sdpLines.length; i++) {
    if (sdpLines[i].search('opus/48000') !== -1) {
      var opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
      if (opusPayload) {
        sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex], opusPayload);
      }
      break;
    }
  }

  // Remove CN in m line and sdp.
  sdpLines = removeCN(sdpLines, mLineIndex);

  sdp = sdpLines.join('\r\n');
  return sdp;
}

function extractSdp(sdpLine, pattern) {
  var result = sdpLine.match(pattern);
  return result && result.length === 2 ? result[1] : null;
}

// Set the selected codec to the first in m line.
function setDefaultCodec(mLine, payload) {
  var elements = mLine.split(' ');
  var newLine = [];
  var index = 0;
  for (var i = 0; i < elements.length; i++) {
    if (index === 3) { // Format of media starts from the fourth.
      newLine[index++] = payload; // Put target payload to the first.
    }
    if (elements[i] !== payload) {
      newLine[index++] = elements[i];
    }
  }
  return newLine.join(' ');
}

// Strip CN from sdp before CN constraints is ready.
function removeCN(sdpLines, mLineIndex) {
  var mLineElements = sdpLines[mLineIndex].split(' ');
  // Scan from end for the convenience of removing an item.
  for (var i = sdpLines.length-1; i >= 0; i--) {
    var payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
    if (payload) {
      var cnPos = mLineElements.indexOf(payload);
      if (cnPos !== -1) {
        // Remove CN payload from m line.
        mLineElements.splice(cnPos, 1);
      }
      // Remove CN line in sdp
      sdpLines.splice(i, 1);
    }
  }

  sdpLines[mLineIndex] = mLineElements.join(' ');
  return sdpLines;
}


/* --------------------------------------------------------------------------- */
// This is additional code for testing out the rtp getstats 

var wait = ms => new Promise(r => setTimeout(r, ms));
var repeat = (ms, func) => new Promise(r => (setInterval(func, ms), wait(ms).then(r)));
var log = msg => div.innerHTML = div.innerHTML +"<p>"+ msg +"</p>";
var update = (div, msg) => div.innerHTML = msg;
var failed = e => log(e.name +": "+ e.message +", line "+ e.lineNumber);
