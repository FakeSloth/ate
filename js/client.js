var ate = {
	init: function() {
		inputfocus = undefined;
		this.resize();
		this.updateHeader();
		this.domEvents();
		var globalRoom = this.createRoom("Global");
		globalRoom.focusRoom();
		
		ate.initial = {
			width: $("body").width(),
			height: $("body").height()
		};
		
		var t = new Date() / 1;
		var refreshLatency = 2.5 * 1000;
		var difference = t - Number(cookie("lastVisit"));
		if (difference < refreshLatency) {
			/* https://github.com/Automattic/engine.io/issues/257 */
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
			this.sent = [];
			this.scrollSent = 0;
			this.message = '';
			this.users = {};
		}
		Room.prototype.deinit = function() {
			if (ate.focusedRoom === this) {
				//focus another room
				var roomCount = Object.keys(ate.rooms).length - 1; //-1 bcos of global room doesnt count
				if (roomCount === 1) {
					//this is the only room left so focus global room
					ate.rooms.global.focusRoom();
				} else {
					//click on closest room button
					var nextButton = this.$button.next();
					if (nextButton.text() !== "+") { //dont be the add room button
						nextButton.click();
					} else this.$button.prev().click();
				}
			}
			if (this.$button) this.$button.remove();
			delete ate.rooms[this];
		};
		Room.prototype.focusRoom = function() {
			ate.focusedRoom = this;
			this.updateUsers();
			$(".logs").empty();
			for (var i = 0; i < this.logs.length; i++) {
				var msg = this.logs[i];
				if (msg.substr(0, 4) === "jls|") {
					this.parseJoinLeaves(msg);
					continue;
				}
				this.addLogDom(msg);
			}
			$(".logs").scrollTop($(".logs").prop("scrollHeight"));
			$(".message").val(this.message);
			
			if (this.$button) {
				$(".selectedRoom").removeClass("selectedRoom");
				$(this.$button).addClass("selectedRoom");
			}
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
					this.addJoin(username);
					break;
				case 'l':
					var userid = row[1];
					var username = this.users[userid];
					delete this.users[userid];
					this.updateUsers();
					this.addLeave(username);
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
					this.addLog(row.slice(1).join('|'));
					break;
				case '':
					this.addLog(escapeHTML(row.slice(1).join('|')));
					break;
				default:
					this.addLog('<code>' + escapeHTML(row.join('')) + '</code>');
					break;
				}
			}
		};
		Room.prototype.addChat = function(name, message, pm, deltatime) {
			this.addLog("<b>" + escapeHTML(name) + ':</b> ' + escapeHTML(message));
		};
		Room.prototype.joinLeaveTemplate = function() {
			var buff = $('<div><span class="jcont"><span class="jlog"></span> joined</span><span class="lcont"><span class="and"> AND </span><span class="llog"></span> left</span></div>');
			buff.find('.jcont').hide();
			buff.find('.lcont').hide();
			buff.find('.and').hide();
			return buff;
		};
		Room.prototype.addLeave = function(name) {this.addJoin(name, true);};
		Room.prototype.addJoin = function(name, leaving) {
			var e = 'j';
			if (leaving === true) e = 'l';
			var lastLogKey = this.logs.length - 1;
			var lastLog = this.logs[lastLogKey];
			var splint = (lastLog || '').split('|');
			var lastE = splint[0];
			var lastNames = splint[1];
			if (lastLog && lastE === 'jls') {
				lastNames = lastNames.split(',');
				for (var i = 0; i < lastNames.length; i++) {
					if (lastNames[i] === e + name) return; //already added a join/leave for user
				}
				this.logs[lastLogKey] += ',' + e + name;
				var lastLogDiv = $('.logs div').last();
				lastLogDiv.find('.' + e + 'cont').show();
				if (lastLogDiv.find('.jcont').css('display') !== 'none' && lastLogDiv.find('.lcont').css('display') !== 'none') {
					lastLogDiv.find('.and').show();
				}
				var log = lastLogDiv.find('.' + e + 'log');
				var comma = '';
				if (log.text()) comma = ', '; //if empty add comma
				log.append(comma + name);
			} else {
				this.logs.push('jls|' + e + name);
				var buff = this.joinLeaveTemplate();
				buff.find('.' + e + 'cont').show(); //only show the one just appended to
				buff.find('.' + e + 'log').append(name);
				this.addLogDom(buff);
			}
		};
		Room.prototype.parseJoinLeaves = function(str) {
			var namesStr = str.substr(4);
			var names = namesStr.split(',');
			var buff = this.joinLeaveTemplate();
			for (var i = 0; i < names.length; i++) {
				var e = names[i].substr(0, 1);
				var name = names[i].substr(1);
				buff.find('.' + e + 'cont').show();
				var log = buff.find('.' + e + 'log');
				var comma = '';
				if (log.text()) comma = ', '; //if empty add comma
				log.append(comma + name);
			}
			if (buff.find('.jcont').css('display') !== 'none' && buff.find('.lcont').css('display') !== 'none') {
				buff.find('.and').show();
			}
			this.addLogDom(buff);
		};
		Room.prototype.addLog = function(msg) {
			this.logs.push(msg);
			if (ate.focusedRoom !== this) return;
			this.addLogDom(msg);
		};
		Room.prototype.addLogDom = function(msg) {
			$('.logs').append($('<div></div>').append(msg));
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
		Room.prototype.addButton = function() {
			var roomCount = $(".rooms .rel").length - 1; //-1 bcos the add room button counts
			this.$button = buff = $('<div class="rel"><h4>' + title + '</h4><span>x</span></div>');
			if (roomCount === 0) {
				$('.rooms').prepend(buff);
			} else $('.rooms .rel').last().before(buff);
		};
		Room.prototype.send = function(msg) {
			this.sent.push(msg);
			this.scrollSent = this.sent.length;
			this.message = '';
			ate.socket.emit('c', {
				msg: msg,
				room: this.id
			});
		};
		Room.prototype.sendScrollDown = function() {this.sendScrollUp(true);};
		Room.prototype.sendScrollUp = function(down) {
			if (down) {
				this.scrollSent++;
				if (this.scrollSent > this.sent.length) this.scrollSent = this.sent.length;
			} else {
				this.scrollSent--;
				if (this.scrollSent < 0) this.scrollSent = 0;
			}
			var log = this.sent[this.scrollSent];
			if (log) {
				$('.message').val(log);
			} else $('.message').val(this.message);
		};

		var room = new Room(title);
		this.rooms[room.id] = room;
		if (title !== "Global") room.addButton();
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
		/* keyboard detection... since keyboards make the screen height REDICULOUSLY small... maybe i'll need it later idk
		if (ate.initial && helpers.isMobile()) {
			var percentChange = {
				width: Math.abs(100 - ($("body").width() / ate.initial.width * 100)),
				height: Math.abs(100 - ($("body").height() / ate.initial.height * 100))
			};
			if (percentChange.width < 1 && percentChange.height > 35) {
				//on keyboard popup DONT resize since there's only like 80 pixels to split in height afterwards
				return;
			}
		}
		*/
		
		$("#content").height($("body").height() - $("#content").offset().top);
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
		var el = $(start + buff + end).appendTo("body").find('input').last();
		if (!helpers.isMobile()) el.focus();
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
				//enter
				if (!this.value.trim().length) return false;
				var msg = this.value;
				ate.focusedRoom.send(msg);
				this.value = "";
				e.preventDefault();
			} else if (e.keyCode === 38) {
				//up
				ate.focusedRoom.sendScrollUp();
				e.preventDefault();
			} else if (e.keyCode === 40) {
				//down
				ate.focusedRoom.sendScrollDown();
				e.preventDefault();
			}
		}).on("keyup", ".message", function() {
			if (ate.focusedRoom.scrollSent !== ate.focusedRoom.sent.length) {
				//if your editing an old log don't set it as the current 'message'
				return;
			}
			ate.focusedRoom.message = this.value;
		}).on("click", ".rooms .rel", function() {
			if (this.innerHTML === "+") {
				//see other rooms tab thing
				return;
			}
			if ($(this).hasClass("selectedRoom")) return;
			ate.rooms[toId($(this).find('h4').text())].focusRoom();
		}).on("click", "#content", function(e) {
			//only focus on input if
				//shift key isn't being pressed
				//no selection is being made
			if (e.shiftKey || (window.getSelection && !window.getSelection().isCollapsed)) {
				return;
			}
			if (!helpers.isMobile()) $(".message").focus();
		}).on("keydown", function(e) {
			if (e.keyCode === 8 && !inputFocus) {
				//prevent backspace if not in input
				//this prevents accidental page disconnections with backspace
				e.preventDefault();
				e.stopPropagation();
			}
		}).on("click", ".rooms .rel span", function() {
			ate.rooms[toId($(this).parent().find('h4').text())].send('/leave');
		}).on("focus", "input, textarea", function() {
			inputFocus = this;
		}).on("blur", "input, textarea", function() {
			inputFocus = undefined;
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
