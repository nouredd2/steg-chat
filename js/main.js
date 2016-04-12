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