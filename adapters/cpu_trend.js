var _ = require('lodash');
var util = require("../util")

var query = function(req, res) {
	util.trend(req, res, 'cpu')
}

var annotation = function(req, res) {
	util.peak(req, res, 'cpu')
}

exports.query = query
exports.annotation = annotation