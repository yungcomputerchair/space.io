/*
SPACE.IO v0.1
Gent Semaj
12/10/2019
Server-side node.js file
*/

const ARGS = process.argv.slice(2);
const PORT = ARGS[0] ? ARGS[0] : 3000;
const USE_SSL = ARGS[1] !== undefined && ARGS[2] !== undefined;

const { readFileSync } = require('fs');
const express = require('express');
const app = express();
const http = require('http');
const https = require('https');
const server = USE_SSL ? https.createServer({
  key: readFileSync(ARGS[1]),
  cert: readFileSync(ARGS[2])
}, app) : http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

// Client file to send
app.get('/', function(req, res){
  res.sendFile(__dirname + '/client.html');
});

// HTTP listener
server.listen(PORT, function(){
  console.log('listening on *:' + PORT);
});

// Top-level container
var universe = {
  ships: [], // array of ships
  lasers: [] // array of lasers
}

// Periodic tick function
function tick() {
	io.emit('universe', universe); // update the universe for all clients
}

/** Removes a ship from the universe ship array
params:
	id: client id #
*/
function removeShip(id) {
  for(var i = 0; i < universe.ships.length; i++) {
    if(universe.ships[i].id == id)
    {
      universe.ships.splice(i, 1);
      return true;
    }
  }
  return false;
}

/** Replaces a ship in the universe ship array
params:
	id: client id #
	newship: ship object to insert
*/
function replaceShip(id, newship) {
  for(var i = 0; i < universe.ships.length; i++) {
    if(universe.ships[i].id == id)
    {
      universe.ships.splice(i, 1, newship);
      return;
    }
  }
}

setInterval(tick, 17); // set interval in ms for tick function

/** New connection handler
params:
	socket: client socket object
*/
io.on('connection', function(socket){
	console.log('user connected'); // log the connection

	var clientShip = {
		id: socket.id, // client id is the socket id
		name: "Joe", // display name (unused)
		color: "#"+(0x1000000+(Math.random())*0xffffff).toString(16).substr(1,6), // random hexadecimal color
		xPos: 0, // x coordinate
		yPos: 0, // y coordinate
		theta: Math.random() * 360, // random angle in degrees
		linVel: 0, // linear velocity in units/tick
		rotVel: 0 // rotational velocity in degrees/tick
	}

	universe.ships.push(clientShip); // add the new client ship to the universe ship array

	socket.emit('universe', universe); // send the universe object to the client

	/** Update request handler
	params:
		rec: received client ship data
	*/
	socket.on('update', function(rec){
		replaceShip(socket.id, rec); // replace the server's current copy of the client's ship with the new data
	});

	/** Disconnect handler */
	socket.on('disconnect', function(){
		console.log('user disconnected'); // log the disconnect
		console.log(removeShip(socket.id) ? "clean" : "dirty"); // log whether the removal of the ship executed correctly
	});
});
