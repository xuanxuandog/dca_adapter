
var search = function(req, res) {
	res.send(['a'])
	res.end()
}

var query = function(req, res) {
	res.send([{target:'a', datapoints:[['c1',10],['c2',15]]}])
	res.end()
}

exports.search = search
exports.query = query