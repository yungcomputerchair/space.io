var observing = false;
var universe = null; // top-level container
var stars = []; // star array
var chunks = {}; // chunk dict
var killfeed = []; // hit events

/** Resize the canvas to fit the browser window
params:
    canvas: JavaScript canvas object
*/
function resizeCanvas(canvas) {
    canvas.width = document.body.clientWidth;
    canvas.height = document.body.clientHeight;
}

/** Trim a string-formatted decimal down to three decimal places
params:
    num: string-formatted decimal
return: trimmed string-formatted decimal
*/
function toThreePlaces(num) {
    var trimmed = num + "";
    var dec = trimmed.indexOf(".");
    return trimmed.substring(0, dec + 4);
}

/** Repaint the canvas */
function paint() {
    var canvas = document.getElementById("playArea");
    resizeCanvas(canvas); // resize the canvas
    var ctx = canvas.getContext("2d");
    var width = canvas.width;
    var height = canvas.height;

    var camX = getClientShip().xPos;
    var camY = getClientShip().yPos;

    // draw stars on canvas
    for (var u = 0; u < stars.length; u++) {
        var star = stars[u];
        if (!(Math.abs(getClientShip().yPos - star.y) > height / 2 + 10 || Math.abs(getClientShip().xPos - star.x) > width / 2 + 10)) // check if star is in range
        {
            reset(ctx);
            ctx.translate(camX - star.x, camY - star.y);

            if (getClientShip().linVel > 41 && Math.abs(getClientShip().rotVel) < 2) // if ship is in warp-drive
            {
                // draw some stretchy stars
                var stretch = (45.0 / 40.0) * (getClientShip().linVel - 41) + 15;
                var angle = toStandard(getClientShip().theta + 90) * Math.PI / 180.0;
                ctx.strokeStyle = "#FFFFFF";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(width / 2 - stretch * Math.cos(angle), height / 2 - stretch * Math.sin(angle));
                ctx.lineTo(width / 2 + stretch * Math.cos(angle), height / 2 + stretch * Math.sin(angle));
                ctx.stroke();
            }
            else {
                // draw some points
                ctx.fillStyle = "#FFFFFF";
                ctx.fillRect(width / 2 - 2, height / 2 - 2, 4, 4);
            }
        }
    }

    // draw all lasers
    for (var l = 0; l < universe.lasers.length; l++) {
        var drawnLaser = universe.lasers[l];
        reset(ctx);
        ctx.strokeStyle = drawnLaser.color;
        ctx.lineWidth = 3;
        var stretch = 50;
        var angle = toStandard(drawnLaser.theta + 90) * Math.PI / 180.0;

        ctx.translate(camX - drawnLaser.xPos, camY - drawnLaser.yPos);
        
        ctx.beginPath();
        ctx.moveTo(width / 2 - stretch * Math.cos(angle), height / 2 - stretch * Math.sin(angle));
        ctx.lineTo(width / 2 + stretch * Math.cos(angle), height / 2 + stretch * Math.sin(angle));
        ctx.stroke();
    }

    // draw all ships
    for (var s in universe.ships) {
        var drawnShip = universe.ships[s];

        if (Math.abs(getClientShip().yPos - drawnShip.yPos) > height / 2 + 60 || Math.abs(getClientShip().xPos - drawnShip.xPos) > width / 2 + 60) // check if ship is in view
        {
            if (drawnShip != getClientShip()) {
                // draw radar pointer to ship
                reset(ctx);
                ctx.fillStyle = drawnShip.color;

                ctx.translate(width / 2, height / 2);
                ctx.rotate(Math.PI / 2);
                ctx.rotate(Math.atan2((getClientShip().yPos - drawnShip.yPos), (getClientShip().xPos - drawnShip.xPos)));
                ctx.translate(-width / 2, -height / 2);

                ctx.beginPath();
                ctx.moveTo(width / 2, height / 2 - 120);
                ctx.lineTo(width / 2 + 12, height / 2 - 100);
                ctx.lineTo(width / 2 - 12, height / 2 - 100);
                ctx.closePath();
                ctx.fill();
            }
        }
        else {
            if ((drawnShip == getClientShip() && !observing) || drawnShip != getClientShip()) // experimental observer mode check
            {
                // draw the ship
                reset(ctx);
                ctx.translate(camX - drawnShip.xPos, camY - drawnShip.yPos);
                ctx.fillStyle = "#FFFFFF";
                ctx.textAlign = "center";
                ctx.font = "18px Kong";
                ctx.textBaseline = "bottom";
                ctx.fillText(drawnShip.name, width / 2, height / 2 - 50);
                ctx.fillStyle = drawnShip.color;
                ctx.translate(width / 2, height / 2);
                ctx.rotate(toStandard(drawnShip.theta) * Math.PI / 180.0);
                ctx.translate(-width / 2, -height / 2);
                if(drawnShip.iFrames % 2 == 0) {
                    ctx.beginPath();
                    ctx.moveTo(width / 2, height / 2 - 36);
                    ctx.lineTo(width / 2 + 30, height / 2 + 30);
                    ctx.lineTo(width / 2 - 30, height / 2 + 30);
                    ctx.closePath();
                    ctx.fill();
                }
            }
        }
    }

    // is the ship transitioning to warp speed?
    if (isWarping(getClientShip())) {
        // flash the screen white
        reset(ctx);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(-5, -5, width + 10, height + 10);
    }

    // draw stats
    reset(ctx);
    ctx.font = "18px Kong";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    if (!observing) {
        // write ship data to canvas
        ctx.fillText("x pos: " + toThreePlaces(getClientShip().xPos), 10, 20);
        ctx.fillText("y pos: " + toThreePlaces(getClientShip().yPos), 10, 40);
        ctx.fillText("rot: " + toThreePlaces(getClientShip().theta), 10, 60);
        ctx.fillText("lin vel: " + toThreePlaces(getClientShip().linVel), 10, 80);
        ctx.fillText("rot vel: " + toThreePlaces(getClientShip().rotVel), 10, 100);
    }

    // draw killfeed
    for(var i = 0; i < killfeed.length; i++) {
        var hitEvent = killfeed[i];
        var shipA = universe.ships[hitEvent.hitter];
        var shipB = universe.ships[hitEvent.hitee];
        var t1 = " " + shipA.name;
        var mark = " > ";
        var t2 = shipB.name + " ";
        var fontSize = 18;
        var size = (t1 + mark + t2).length * fontSize;

        ctx.fillStyle = "#222";
        ctx.fillRect(width - (size + 10), 10 + 50*i, size, 40);

        ctx.font = "18px Kong";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";

        ctx.fillStyle = shipA.color;
        ctx.fillText(t1, width - (size + 10), 10 + 50*i + 20);

        ctx.fillStyle = "#FFF";
        ctx.fillText(mark, width - (size + 10) + fontSize * t1.length, 10 + 50*i + 20);

        ctx.fillStyle = shipB.color;
        ctx.fillText(t2, width - (size + 10) + fontSize * (t1.length + mark.length), 10 + 50*i + 20);

    }

    // draw scoreboard
    if (indexOf(keys, 9) > -1) {
        reset(ctx);
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.fillRect(width/2 - 400, height/2 - 250, 800, 500);

        var idy = -1;
        var idx = 1;
        for(var s in universe.ships) {
            if(idx == 1) idy++;
            idx = 1 - idx;
            var x = idx * 400 + width/2 - 400;
            var y = idy * 50 + height/2 - 250;
            ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
            ctx.fillRect(x + 5, y + 5, 400 - 10, 50 - 5);

            var ship = universe.ships[s];
            //ctx.fillStyle = "#F00";
            //ctx.fillRect(x + 8, y + 8, 20, 39);

            ctx.fillStyle = ship.color;
            ctx.beginPath();
            ctx.moveTo(x + 8, y + 8);
            ctx.lineTo(x + 52, y + 28);
            ctx.lineTo(x + 8, y + 48);
            ctx.closePath();
            ctx.fill();

            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.font = '20px Kong';
            ctx.fillText(ship.name, x + 60, y + 27);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(`${ship.kills} / ${ship.deaths} `, x + 5 + 400 - 10, y + 27);
        }
    }
}

