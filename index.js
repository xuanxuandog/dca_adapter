var express = require('express');
var bodyParser = require('body-parser');
var _ = require('lodash');
var app = express();
var http = require('http');
var request = require('request');
var zlib = require('zlib');
var moment = require('moment')
var Q = require('q')
var util = require('./util')
app.use(bodyParser.json());



var adapters = ['cpu_trend', 'memory_trend', 'disk_trend', 'disk_distribution', 'test', 'job_trend', 'job_count_trend']

_.each(adapters, function(adapterName) {
  
  var baseUrl = '/' + adapterName + '/'	
	
  //register connection testing function
  app.all(baseUrl, function(req, res) { 
	  res.send("it works")
	  res.end()
  });
  
  var adapter = require("./adapters/" + adapterName)

  //register search function
  app.all(baseUrl + 'search', function(req, res){
	  //console.log(req.body)
	  if (typeof adapter.search !== "undefined") { 
		  adapter.search(req, res)
	  } else {
	      util.autoComplete(req, res, ['host', 'app', 'hostgroup', 'component', 'account', 'lifecycle'])
	  }
	  
  });
  
  //register query function
  app.all(baseUrl + 'query', function(req, res){
	  //console.log(req.body)
	  adapter.query(req, res)
  });
  
  //register annotation function
  if (adapter.annotation) {
	  app.all(baseUrl + 'annotations', function(req, res){
		  adapter.annotation(req, res)
	  });
   }
});


app.listen(3333);

console.log("Server is listening");
util.test()
