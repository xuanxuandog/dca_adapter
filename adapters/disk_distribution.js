var util = require("../util")

var search = function(req, res) {
	//console.log(req.body)
	var result = ['cluster','teams'];
	res.send(JSON.stringify(result));
	res.end();
}

var query = function(req, res) {
	util.distribution(req, res, 'disk')
}

exports.search = search
exports.query = query
