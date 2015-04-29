var ate = {
	init: function() {
		this.resize();
		this.updateHeader();
		this.domEvents();
		this.socket = new Socket();
	},
	rooms: new Object(),
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
					room: 'lobby'
				});
				this.value = "";
				return false;
			}
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
