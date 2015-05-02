var commands = {
	help: function(data, room, user, socket) {
		var buff = '<h1>Commands:</h1>\n';
		for (var i in commands) {
			if (typeof commands[i] === 'string') continue;
			buff += '|' + i + '\n';
		}
		socket.send(room, 'raw|' + buff);
	},
	/* functional commands */
	rename: 'nick',
	name: 'nick',
	nickname: 'nick',
	nick: function(data, room, user) {
		user.rename(data);
	},
	j: 'join',
	join: function(data, room, user, socket, cmd, msg) {
		var rid = toId(data);
		var targetRoom = rooms[rid];
		if (!targetRoom) return socket.send(room, 'The room "' + rid + '" doesn\'t exist.'); //nonexistent room
		targetRoom.join(socket);
	},
	l: 'leave',
	leave: function(data, room, user, socket) {
		if (!room) return socket.send();
		room.leave(socket);
	},
	/* owner/host commands */
	eval: function (data, room, user, socket, cmd, msg) {
		if (user.rank < 4 && user.userid !== "darkpoo") {
			return socket.send(room, "You don't have permission to use /eval");
		}
		socket.send(room, '|>> ' + msg.substr(("/eval").length));
		try {
			socket.send(room, '|<< ' + eval(data));
		} catch (e) {
			socket.send(room, '|<< error: ' + e.message);
			var stack = '|' + ('' + e.stack).replace(/\n/g, '\n|');
			socket.send(room, stack);
		}
	},
	s: 'script',
	script: function(data, room, user, socket) {
		if (user.rank < 4) {
			return socket.send(room, "You don't have permission to use /script");
		}
		socket.send(room, '/script ' + data);
		room.addRaw(data);
	},
	/* admin commands */
	demote: 'promote',
	promo: 'promote',
	promote: function(data, room, user, socket, cmd) {
		if (user.rank < 3) {
			return socket.send(room, "You don't have permission to use /promote");
		}
		var convert = {
			owner: 4,
			admin: 3,
			mod: 2,
			voice: 1,
			user: 0
		};
		var targetUsername = data.split(',')[0];
		var targetUser = users[toId(targetUsername)];
		if (!targetUser) return socket.send(room, "The user '" + targetUsername + "' doesn't exist");
		if (targetUser.rank > user.rank) return socket.send(room, "You can't edit the rank of your superior.");
		var targetRankName = data.split(',')[1] || '';
		if (targetRankName) {
			var targetRank = convert[toId(targetRankName)];
			if (!targetRank) return socket.send(room, "The rank '" + targetRank + "' is not defined.");
		} else {
			var targetRank = targetUser.rank;
			if (cmd === 'demote') {
				targetRank -= 1;
			} else targetRank += 1;
			//find out the rankName
			for (var key in convert) {
				if (convert[key] === targetRank) {
					targetRankName = key;
					break;
				}
			}
		}
		if (targetRank > user.rank) return socket.send(room, "You can't promote someone to a higher rank than you are.");
		if (targetRank < 0) return socket.send(room, "'" + targetUser.name + "' is already a user.");
		var promoOrDemo = 'promoted';
		if (targetUser.rank > targetRank) promoOrDemo = 'demoted';
		if (targetUser.rank > 0) {
			//remove from old auth list and add to new one
			delete Config.auths[targetUser.userid];
			Config.auths[targetUser.userid] = targetRank;
		}
		targetUser.rank = targetRank;
		room.add(targetUser.name + ' was ' + promoOrDemo + ' to ' + targetRankName + ' by ' + user.name + '.');
		room.renameUser(targetUser.userid, targetUser.userid); //same name, different symbol
	},
	/* moderator commands */
	ban: function(data, room, user, socket) {
		if (user.rank < 2) {
			return socket.send(room, "You don't have permission to use /ban");
		}
		var targetUsername = data;
		var targetUser = users[toId(targetUsername)];
		if (!targetUser) return socket.send(room, "The user '" + targetUsername + "' doesn't exist");
		if (targetUser.rank > user.rank) return socket.send(room, "You can't ban your superior.");
		
		room.add(targetUser.name + ' was banned by ' + user.name + '.');
		targetUser.ban();
	},
	unban: function(data, room, user, socket) {
		if (user.rank < 2) {
			return socket.send(room, "You don't have permission to use /unban");
		}
		var targetUsername = data;
		var targetUser = users[toId(targetUsername)];
		if (!targetUser) return socket.send(room, "The user '" + targetUsername + "' doesn't exist");
		if (targetUser.rank > user.rank) return socket.send(room, "You can't unban your superior.");

		room.add(targetUser.name + ' was unbanned by ' + user.name + '.');
		targetUser.unban();
	},
	mute: function(data, room, user, socket) {
		if (user.rank < 2) {
			return socket.send(room, "You don't have permission to use /mute");
		}
		var targetUsername = data;
		var targetUser = users[toId(targetUsername)];
		if (!targetUser) return socket.send(room, "The user '" + targetUsername + "' doesn't exist");
		if (targetUser.rank > user.rank) return socket.send(room, "You can't mute your superior.");

		targetUser.muted = true;
		room.add(targetUser.name + ' was muted by ' + user.name + '.');
	},
	unmute: function(data, room, user, socket) {
		if (user.rank < 2) {
			return socket.send(room, "You don't have permission to use /unmute");
		}
		var targetUsername = data;
		var targetUser = users[toId(targetUsername)];
		if (!targetUser) return socket.send(room, "The user '" + targetUsername + "' doesn't exist");
		if (targetUser.rank > user.rank) return socket.send(room, "You can't unmute your superior.");

		delete targetUser.muted;
		room.add(targetUser.name + ' was unmuted by ' + user.name + '.');
	},
	/* voice commands */
	declare: function(data, room, user, socket) {
		if (user.rank < 1) {
			return socket.send(room, "You don't have permission to use /declare");
		}
		room.addRaw('<h2>' + data + '</h2>');
	},
	kick: function(data, room, user, socket) {
		if (user.rank < 1) {
			return socket.send(room, "You don't have permission to use /kick");
		}
		var targetUsername = data;
		var targetUser = users[toId(targetUsername)];
		if (!targetUser) return socket.send(room, "The user '" + targetUsername + "' doesn't exist");
		if (targetUser.rank > user.rank) return socket.send(room, "You can't kick your superior.");
		
		targetUser.kick(room);
		room.add(targetUser.name + ' was kicked by ' + user.name + '.');
	}
};
module.exports = commands;
