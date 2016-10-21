var util = require("../util")

var query = function(req, res) {
	util.trend(req, res, 'jobTime')
}

exports.query = query