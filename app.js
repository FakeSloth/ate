var io = require('socket.io').listen(8000),
	mongoose = require('mongoose'),
	jwt = require('jsonwebtoken'), // used to create, sign, and verify tokens
	bcrypt = require('bcrypt-nodejs');
mongoose.connect("mongodb://localhost/ate"); // connect to database
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback () {
  console.log("h");
});

var UserModel = require('./userModel.js'); // get our mongoose model
var superSecret = 'superSecret';
function string(str) {
	if (typeof str === 'string' || typeof str === 'number') return '' + str;
	return '';
}
function toId(text) {
	if (text && text.id) text = text.id;
	else if (text && text.userid) text = text.userid;
	return string(text).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

var userCount = 0;
function User() {
	this.name = "Guest" + (++userCount);
	this.userid = toId(this.name);
}
User.prototype.rename = function(name) {
	//if regged show them the prompt
	var userid = toId(name);
	var self = this;
	UserModel.findOne({
		userid: userid
	}, function(err, user) {
		if (err) throw err;
		if (!user) {
			console.log('there is no user called "' + name + '"');
			self.finishRename(name);
		}
		console.log("name is registered");
	});
};
User.prototype.finishRename = function(name, token) {
	var userid = toId(name);
	this.name = name;
	this.userid = userid;
	this.token = token;
	console.log("name::" + name +"\ntoken::"+token);
};
User.prototype.registerUser = function(name, password) {
	//creating a user
	var userid = toId(name);
	if (!userid) return console.log("That is not a valid name.");
	if (!password) return console.log("no password");
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
User.prototype.authenticate = function(name, password) {
	//authenticating a user with name and password
	var self = this;
	UserModel.findOne({
		userid: toId(name)
	}, function(err, user) {
		if (err) throw err;
		if (!user) {
			//authentication failed user not found
			console.log('there is no user called "' + name + '"');
			return;
		}
		function cb(err, match) {
			if (err) return console.log(err);
			if (match) {
				//wrong pass
				console.log('Authentication failed. Wrong password.');
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
User.prototype.authenticateToken = function(token) {
	//authenticating a user with a token
	jwt.verify(token, superSecret, function(err, decoded) {
		if (err) {
			//token couldnt be authenticated
			return console.log('Token could not be authenticated');
		}
		// if everything is good, save to request for use in other routes
		console.log("good:::" + decoded);
	});
};

var user = new User();
user.registerUser("DarkP00", "pooisdark");

io.sockets.on('connection', function (socket) {

});
