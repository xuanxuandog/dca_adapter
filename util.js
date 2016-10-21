var _ = require('lodash');
var http = require('http');
var request = require('request');
var zlib = require('zlib');
var moment = require('moment')
var Q = require('q')

var baseUrl = 'http://sha-icam-dev1:15003/adoptions/cdc/'

var appendTimeFilter = function(baseUrl, reqBody) {
	var url = baseUrl
	if (reqBody.range && reqBody.range.from) {
    	url += ('&startTime=' + moment(reqBody.range.from, 'YYYY-MM-DDTHH:mm:ss.SSSZ').utc().format('YYYY-MM-DD HH:mm:ss'))
    }
    if (reqBody.range && reqBody.range.to) {
    	url += ('&endTime=' + moment(reqBody.range.to, 'YYYY-MM-DDTHH:mm:ss.SSSZ').utc().format('YYYY-MM-DD HH:mm:ss'))
    }
	return url
}

var getInterval = function(from, to, _numOfPoint) {
	var toLong = 0
	var fromLong = 0
	var numOfPoint = 48
        if (_numOfPoint) {
          numOfPoint = _numOfPoint
        }
        if (from) {
	    fromLong = moment(from, 'YYYY-MM-DDTHH:mm:ss.SSSZ').utc()
	} else {
		fromLong = moment().utc().add(-24, 'h')
	}
	if (to) {
		toLong = moment(to, 'YYYY-MM-DDTHH:mm:ss.SSSZ').utc()
	} else {
		to = moment().utc()
	}
	var unitMapping = [[60, 3600, 'm'], [3600, 86400, 'h'], [86400, 604800, 'd'], [604800, 2592000, 'w']
	, [2592000, 31104000, 'M'], [31104000, 311040000, 'y']]
	  
	var gap = (toLong - fromLong) / 1000 / numOfPoint
	var interval = ''
	_.each(unitMapping, function(unit) {
		if (gap >= unit[0] && gap <= unit[1]) {
			interval = (Math.floor(gap / unit[0]) + unit[2])
			return 
		}
	});
	if (interval == '') {
		//gap not in range of 1 mintue to 10 years
		if (gap < 60) {
			interval = '1m'
		} else if (gap > 311040000) {
			interval = '10y'
		}
	}
	return interval
}
	
var requestWithEncoding = function(options, callback) {
  console.log("url=" + options.url)
  var req = request(options);

  req.on('response', function(res) {
    var chunks = [];
    res.on('data', function(chunk) {
      chunks.push(chunk);
    });

    res.on('end', function() {
      var buffer = Buffer.concat(chunks);
      var encoding = res.headers['content-encoding'];
      if (encoding == 'gzip') {
        zlib.gunzip(buffer, function(err, decoded) {
          callback(err, decoded && decoded.toString());
        });
      } else if (encoding == 'deflate') {
        zlib.inflate(buffer, function(err, decoded) {
          callback(err, decoded && decoded.toString());
        })
      } else {
        callback(null, buffer.toString());
      }
    });
  });

  req.on('error', function(err) {
    callback(err);
  });
}

var distinct = function(req, type, callback) {
	var url = baseUrl + 'distinctValues?index=';
	url += type
	var req_options={
	  url: url,
      method: 'GET'
	};
	requestWithEncoding(req_options, function(err, resStr) {
		var list = JSON.parse(resStr);
		callback(list)
	});
}

/*
 * get trend data for type = cpu/memory/disk
 */
var trend = function(req, res, type) {
	var reqBody = req.body
	
	var targets = reqBody.targets

	var promises = []
        var numOfPoints = 48
        if (type == 'cpu' || type == 'memory') {
          numOfPoints = 96
        }
	var interval = getInterval(reqBody.range.from, reqBody.range.to, numOfPoints) 

	_.each(targets, function(target) {
	    var url = baseUrl + 'adHocQuery?resource=' + type
	    url += ('&interval=' + interval)	
	    
	    url = appendTimeFilter(url, reqBody)
	   
	    var moreFilters = target.target.split(",")
	    _.each(moreFilters, function(f){
	    	url += ('&' + f)
	    });
		var req_options={
		  url: url,
	      method: 'GET'
		};

		var deferred = Q.defer();
	    requestWithEncoding(req_options, function(err, resStr) {
	      
		  var list = JSON.parse(resStr);
          list = list[0]
		  
		  /*
		   * result format:
		   * {
		   *   "target":"hostname/cluster",
		   *   "datapoints":[[value, time], [value, time]]
		   * }
		   */
		  var result = {}
		  result.datapoints = []
	      _.each(list, function(elem) {
	    	  var timepoint = [];
    		  timepoint.push(elem.data);
    		  timepoint.push(parseInt(elem.time));
    		  result.datapoints.push(timepoint)
    		  if (!result.target) {
                  result.target = target.target
	    	  }
	      });
	      deferred.resolve(result)
		  
	    });
	    promises.push(deferred.promise)
    });
	Q.allSettled(promises).then(function(results) {
		var ret = []
		_.each(results, function(result){
			ret.push(result.value)
		})
		res.send(ret)
		res.end()
	})
}

