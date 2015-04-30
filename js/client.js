var ate = {
	init: function() {
		var t = new Date() / 1;
		this.resize();
		this.updateHeader();
		this.domEvents();
		
		var refreshLatency = 2.5 * 1000;
		var difference = t - Number(cookie("lastVisit"));
		if (difference < refreshLatency) {
			//hack to prevent refresh while on polling transport
			//usually if you refresh too fast the sockets won't disconnect and'll bug everything out .-.
			var self = this;
			setTimeout(function() {
				self.socket = new Socket();
			}, refreshLatency - difference);
		} else this.socket = new Socket();
		cookie("lastVisit", t);
	},
	rooms: new Object(),
	focusedRoom: undefined,
	createRoom: function(title) {
		function Room(title) {
			this.title = title;
			this.id = toId(title);
			this.logs = [];
			this.users = {};
		}
		Room.prototype.deinit = function() {
		
		};
		Room.prototype.focusRoom = function() {
			ate.focusedRoom = this;
			this.updateUsers();
			$(".logs").empty();
			for (var i = 0; i < this.logs.length; i++) this.addLogDom(this.logs[i]);
			$(".logs").scrollTop($(".logs").prop("scrollHeight"));
			$(".message").val("");
		};
		Room.prototype.receive = function(log) {
			if (typeof log === 'string') log = log.split('\n');
			var autoscroll = false;
			if ($('.logs').scrollTop() + 60 >= $('.logs').prop("scrollHeight") - $('.chat').height()) {
				autoscroll = true;
			}
			var userlist = '';
			for (var i = 0; i < log.length; i++) {
				if (log[i].substr(0,6) === 'users|') {
					userlist = log[i];
				} else {
					this.addRow(log[i]);
				}
			}
			if (userlist) this.addRow(userlist);
			if (autoscroll) {
				$('.logs').scrollTop($('.logs').prop("scrollHeight"));
			}
			var $children = $('.logs').children();
			if ($children.length > 900) {
				$children.slice(0,100).remove();
			}
		};
		Room.prototype.addRow = function(line) {
			var name, name2, room, action, silent, oldid;
			if (line && typeof line === 'string') {
				var row = line.split('|');
				switch (row[0]) {
				case 'c':
					if (/[a-zA-Z0-9]/.test(row[1].charAt(0))) row[1] = ' '+row[1];
					this.addChat(row[1], row.slice(2).join('|'));
					break;
				case 'j':
					var username = row[1];
					this.users[toId(username.substr(1))] = username;
					this.updateUsers();
					this.addLog(escapeHTML(username) + ' joined.');
					break;
				case 'l':
					var userid = row[1];
					var username = this.users[userid];
					delete this.users[userid];
					this.updateUsers();
					this.addLog(escapeHTML(username) + ' left.');
					break;
				case 'n':
					var identity = row[1];
					var olduserid = row[2];
					delete this.users[olduserid];
					this.users[toId(identity.substr(1))] = identity;
					this.updateUsers();
					break;
				case 'users':
					var users = row[1].split(',');
					for (var i = 0; i < users.length; i++) {
						var username = users[i];
						var userid = toId(username.substr(1));
						this.users[userid] = username;
					}
					this.updateUsers();
					break;
				case 'raw':
					this.addLog(escapeHTML(row.slice(1).join('|')));
					break;
				case '':
					this.addLog(escapeHTML(row.slice(1).join('|')));
					break;
				default:
					this.addLog('<code>|' + escapeHTML(row.join('|')) + '</code>');
					break;
				}
			}
		};
		Room.prototype.addChat = function(name, message, pm, deltatime) {
			this.addLog(escapeHTML(name) + ': ' + escapeHTML(message));
		};
		Room.prototype.addLog = function(msg) {
			this.logs.push(msg);
			if (ate.focusedRoom !== this) return;
			this.addLogDom(msg);
		};
		Room.prototype.addLogDom = function(msg) {
			$('.logs').append('<div>' + msg + '</div>');
		};
		Room.prototype.updateUsers = function() {
			if (ate.focusedRoom !== this) return;
			var buff = '';
			var keys = Object.keys(this.users);
			for (var i = 0; i < keys.length; i++) {
				var userid = keys[i];
				var name = this.users[userid];
				buff += '<div>' + escapeHTML(name) + '</div>';
			}
			$('.users').html(buff);
		};
		
		var roomCount = $(".rooms .rel").length - 1; //-1 bcos the add room button counts
		$('.selectedRoom').removeClass('selectedRoom');
		var buff = $('<div class="rel"><h4>' + title + '</h4><span>x</span></div>').addClass("selectedRoom");
		if (roomCount === 0) {
			$('.rooms').prepend(buff);
		} else $('.rooms .rel').last().before(buff);

		var room = new Room(title);
		this.rooms[room.id] = room;
		return room;
	},
	socketInitialized: function() {
		if (cookie("token")) {
			this.socket.emit('tokenrename', {token: cookie("token")});
		} else if (cookie("username")) {
			this.socket.emit('nametaken', {username: cookie("username")});
		}
		this.socket.emit('c', {msg: '/join lobby'});
	},
	resize: function() {
		var smallRightSide = 300,
			bigRightSide = 600;
		var rightSideWidth = smallRightSide;
		var leftSideWidth = $("body").width() - rightSideWidth;
		var leftSideWidthWITHbigRight = $("body").width() - bigRightSide;
		if (leftSideWidth >= 700 && leftSideWidthWITHbigRight >= 500) {
			rightSideWidth = bigRightSide;
			leftSideWidth = leftSideWidthWITHbigRight;
		}
		$("#rightSide").width(rightSideWidth);
		$("#leftSide").width(leftSideWidth);
		
		var headerHeight = $(".header").height(),
			roomsHeight = $(".rooms").height(),
			inputHeight = $(".input").height(),
			usersWidth = $(".users").width();
		var chatHeight = $("body").height() - (headerHeight + roomsHeight);
		var logsWidth = leftSideWidth - usersWidth;
		var logsHeight = chatHeight - inputHeight;
		$(".chat").height(chatHeight);
		$(".logs").height(logsHeight).width(logsWidth);
		$(".input").width(logsWidth);
	},
	updateHeader: function() {
		var buff = '';
		buff += '<span>' + this.username + '</span>';
		if (!this.username || this.username.substr(0, 5) === "Guest") {
			buff = '<button onclick="ate.prompt(\'nametaken\');">Choose Name</button>';
		}
		$(".userbar").empty().html(buff);
	},
	promptCount: 0,
	prompt: function(type, opaqueness) {
		var data = {};
		if (type.type) {
			var data = type;
			var type = data.type;
		}
		var id = ++this.promptCount;
		var buff = '';
		var start = '';
		var end = '';
		if (opaqueness !== false) {
			start = '<div id="p' + id + '" class="opaqueness">';
			end = '</div>';
		}
		buff += '<div class="popup"><div class="form"><input type="hidden" name="formType" value="' + type + '" />';
		if (type === "nametaken") {
			if (data.err) buff += '<p class="err">' + data.err + '</p>';
			buff += '<p>';
			buff += '<label>Username: <input name="username" type="text" onkeypress="ate.onEnterSubmit(event, this);" /></label>';
			buff += '</p>';
			buff += '<div class="buttons"><button class="submit">Choose Name</button> <button onclick="$(\'#p' + id + '\').mouseup();">Cancel</button></div>';
		} else if (type === "nameregged") {
			if (data.err) buff += '<p class="err">' + data.err + '</p>';
			buff += '<p>';
			buff += '<label>Username: <input type="hidden" name="username" value="' + data.username + '" /><label>' + data.username + '</label></label>';
			buff += '</p>';
			buff += '<p>';
			buff += '<label>Password: <input name="password" type="password" onkeypress="ate.onEnterSubmit(event, this);" /></label>';
			buff += '</p>';
			buff += '<div class="buttons"><button class="submit">Choose Name</button> <button onclick="$(\'#p' + id + '\').mouseup();">Cancel</button></div>';
		} else if (type === "registername") {
			if (data.err) buff += '<p class="err">' + data.err + '</p>';
			buff += '<p>';
			buff += '<label>Username: <input type="hidden" name="username" value="' + data.username + '" /><label>' + data.username + '</label></label>';
			buff += '</p>';
			buff += '<p>';
			buff += '<label>Password: <input name="password" type="password" onkeypress="ate.onEnterSubmit(event, this);" /></label>';
			buff += '</p>';
			buff += '<div class="buttons"><button class="submit">REGISTER</button> <button onclick="$(\'#p' + id + '\').mouseup();">Cancel</button></div>';
		}
		buff += '</div></div>';
		$(start + buff + end).appendTo("body").find('input').last().focus();
	},
	closePrompt: function(id) {
		$("#p" + id).remove();
	},
	domEvents: function() {
		$(window).on('resize', this.resize);
		$("body").on("mouseup touchend", ".opaqueness", function(e) {
			if (e.target.id !== this.id || e.which === 3) return;
			ate.closePrompt(this.id.replace('p', ''));
		}).on("click", ".popup .submit", function() {
			var popup = $(this).closest('.popup');
			var data = {};
			var inputs = popup.find('input');
			//construct data with form elements
			for (var i in inputs) {
				if (isNaN(i)) continue;
				var el = inputs[i];
				data[el.name] = el.value;
			}
			popup.closest('.opaqueness').mouseup();//remove popup
			var event = data.formType;
			delete data.formType;
			ate.socket.emit(event, data);
		}).on("keydown", ".message", function(e) {
			if (e.keyCode === 13) {
				if (!this.value.trim().length) return false;
				ate.socket.emit('c', {
					msg: this.value,
					room: ((ate.focusedRoom) ? ate.focusedRoom.id : '')
				});
				this.value = "";
				return false;
			}
		}).on("click", ".rooms .rel", function() {
			if (this.innerHTML === "+") {
				//see other rooms tab thing
				return;
			}
			if ($(this).hasClass("selectedRoom")) return;
			$(".selectedRoom").removeClass("selectedRoom");
			$(this).addClass("selectedRoom");
			ate.rooms[toId($(this).find('h4').text())].focusRoom();
		}).on("click", "#content", function(e) {
			//only focus on input if
				//shift key isn't being pressed
				//no selection is being made
			if (e.shiftKey || (window.getSelection && !window.getSelection().isCollapsed)) {
				return;
			}
			$(".message").focus();
		});
	},
	onEnterSubmit: function(e, el) {
		if (e.keyCode === 13) {
			var closestSubmit = $(el).closest('.popup').find('.submit');
			closestSubmit.click();
		}
	},
};
$(function() {
	ate.init();
});
