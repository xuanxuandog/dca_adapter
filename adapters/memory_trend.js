var util = require("../util")

var query = function(req, res) {
	util.trend(req, res, 'memory')
}

var annotation = function(req, res) {
	util.peak(req, res, 'memory')
}

exports.query = query
exports.annotation = annotation