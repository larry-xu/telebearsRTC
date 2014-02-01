var mongojs = require('mongojs');
if(process.env.MONGOHQ_URL)
  var mongourl = process.env.MONGOHQ_URL
else
  var mongourl = 'mydb';
var db = mongojs(mongourl, ['departments']);

var cheerio = require('cheerio')
  , request = require('request')
  , semester = process.env.SEMESTER
  , year = process.env.YEAR;

var load_section_list = function(id, course, callback){
  var courses = []
    , url = 'http://osoc.berkeley.edu/OSOC/osoc?p_term=' + semester + '&p_course=' + course + '&p_dept=' + id;

  request.get(url, function(error, res, body){
    if(!error && res.statusCode == 200){
      var $ = cheerio.load(body)
        , end = $('table').length - 1
        , index = 0;

      $('table').slice(1,end).each(function(){
        var data = {}
          , section = $(this).find('tr:nth-of-type(1) td:nth-of-type(3)').text().trim()
          , space = section.lastIndexOf(' ');
        data.index = index;
        for(var i = 0; i < 2; i++) {
          space = section.lastIndexOf(' ', space-1);
        }
        var section_id = section.substring(space+1)
          , section_index = section.indexOf(course.toUpperCase());
        if(section.charAt(section_index-1) == ' ' && section.charAt(section_index+course.length) == ' '){
          data.section = section_id;
          data.instructor = $(this).find('tr:nth-of-type(3) td:nth-of-type(2)').text();
          var restrictions = $(this).find('tr:nth-of-type(8) td:nth-of-type(2)').text()
            , location = $(this).find('tr:nth-of-type(2) td:nth-of-type(2)').text();
          if(location != 'CANCELLED' && restrictions != 'CURRENTLY NOT OPEN'){
            var locationArray = location.split(', ');
            data.time = locationArray[0];
            data.location = locationArray[1];
            data.ccn = $(this).find('input[name="_InField2"]').val();
            courses.push(data);
            index++;
          }
        }
      });
      callback(courses);
    }
    else{
      console.log('Error: ' + error);
    }
  });
};

var load_enrollment_data = function(ccn,callback) {
  request.post('https://telebears.berkeley.edu/enrollment-osoc/osc',
    {
      form:{
        _InField1:'RESTRIC',
        _InField2: ccn,
        _InField3: year
      }
    },
    function(error, res, body) {
    if (!error && res.statusCode == 200) {
      var $ = cheerio.load(body);
      var divText = $('blockquote:first-of-type div.layout-div').text();
      divText = divText.replace(/(\r\n|\n|\r)/gm,'');
      divText = divText.replace(/\s+/g,' ');
      divText = divText.substring(1);
      var textArray = divText.split(' ');
      var enrollData = {};
      enrollData.ccn = parseInt(ccn,10);
      enrollData.enroll = parseInt(textArray[0],10);
      enrollData.enrollLimit = parseInt(textArray[8],10);
      if(textArray[21] != null) {
        enrollData.waitlist = parseInt(textArray[10],10);
        enrollData.waitlistLimit = parseInt(textArray[21]);
      }
      callback(enrollData);
    }
    else{
      console.log('Error: ' + error);
    }
  });
};

module.exports = function(app){
  app.get('/api/sections/:id/:course', function(req, res){
    var id = req.params.id;
    var course = req.params.course;
    load_section_list(id, course, function(result){
      res.set('Cache-Control','private');
      res.json(result);
    });
  });
  app.get('/api/enrollment/:ccn', function(req, res) {
    var ccn = req.params.ccn;
    load_enrollment_data(ccn, function(result) {
      res.set('Cache-Control','private');
      res.json(result);
    });
  });
  app.get('/api/autocomplete', function(req, res) {
    var result = [];
    db.departments.find().sort({name: 1}, function(err, data) {
      if(err || !data) console.log('DB error');
      else {
        for(var i = 0; i < data.length; i++) {
          var abb = data[i].abbreviation;
          var aliases = { 'BIO ENG': 'BIOE',
                      'CHM ENG': 'CHEME',
                      'CIV ENG': 'CEE',
                      'COMPSCI': 'CS',
                      'EL ENG': 'EE',
                      'ENGIN': 'E',
                      'IND ENG': 'IEOR',
                      'INTEGBI': 'IB',
                      'MAT SCI': 'MSE',
                      'MEC ENG': 'ME',
                      'MCELLBI': 'MCB',
                      'NWMEDIA': 'CNM',
                      'NUC ENG': 'NUCE',
                      'NUSCTX': 'NST',
                      'STAT': 'STATS' };
          if(abb in aliases) {
            result.push(aliases[abb]);
            for(var j = 0; j < data[i].courses.length; j++) {
              var alias_datum = {};
              var alias_course = aliases[abb] + ' ' + data[i].courses[j].course;
              alias_datum.value = alias_course;
              alias_datum.tokens = alias_course.split(' ');
              result.push(alias_datum);
            }
          }
          result.push(abb);
          for(var j = 0; j < data[i].courses.length; j++) {
            var datum = {};
            var course = abb + ' ' + data[i].courses[j].course;
            datum.value = course;
            datum.tokens = course.split(' ');
            result.push(datum);
          }
        }
        res.json(result);
      }
    });
  });
};