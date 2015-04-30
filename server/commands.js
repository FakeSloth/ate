module.exports = {
	j: 'join',
	join: function(data, room, user, socket, cmd, msg) {
		if (!data) return false;
		var targetRoom = rooms[toId(data)];
		if (!targetRoom) return; //nonexistent room
		targetRoom.join(socket);
	},
	eval: function (data, room, user, socket, cmd, msg) {
		if (user.userid !== "darkpoo") {
			return;
		}
		room.add('>> ' + msg.substr(("/eval").length));
		try {
			room.add('<< ' + eval(data));
		} catch (e) {
			room.add('<< error: ' + e.message);
			var stack = '' + ('' + e.stack).replace(/\n/g, '\n|');
			room.add(stack);
		}
	},
	rename: 'nick',
	name: 'nick',
	nickname: 'nick',
	nick: function(data, room, user) {
		user.rename(data);
	},
	reg: 'register',
	register: function(data, room, user) {
		var splint = data.split(',');
		var name = splint[0];
		var pass = splint[1];
		user.register(name, pass);
	},
};
