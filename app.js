var express = require('express')
  , path = require('path')
  , url = require('url')

  , enrouten = require('express-enrouten')
  , flash = require('connect-flash')
  , helmet = require('helmet')

  , passport = require('.' + path.sep + path.join('lib', 'auth'))
  , mongoose = require('mongoose')
  , RedisStore = require('connect-redis')(express)

  , jade = require('jade')
  , stylus = require('stylus')
  , nib = require('nib');

mongoose.connect(process.env.MONGOLAB_URI || 'mongodb://localhost/telebearsRTC', {
  server: {
    socketOptions: {
      keepAlive: 1
    }
  }
});

var app = express();
app.set('port', process.env.PORT || 3000);

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.set('views', path.join(__dirname, 'views'));

if('production' == app.get('env')){
  app.use(express.compress());
}

helmet.defaults(app);

app.locals.pretty = true;
app.use(express.logger('dev'));
app.use(express.favicon(path.join(__dirname, 'public', 'images', 'favicon.ico')));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(require('stylus').middleware(__dirname + '/public'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(stylus.middleware({
  src: path.join(__dirname, 'public'),
  compile: function (str, path) {
    return stylus(str)
      .set('filename', path)
      .set('compress', true)
      .use(nib());
  }
}));

if('production' == app.get('env')){
  app.use(express.static(path.join(__dirname, '.build')));
} else {
  app.use(express.static(path.join(__dirname, 'public')));
}

var redis_url = url.parse(process.env.REDISTOGO_URL || 'redis://telebearsRTC:@127.0.0.1:6379')
  , redis_auth = redis_url.auth.split(':');

app.use(express.cookieParser());
app.use(express.session({
  secret: 'yellow colourblind submarine',
  store: new RedisStore({
    host: redis_url.hostname,
    port: redis_url.port,
    db: redis_auth[0],
    pass: redis_auth[1]
  })
}));

app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

app.use(app.router);
app.get('/about', function(req, res){
  res.render('about', {
    title: 'About',
    semester: process.env.ENROLLMENT_PERIOD || 'Spring 2014'
  });
});
app.get('/contact', function(req, res){
  res.render('contact', {
    title: 'Contact'
  });
});

app.use(enrouten({
  directory: 'controllers'
}));
app.use(function(req, res, next){
  try{
    res.render(path.join(app.get('views'), url.parse(req.url).pathname.substr(1)));
  }
  catch(e){
    next();
  }
});

if('production' == app.get('env')){
  app.use(function(err, req, res, next){
    if(err.message.indexOf('Failed to lookup view') != -1 && err.view){
      res.status(404).render('404', {code: 404, title: 'Errorrrrrrrr'});
    }
    else{
      console.error('[ORBIT ERR]', err);
      res.status(500).render('500', {code: 500, title: 'Errorrrrrrrr'});
    }
  });
} else {
  app.use(express.errorHandler());
}

module.exports = app;
