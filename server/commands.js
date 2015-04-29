module.exports = {
	j: 'join',
	join: function(data, room, user, socket, cmd, msg) {
		if (!data) return false;
		var targetRoom = rooms[toId(data)];
		if (!targetRoom) return; //nonexistent room
		targetRoom.join(user);
	},
};