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
var localcanvas = document.querySelector('#localcanvas');
var localctx = localcanvas.getContext('2d');

var decodecanvas = document.querySelector('#decodecanvas');
var decodectx = decodecanvas.getContext('2d');

var tmpcanvas = document.createElement('canvas');
var backcontext = tmpcanvas.getContext('2d');

var msgdiv = document.querySelector('#txtMessage');

var prevtime = (new Date()).getTime();
var curtime = prevtime;
var justonce = 1;

// this sets up the seriously effects for testing the
// modification of the video stream
//var seriously = new Seriously();
//var source = seriously.source('#localVideo');
//var target = seriously.target('#localcanvas');
//var tvglitch = seriously.effect('invert');
//tvglitch.source = source;
//target.source = tvglitch;

function stegdraw (vid, ctx, bctx, width, height) {
	if (vid.paused || vid.ended) {
		return false;
	}

	// draw on the back canvas
	bctx.drawImage(vid, 0, 0, width, height);
	
	// grab the image data
	var idata = bctx.getImageData(0, 0, width, height);
	var data = idata.data;

	for (var i = 0;i < data.length; i+=4) {
		var r = data[i],
			g = data[i+1],
			b = data[i+2],
			alpha = data[i+3];

		// mask to get the last two bits of the pixel 
		var mask = 0xFFFFFFFC;
		var letter = 104; // 104 in binary is 01101000
		curtime = (new Date()).getTime();
		if (curtime - prevtime >= 0) {
			if (justonce === 1) {
				console.log('bingo');
				justonce = 0;
			}
			data[i] = (data[i] & mask) | 0x00000000;
			data[i+1] = (data[i+1] & mask) | 0x00000001;
			data[i+2] = (data[i+2] & mask) | 0x00000001;
			data[i+3] = (data[i+3] & mask) | 0x00000002;
		}
		prevtime = curtime;

	}

	// put the image back into our canvas 
	ctx.putImageData(idata, 0, 0);

	setTimeout(function() { stegdraw(vid, ctx, bctx, width, height); }, 20);
}


function decodeMessage(vid, ctx, width, height, msgBox) {
	if (vid.paused || vid.ended) {
		return false;
	}

	ctx.drawImage(vid, 0, 0, width, height);

	// grab current frame data
	var idata = ctx.getImageData(0, 0, width, height);
	var data = idata.data;

	for (var i = 0; i < data.length; i +=4) {
		var r = data[i];
		var g = data[i+1];
		var b = data[i+2];
		var a = data[i+3];

		if (justonce === 1) {
			console.log(r.toString(2));
			console.log(g.toString(2));
			console.log(b.toString(2));
			console.log(a.toString(2));
		} else if (justonce === 2) {
			console.log(r.toString(2));
			console.log(g.toString(2));
			console.log(b.toString(2));
			console.log(a.toString(2));
		}
		/*
		if (a === 255 && g === 255 && b === 255) {
			if (justonce === 1) {
				console.log('got your letter', r);
				justonce = 2;
			} else if (justonce === 2) {
				console.log('got your letter', r);
				justonce = 0;
			}
			var letter = r;
			msgBox.innerHTML = letter;
		}
		*/
	}

	setTimeout( function() { decodeMessage(vid, ctx, width, height, msgBox); }, 20 );
}

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

		// check if capture stream is supported
		if (localcanvas.captureStream) {
			// set the local stream to the output of the 
			// canvas in which we are doing operations
			console.log('Changing the local stream to canvas stream');

			localVideo.addEventListener('play', function() {
				var clientw = localVideo.clientWidth;
				var clienth = localVideo.clientHeight;

				localcanvas.width = clientw;
				localcanvas.height = clienth;
				tmpcanvas.width = clientw;
				tmpcanvas.height = clienth;

				stegdraw(localVideo, localctx, backcontext, clientw, clienth);
			});

			// this takes as parameter the fps of the capture stream 
			// but it seems to be very slow when I use it
			localStream = localcanvas.captureStream();
		}
	}
}

function handleUserMediaError(error) {
	console.log('getUserMedia error:', error);
}

// this is that get the user media and the handlers, basically 
// here is where we get the video form the user camera
var constraints = {'video': true};
getUserMedia(constraints, handleUserMedia, handleUserMediaError);

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
	}
}

// when exiting send the server a bye message so that the 
// server can broadcast the message back to the other client 
window.onbeforeunload = function(e) {
	sendMessage('bye');
}

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

	if (!isInitiator) {
		remoteVideo.addEventListener('play', function() {
				var clientw = remoteVideo.clientWidth;
				var clienth = remoteVideo.clientHeight;

				decodecanvas.width = clientw;
				decodecanvas.height = clienth;

				decodeMessage(remoteVideo, decodectx, clientw, clienth, msgdiv);
		});
	}
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