/** Reset the canvas context transform */
function reset(ctx) {
    ctx.resetTransform();
    ctx.translate(0, 0.5); // half a pixel to prevent blurring
    ctx.lineWidth = 1;
}

// UTIL

/** Convert a bearing to a standard degree measure
params:
    bearing: angle in bearing
return: angle in standard
*/
function toStandard(bearing) {
    return (bearing - 90) * -1;
}

/** Linear search through array
params:
    haystack: array to search
    needle: target
return: index of target or -1 if not found
*/
function indexOf(haystack, needle) {
    for (var i = 0; i < haystack.length; i++) {
        if (haystack[i] == needle) return i;
    }
    return -1;
}

// INPUT

var keys = [];
document.onkeydown = function (evt) { // register key press
    evt.preventDefault();
    if (indexOf(keys, evt.keyCode) == -1) keys.push(evt.keyCode); // check if key already registered before registering
};
document.onkeyup = function (evt) { // register key release
    evt.preventDefault();
    var index = indexOf(keys, evt.keyCode);
    if (index > -1) keys.splice(index, 1);
    if (evt.keyCode == 81) observing = !observing;
};

// GAME

/** Return the client ship through linear search
return: client ship object
NOTE: it would be way more efficient to keep a separate variable for the client ship, should this project be revived
*/
function getClientShip() {
    return universe.ships[socket.id];
}