var distribution = function(req, res, type) {
	var reqBody = req.body
	
	var targets = reqBody.targets
	var promises = []
	
	_.each(targets, function(target) {
		var url = baseUrl + 'snapShots?'
		if (type == 'disk' && target.target == 'cluster') {
			url += 'index=disk'
		} else if (type == 'disk' && target.target == 'teams') {
			url += 'index=funcUnitDisk'
		} else {
			url += 'index=disk'
		}
		var req_options={
		  url: url,
		  method: 'GET'
	    };
        var deferred = Q.defer();
        
        requestWithEncoding(req_options, function(err, resStr) {
        	var result = []
            var list = JSON.parse(resStr)
            _.each(list, function(item){
            	result.push({target:item.name, datapoints:[[item.data]]})
            })
            deferred.resolve(result)
        });
        promises.push(deferred.promise)
	});
    Q.allSettled(promises).then(function(results) {
    		var ret = []
    		_.each(results, function(result){
    			ret.push(result.value)
    		})
    		if (ret.length == 1) {
    			res.send(ret[0])
    		} else {
    			res.send(ret)
    		}
    		res.end()
    })
}

var annotation = {
  name : "annotation name",
  enabled: true,
  datasource: "generic datasource", 
  showLine: true,
}


var peak = function(req, res, type) {
	var reqBody = req.body
	var url = baseUrl + 'get_cdc_peaks?interval=' + getInterval(reqBody.range.from, reqBody.range.to)
	url = appendTimeFilter(url, reqBody)
	url += ('&resource=' + type)
	url += '&level=process'
	var req_options={
		  url: url,
		  method: 'GET'
	};
    requestWithEncoding(req_options, function(err, resStr) {
    	var result = []
    	
        var list = JSON.parse(resStr)
        _.each(list, function(timepoint){
        	if (type == 'disk') {
	        	_.each(timepoint.peaks, function(peak){
	        		var title = ''
	        		
        			title = 'Volume ' + peak.path 
        			if (peak.usedDiff && peak.usedDiff > 0) {
        				var num = peak.usedDiff / 1000 / 1000
            			title += (' increased by ' + num.toFixed(0) + ' TB')
            		} else if (peak.usedDiff && peak.usedDiff < 0) {
            			var num = peak.usedDiff * -1 / 1000 / 1000
            			title += (' decreased by ' + num.toFixed(0) + ' TB')
            		}
	        		 
	        		
	        		result.push(
	        				{
	        					annotation:annotation, 
	        					"title":title,
	        					"time":parseInt(timepoint.time),
	        				}
	        		);
	        	});
            } else {
            	title = timepoint.resource + ":" + timepoint.hostname
            	result.push({
            		annotation:annotation,
            		"title":title,
            		"time":timepoint.startTimeInMil
            	});
            }
        });
    	res.send(result)
    	res.end()
    })
}

var autoComplete = function(req, res, keys) {
	var promises = []
	var total = []
	_.each(keys, function(key) {
		var deferred = Q.defer();
		distinct(req, key, function(result){
			_.each(result, function(r){
				total.push(key + "=" + r)
			});
			deferred.resolve(1)
		})
		promises.push(deferred.promise)
	})
	Q.allSettled(promises).then(function(results) {
		res.send(total)
		res.end()
	})
	
}

var test = function(){
	
}

exports.trend = trend
exports.distribution = distribution
exports.peak = peak
exports.distinct = distinct
exports.test = test
exports.autoComplete = autoComplete
