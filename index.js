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

// Static files
app.use(express.static('public'));

// Client file to send
app.get('/', function (req, res) {
    res.sendFile(__dirname + '/client.html');
});

// HTTP listener
server.listen(PORT, function () {
    console.log('listening on *:' + PORT);
});

// Top-level container
var universe = {
    ships: {}, // dict of ships
    lasers: [] // array of lasers
}

// Periodic tick function
function tick() {
    // tick lasers
    universe.lasers.forEach(laser => {
        // translate
        laser.yPos += Math.cos(toStandard(laser.theta) * Math.PI / 180.0) * laser.vel;
        laser.xPos += -Math.sin(toStandard(laser.theta) * Math.PI / 180.0) * laser.vel;

        // hitscan
        Object.entries(universe.ships).forEach(_ship => {
            var ship = _ship[1];
            if(ship.id === laser.id || ship.iFrames > 0) return;
            var coords = getRealCoords(ship);
            var deltas = [];
            for(var i = 0; i < 3; i++) {
                var base = coords[i];
                var next = coords[i + 1 < 3 ? i + 1 : 0];
                var slopeDelta = (laser.yPos - base[1]) * (next[0] - base[0])
                                - (laser.xPos - base[0]) * (next[1] - base[1]);
                deltas.push(slopeDelta);
            }
            //console.log(deltas);
            if(
                (deltas[0] < 0
                && deltas[1] < 0
                && deltas[2] < 0) ||
                (deltas[0] > 0
                && deltas[1] > 0
                && deltas[2] > 0)) {
                    console.log(`${ship.id} hit by ${laser.id}`);
                    laser.timer = 1;
                    ship.iFrames = 35; // 1 second
                    io.sockets.sockets.get(ship.id).emit('hit');
                }
        });

        laser.timer--;
    });
    universe.lasers = universe.lasers.filter(laser => laser.timer > 0);

    // tick ships
    Object.entries(universe.ships).forEach(_ship => {
        var ship = _ship[1];
        if(ship.iFrames > 0) ship.iFrames--;
        if(ship.laserTimer > 0) ship.laserTimer--;
    });

    io.emit('universe', universe); // update the universe for all clients
}

/** Removes a ship from the universe ship array
params:
    id: client id #
*/
function removeShip(id) {
    if(universe.ships[id] == undefined)
        return false;

    delete universe.ships[id];
    return true;
}

function toStandard(bearing) {
    return (bearing - 90) * -1;
}

function multMatrix(...mats) {
    if(mats.length == 1) return mats[0];

    if(mats[0][0].length != mats[1].length) {
        console.log("dimension mismatch");
        return null;
    }

    var result = [];

    for(var x = 0; x < mats[0].length; x++) {
        result[x] = [];
        for(var y = 0; y < mats[1][0].length; y++) {
            var cell = 0;
            for(var i = 0; i < mats[0][0].length; i++)
                cell += mats[0][x][i] * mats[1][i][y];
            result[x][y] = cell;
        }
    }

    return multMatrix(result, ...mats.slice(2));
}

function getRealCoords(ship) {
    var theta = toStandard(ship.theta) * Math.PI / 180.0;
    var mat1 = [
        [1, 0, ship.xPos],
        [0, 1, ship.yPos],
        [0, 0, 1]
    ];
    var mat2 = [
        [Math.cos(theta), -Math.sin(theta), 0],
        [Math.sin(theta), Math.cos(theta), 0],
        [0, 0, 1]
    ];
    var mat3 = [
        [1, 0, -ship.xPos],
        [0, 1, -ship.yPos],
        [0, 0, 1]
    ];
    var M = multMatrix(mat1, mat2, mat3);
    var coords = [
        [
            [ship.xPos],
            [ship.yPos - 36],
            [1]
        ],
        [
            [ship.xPos + 30],
            [ship.yPos + 30],
            [1]
        ],
        [
            [ship.xPos - 30],
            [ship.yPos + 30],
            [1]
        ]
    ];
    return coords.map(coord => multMatrix(M, coord));
}

/** Inserts or updates a ship in the universe
params:
    id: client id #
    newship: ship object to insert
*/
function updateShip(id, newship) {
    universe.ships[id] = newship;
}

setInterval(tick, 35); // set interval in ms for tick function

/** New connection handler
params:
    socket: client socket object
*/
io.on('connection', function (socket) {
    console.log('user connected'); // log the connection

    var clientShip = {
        id: socket.id, // client id is the socket id
        name: "Joe", // display name (unused)
        color: "#" + (0x1000000 + (Math.random()) * 0xffffff).toString(16).substr(1, 6), // random hexadecimal color
        xPos: 0, // x coordinate
        yPos: 0, // y coordinate
        theta: Math.random() * 360, // random angle in degrees
        linVel: 0, // linear velocity in units/tick
        rotVel: 0, // rotational velocity in degrees/tick
        laserTimer: 0, // cooldown to shoot laser
        iFrames: 0 // invincibility frames
    };

    updateShip(socket.id, clientShip); // add new ship
    socket.emit('universe', universe); // send the universe object to the client

    /** Update request handler
    params:
        rec: received client ship data
    */
    socket.on('update', function (rec) {
        // TODO validate input
        updateShip(socket.id, rec); // replace the server's current copy of the client's ship with the new data
    });

    socket.on('fire', function() {
        if(universe.ships[socket.id].linVel > 40) return; // no pew pew during zoom zoom
        if(universe.ships[socket.id].laserTimer > 0) return; // no pew pew during cooldown
        var laser = {
            id: socket.id,
            color: universe.ships[socket.id].color,
            xPos: universe.ships[socket.id].xPos,
            yPos: universe.ships[socket.id].yPos,
            theta: universe.ships[socket.id].theta,
            vel: universe.ships[socket.id].linVel + 25,
            timer: 29
        };
        universe.ships[socket.id].laserTimer = 45;

        laser.yPos += Math.cos(toStandard(laser.theta) * Math.PI / 180.0) * laser.vel;
        laser.xPos += -Math.sin(toStandard(laser.theta) * Math.PI / 180.0) * laser.vel;
        universe.lasers.push(laser);
    });

    /** Disconnect handler */
    socket.on('disconnect', function () {
        console.log('user disconnected'); // log the disconnect
        console.log(removeShip(socket.id) ? "clean" : "dirty"); // log whether the removal of the ship executed correctly
    });
});
