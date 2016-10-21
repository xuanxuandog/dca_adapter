var util = require("../util")

var query = function(req, res) {
	util.trend(req, res, 'jobCount')
}

exports.query = query
