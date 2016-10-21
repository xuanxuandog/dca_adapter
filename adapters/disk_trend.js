var util = require("../util")

var query = function(req, res) {
	util.trend(req, res, 'disk')
}

var annotation = function(req, res) {
	util.peak(req, res, 'disk')
}

exports.query = query
exports.annotation = annotation