global.string = function(str) {
	if (typeof str === 'string' || typeof str === 'number') return '' + str;
	return '';
};
global.toId = function(text) {
	if (text && text.id) text = text.id;
	else if (text && text.userid) text = text.userid;
	return string(text).toLowerCase().replace(/[^a-z0-9]+/g, '');
};
var io = require('socket.io').listen(8000),
	User = require('./User.js'),
	Room = require('./Room.js'),
	parse = require('./parse.js');

var events = {
	'nametaken': function(user, data) {
		user.rename(data.username);
	},
	'nameregged': function(user, data) {
		user.login(data.username, data.password);
	},
	'registername': function(user, data) {
		user.register(data.username, data.password);
	},
	'tokenrename': function(user, data) {
		user.loginByToken(data.token);
	},
	'c': function(user, data, socket) {
		var room = rooms[data.room];
		var msg = data.msg;
		if (!msg.trim().length || msg.length > 500) return;
		var sendMessage = parse(msg, room, user, socket);
		if (sendMessage === false || !room) return;
		room.addLog(user.name + '|' + data.msg); //add log
	},
};
io.on('connection', function(socket) {
	var user = socket.user;
	if (!user) user = new User(socket);
	socket.on('e', function(data) {
		if (typeof data !== "object" || !data.event) return;
		if (events[data.event]) {
			events[data.event](user, data, socket);
		}
	});
	socket.on('disconnect', function() {
		user.disconnect(socket);
	});
});
