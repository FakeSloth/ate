global.rooms = {};
function Room(title) {
	this.title = title;
	this.id = toId(title);
	this.log = [];
	this.users = {};
	rooms[this.id] = this;
	return this;
}
Room.prototype.addLog = function(msg) {
	this.log.push(msg);
	this.send(msg);
};
Room.prototype.send = function(originalMessage, exact) {
	var msg = '';
	if (!exact) msg = 'c|';
	if (this.id !== 'lobby') msg += this.id + '\n';
	msg += originalMessage;
	var userKeys = Object.keys(this.users);
	var userCount = userKeys.length;
	for (var i = 0; i < userCount; i++) this.users[userKeys[i]].send(msg);
};
Room.prototype.join = function(user) {
	var joined = this.users[user.userid];
	if (joined) {
		//you've already joined this room
		return;
	}
	user.rooms[this.id] = true;
	this.users[user.userid] = user;
	user.send('init|' + this.title); //give users list and logs next
	this.send('j|' + user.name, true);
};
Room.prototype.leave = function(user) {
	var joined = this.users[user.userid];
	if (!joined) {
		//you're not even in this room
		return;
	}
	delete user.rooms[this.id];
	delete this.users[user.userid];
	if (user.connected) user.send('deinit|' + this.id, true);
	this.send('l|' + user.name, true);
};
(function initializeRooms() {
	var defaultRooms = [{
		title: 'Lobby',
	}, {
		title: 'Staff',
	}];
	for (var i = 0; i < defaultRooms.length; i++) {
		var room = defaultRooms[i];
		new Room(room.title);
	}
})();

module.exports = Room;