/** Check if a ship is transitioning to warp speed
params:
    ship: the ship to check
return: true if transitioning, false otherwise
*/
function isWarping(ship) {
    return (ship.linVel >= 40.5 && ship.linVel <= 41 && Math.abs(ship.rotVel) < 2);
}

/** Check if a star chunk is populated
params:
    cx: chunk x coordinate
    cy: chunk y coordinate
return: true if populated, false if not
*/
function populated(cx, cy) {
    return chunks[cx] != undefined && chunks[cx][cy] != undefined;
}

/** Populate a star chunk
params:
    cx: chunk x coordinate
    cy: chunk y coordinate
*/
function genChunk(cx, cy) {
    var starsTemp = [];
    for (var i = 0; i < 5000; i++) {
        var starX = 10000 * (cx + Math.random());
        var starY = 10000 * (cy + Math.random());
        starsTemp.push({ x: starX, y: starY });
    }
    stars = stars.concat(starsTemp);
    if(chunks[cx] == undefined) chunks[cx] = {};
    chunks[cx][cy] = {};
    console.log("Generated sector (" + cx + ", " + cy + ")");
}

/** Tick function */
function tick() {
    if (!observing) {
        // caluclate ship chunk coordinates
        var shipCX = Math.floor(getClientShip().xPos / 10000);
        var shipCY = Math.floor(getClientShip().yPos / 10000);
        // populate chunks around the client ship
        for (var ox = -1; ox < 2; ox++) {
            for (var oy = -1; oy < 2; oy++) {
                if (!populated(shipCX + ox, shipCY + oy))
                    genChunk(shipCX + ox, shipCY + oy);
            }
        }

        if (indexOf(keys, 65) > -1) // D key pressed, rotate clockwise
            getClientShip().rotVel += (getClientShip().rotVel < 12 ? .5 : .25);
        if (indexOf(keys, 68) > -1) // A key pressed, rotate counter-clockwise
            getClientShip().rotVel -= (getClientShip().rotVel > -12 ? .5 : .25);
        if (indexOf(keys, 87) > -1) // W key pressed, speed up
            getClientShip().linVel += (getClientShip().linVel < 80 ? (getClientShip().linVel > 41 ? 1.2 : .3) : .15);
        if (indexOf(keys, 83) > -1) // S key pressed, slow down
            getClientShip().linVel -= .5;
        if (indexOf(keys, 32) > -1 && getClientShip().laserTimer == 0 && !isWarping(getClientShip())) // space bar pressed, shoot laser
        {
            getClientShip().laserTimer = 45;
            socket.emit('fire');
        }

        if (getClientShip().linVel > 41 && Math.abs(getClientShip().rotVel) > 2) // limit rotational velocity if ship is going warp-speed
            getClientShip().rotVel = (getClientShip().rotVel > 0) ? 2 : -2;
    }

    // all lasers
    for (var l = 0; l < universe.lasers.length; l++) {
        var laser = universe.lasers[l];

        //laser.yPos += Math.cos(toStandard(laser.theta) * Math.PI / 180.0) * laser.vel;
        //laser.xPos += -Math.sin(toStandard(laser.theta) * Math.PI / 180.0) * laser.vel;
    }

    // all ships
    for (var s in universe.ships) {
        var ship = universe.ships[s];

        if(ship.laserTimer > 0) ship.laserTimer--;

        if (ship.linVel > 0) ship.linVel -= .15;
        if (ship.linVel < 0) ship.linVel = 0;
        if (ship.rotVel > 0) ship.rotVel -= .25;
        if (ship.rotVel < 0) ship.rotVel += .25;
        ship.theta += ship.rotVel;
        while(ship.theta < 0) ship.theta += 360;
        ship.theta = ship.theta % 360;
        if(ship.iFrames > 0) ship.iFrames--;

        ship.yPos += Math.cos(toStandard(ship.theta) * Math.PI / 180.0) * ship.linVel;
        ship.xPos += -Math.sin(toStandard(ship.theta) * Math.PI / 180.0) * ship.linVel;
    }

    socket.emit('update', getClientShip());

    paint();
}

// SERVER INTERACTION
var socket = io(); // establish socket to server
var uname = window.prompt("Please enter your name:", "Joe").substring(0, 8);

/** Server update handler
params:
    rec: received universe object
*/
socket.on('universe', function (rec) {
    if (universe == null) {
        setInterval(tick, 35);
        universe = rec;
        getClientShip().name = uname;
    } else {
        var me = getClientShip();
        universe = rec;
        universe.ships[socket.id] = me;
    }
    
});

socket.on('hit', arg => {
    if(universe != null) {
        universe.ships[arg.hitee].deaths = arg.deathCount;
        universe.ships[arg.hitter].kills = arg.killCount;
        universe.ships[arg.hitee].iFrames = 35;

        killfeed.push({
            ...arg,
            timeout: 5 * 28 // 5ish seconds
        });
    }
});