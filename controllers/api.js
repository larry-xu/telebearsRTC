var path = require('path')

  , mongoose = require('mongoose')

  , Section = require(path.join('..', 'models', 'Section'));

module.exports = function(app){
  app.get('/api/sections/:id/:course', function(req, res){
    var id = req.params.id
      , course = req.params.course;
    Section.find({classId: id + ' ' + course}, function(err, sections) {
      if(err){
        console.error('[API ERROR]', err);
      }
      res.set('Cache-Control','private');
      res.json(sections);
    });
  });

  app.get('/api/enrollment/:ccn', function(req, res) {
    Section.findOne({ccn: req.params.ccn}, function(err, section) {
      if(err){
        console.error('[API ERROR]', err);
      }
      res.set('Cache-Control','private');
      res.json(section);
    });
  });
};
