var mongoose = require('mongoose'),
	jwt = require('jsonwebtoken'), // used to create, sign, and verify tokens
	bcrypt = require('bcrypt-nodejs');
mongoose.connect("mongodb://localhost/ate"); // connect to database
var UserModel = require('./userModel.js'); // get our mongoose model
var superSecret = 'superSecret';

var userCount = 0;
global.users = {};
function User(socket) {
	socket.send = function(msg) {
		this.emit('e', msg);
	};
	this.name = "Guest" + (++userCount);
	this.userid = toId(this.name);
	this.connections = [socket];
	this.connected = true;
	this.rooms = {};
	this.named = false;
	socket.user = users[this.userid] = this;
	this.updateUser();
	return this;
}
User.prototype.finishRename = function(name, token) {
	//dont forget to merge shit
	var oldUserid = this.userid;
	var userid = toId(name);
	var targetUser = users[userid];
	if (!targetUser) {
		users[userid] = this;
	} else {
		//merge user
		this.merge(targetUser);
		users[userid] = this;
	}
	delete users[this.userid];
	this.name = name;
	this.userid = userid;
	this.connected = true;
	this.named = true;
	if (name.substr(0, 5) === "Guest") this.named = false;
	if (token) this.token = token;
	this.updateUser(token);
	
	//let the rooms know about the name change
	var roomKeys = Object.keys(this.rooms);
	for (var i = 0; i < roomKeys.length; i++) {
		var room = rooms[roomKeys[i]];
		room.renameUser(oldUserid, userid);
	}
};
User.prototype.updateUser = function(token) {
	this.send('user|' + this.getIdentity() + '|' + (token ? token : ''));
};
User.prototype.merge = function(targetUser) {
	//take the connections && ips of oldUser and put them in "this"
	var connections = targetUser.connections;
	var connectionCount = connections.length;
	for (var i = 0; i < connectionCount; i++) {
		var connection = connections[i];
		connection.user = this;
		if (connections.channels) {
			//if in any rooms add them to user object
			for (var x in connections.channels) this.rooms[x] = true;
		}
		this.connections.push(connection);
	}
};
User.prototype.disconnect = function(connection) {
	var connectionCount = this.connections.length;
	for (var i = 0; i < connectionCount; i++) {
		if (connection === this.connections[i]) {
			this.logoutSocket(connection, i);
			break;
		}
	}
	if (!this.connections.length) this.logout();
};
User.prototype.logoutSocket = function(connection, key) {
	connection.send = function() {};
	//disconnect from all rooms
	if (connection.channels) {
		var keys = Object.keys(connection.channels);
		for (var i = 0; i < keys.length; i++) rooms[keys[i]].leave(connection);
	}
	//remove socket from connections
	this.connections.splice(key, 1);
};
User.prototype.firstJoin = function(room) {
	//check if this is the first connection to join a room
	var id = room.id || room;
	var connectionsToRoom = 0;
	for (var i = 0; i < this.connections.length; i++) {
		var connection = this.connections[i];
		if (!connection.channels) continue;
		if (connection.channels[id]) {
			if (++connectionsToRoom === 2) break; //we don't need to go any further, we know this is not the first join
		}
	}
	if (connectionsToRoom === 1) return true;
	return false;
};
User.prototype.lastLeave = function(room) {
	//check if no connections are left to a room
	var id = room.id || room;
	var connectionsToRoom = 0;
	for (var i = 0; i < this.connections.length; i++) {
		var connection = this.connections[i];
		if (!connection.channels) continue;
		if (connection.channels[id]) {
			if (++connectionsToRoom === 1) break; //we don't need to go any further, we know we still have active connections to the room
		}
	}
	if (connectionsToRoom === 0) return true;
	return false;
};
User.prototype.isIn = function(room) {
	return !this.lastLeave(room);
};
User.prototype.logout = function() {
	this.connected = false;
};
User.prototype.register = function(name, password) {
	//creating a user
	name = name || '';
	if (name.length > 20) return this.send('registername||Names should be 20 or less characters.');
	name = this.filterName(name);
	var userid = toId(name);
	if (!userid) return this.send('registername||This name is invalid.');
	if (!password) return this.send('registername|' + name + '|No password.');
	var self = this;
	function cb(password) {
		var user = new UserModel({
			userid: userid,
			name: name,
			password: password
		});
		user.save(function(err) {
			if (err) throw err;
			//success
			console.log('user has been saved');
		});
		
		var token = jwt.sign(user, superSecret, {
			expiresInMinutes: 1440 * 7 // expires in a week
		});
		self.finishRename(name, token);
	}
	bcrypt.genSalt(10, function(err, salt) {
		if (err) return console.log(err);
		bcrypt.hash(password, salt, null, function(err, hash) {
			if (err) return console.log(err);
			cb(hash);
		});
	});
};
User.prototype.rename = function(name) {
	//if regged show them the prompt
	name = name || '';
	if (name.length > 20) return this.send('nametaken||Names should be 20 or less characters.');
	name = this.filterName(name);
	var userid = toId(name);
	if (!userid) return this.send('nametaken||This name is invalid.');
	var self = this;
	UserModel.findOne({
		userid: userid
	}, function(err, user) {
		if (err) throw err;
		if (user) return self.send('nameregged|' + name + '|This username is registered.');
		//not registered
		if (users[userid] && users[userid].connected) return self.send('nametaken|' + name + '|This name is currently being used.');
		self.finishRename(name);
	});
};
User.prototype.login = function(name, password) {
	//authenticating a user with name and password
	name = this.filterName(name || '');
	var self = this;
	UserModel.findOne({
		userid: toId(name)
	}, function(err, user) {
		if (err) throw err;
		if (!user) {
			//authentication failed user not found
			return;
		}
		function cb(err, match) {
			if (err) return console.log(err);
			if (!match) {
				//wrong pass
				return self.send('nameregged|' + name + '|Authentication failed. Wrong password.');
			} else {
				// if user is found and password is right
				// create a token
				var token = jwt.sign(user, superSecret, {
					expiresInMinutes: 1440 * 7 // expires in a week
				});

				// return the information including token as JSON
				self.finishRename(name, token);
			}
		}
		bcrypt.compare(password, user.password, function(err, isMatch) {
			if (err) return cb(err);
			cb(null, isMatch);
		});
	});
};
User.prototype.loginByToken = function(token) {
	//authenticating a user with a token
	var self = this;
	jwt.verify(token, superSecret, function(err, dbUser) {
		if (err) {
			//token couldnt be authenticated
			return self.send('tokenerror||Token could not be authenticated');
		}
		// if everything is good, save to request for use in other routes
		self.finishRename(dbUser.name);
	});
};
User.prototype.getIdentity = function() {
	return ' ' + this.name;
};
User.prototype.filterName = function(name) {
	function toName(name) {
		name = string(name);
		name = name.replace(/[\|\s\[\]\,]+/g, ' ').trim();
		if (name.length > 20) name = name.substr(0, 20).trim();
		return name;
	}
	name = toName(name);
	name = name.replace(/^[^A-Za-z0-9]+/, "");
	return name;
};
User.prototype.send = function(data) {
	var connections = this.connections;
	var connectionCount = connections.length;
	for (var i = 0; i < connectionCount; i++) connections[i].send(data);
};
module.exports = User;
