function Socket() {
	var socket = io("http://elloworld.noip.me:8000/");

	socket.on('connect', function() {
		console.log('I AM CONNECTED!');
		ate.socketInitialized();
	});

	/**
	 * Retreiving an event.
	 *
	 * @param {Object or String} data
	 *
	 * The data should be one large string
	 * Example - event|data1|data2|data3\nevent|data1|data2
	 */

	socket.on('e', function(data) {
		console.log(data);
		var events = this.REFERENCE.events;
		if (typeof data === "string") {
			var eventos = data.split('\n');
			for (var eventKey in eventos) {
				var rows = eventos[eventKey].split('|');
				var event = rows[0];
				if (typeof events[event] === "string") event = events[event];
				if (events[event]) {
					events[event](rows);
				} else {
					events.c(("c||" + rows.join('|')).split("|"));
				}
			}
		} else {
			//just in case data has to come in as an object
			var event = data.event;
			if (events[data.event] === "string") event = events[data.event];
			if (events[event]) events[event](data);
		}
	});

	/**
	 * Emit an event.
	 *
	 * @param {String} event
	 * @param {Object} data
	 */

	this.emit = function(event, data) {
		var obj = {};
		if (typeof data === 'object') {
			obj = data;
		} else {
			obj.data = data;
		}
		obj.event = event;
		console.log(JSON.stringify(obj));
		socket.emit('e', obj);
	};
	this.socket = socket;
	this.socket.REFERENCE = this;
	return this;
}
Socket.prototype.events = {
	c: function(data) {
		function addLog(msg) {$('.logs').append('<div>' + msg + '</div>');}
		addLog(data[1] + ': ' + data[2]);
	},
	l: function(data) {
		function addLog(msg) {$('.logs').append('<div>' + msg + '</div>');}
		addLog(data[1] + ' left.');
	},
	j: function(data) {
		function addLog(msg) {$('.logs').append('<div>' + msg + '</div>');}
		addLog(data[1] + ' joined.');
	},
	init: function(data) {
		var title = data[1];
		var roomCount = $(".rooms .rel").length - 1; //-1 bcos the add room button counts
		$('.selectedRoom').removeClass('selectedRoom');
		var buff = $('<div class="rel"><h4>' + title + '</h4><span>x</span></div>').addClass("selectedRoom");
		if (roomCount === 0) {
			$('.rooms').prepend(buff);
		} else $('.rooms').last().before(buff);
		//put the focus on this room...
	},
	deinit: function() {},
	user: function(data) {
		ate.username = data[1];
		ate.updateHeader();
		ate.token = data[2];
		if (ate.username.substr(0, 5) !== "Guest") {
			cookie("username", ate.username);
		} else cookie("username", "");
		if (ate.token) cookie("token", ate.token);
	},
	tokenerror: 'nametaken',
	registername: 'nametaken',
	nameregged: 'nametaken',
	nametaken: function(data) {
		if (data.event === "tokenerror") {
			data[0] = "nametaken";
			if (cookie("username")) data[1] = cookie("username");
			cookie("token", ""); //remove token from cookies bcos it doesnt work
		}
		ate.prompt({
			type: data[0],
			username: data[1],
			err: data[2]
		});
	},
};
