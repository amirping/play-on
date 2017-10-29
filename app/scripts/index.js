const remote = require('electron').remote;
const {dialog} = require('electron').remote;
const shell = require('electron').remote.shell;
var mainWindow = require('electron').remote.getCurrentWindow();
var fs = require('fs');
var mm = require('musicmetadata');
var Datastore = require('nedb');
// end loader
var table_of_pic;
var app = angular.module('playon', ["ngAnimate", "ngMaterial","ngAria",  "rzModule", 'angular-loading-bar'])
  .filter('secondsToDateTime', [function() {
    return function(seconds) {
      return new Date(1970, 0, 1).setSeconds(seconds);
    };
  }])
  .filter("trackTime", function(){
      /* Conveniently takes a number and returns the track time */
      return function(input){
          var totalSec = Math.floor(input | 0);

          var output = "";
          var hours = 0;
          var minutes = 0;
          var seconds = 0;

          if (totalSec > 3599) {

              hours = Math.floor(totalSec / 3600);
              minutes = Math.floor((totalSec - (hours * 3600)) / 60);
              seconds = (totalSec - ((minutes * 60) + (hours * 3600)));
              if (hours.toString().length == 1) {
                  hours = "0" + (Math.floor(totalSec / 3600)).toString();
              }
              if (minutes.toString().length == 1) {
                  minutes = "0" + (Math.floor((totalSec - (hours * 3600)) / 60)).toString();
              }
              if (seconds.toString().length == 1) {
                  seconds = "0" + (totalSec - ((minutes * 60) + (hours * 3600))).toString();
              }
              output = hours + ":" + minutes + ":" + seconds;
          } else if (totalSec > 59) {
              minutes = Math.floor(totalSec / 60);
              seconds = totalSec - (minutes * 60);
              if (minutes.toString().length == 1) {
                   minutes = "0" + (Math.floor(totalSec / 60)).toString();
              }
              if (seconds.toString().length == 1) {
                   seconds = "0" + (totalSec - (minutes * 60)).toString();
              }
              output = minutes + ":" + seconds;
          } else {
              seconds = totalSec;
              if (seconds.toString().length == 1) {
                  seconds = "0" + (totalSec).toString();
              }
              output = totalSec + "s";
          }
          if (typeof Number.isNaN === "function" && Number.isNaN(output)){
              debugger;
          }
          return output;
      }
  })
  .directive('backImg', function($timeout, $interval) {
    // improve 28/08/2017 => use the media duration to change the pic -- progress 80 %
    // FIXME: changing pic when media change not fast
    // FIXME: the analyser didnt update in some case
    return function(scope, element, attrs) {
      var value;
      var changer;
      var fixtimer = 5000;
      var duration;

      function diap_changer() {
        changer = $interval(function() {
          if (!angular.isUndefined(scope.media.duration())) {
            duration = scope.media.duration();
            console.log(duration);
            if (duration > 10 && (fixtimer == 5000 || !(fixtimer != (duration * 1000) / 20))) {
              fixtimer = (duration * 1000) / 20;
              console.log(fixtimer);
              console.log("time changed recall the function with new timer ");
              $interval.cancel(changer);
              diap_changer();
            }
          }
          element.css({
            'background-image': 'url(' + value[0] + ')',
            'background-size': 'cover',
            'background-repeat': 'no-repeat',
            'background-position': 'center center',
            'transition': 'all 1000ms'
          });
          $timeout(function() {
            scope.watcher_view_updater();
            element.css({
              'background-image': 'url(' + value[1] + ')',
              'background-size': 'cover',
              'background-repeat': 'no-repeat',
              'background-position': 'center center',
              'transition': 'all 1000ms'
            });
          }, fixtimer);
        }, fixtimer * 2);
      }
      attrs.$observe('backImg', function(selected) {
        if (!angular.isUndefined(changer)) {
          console.log("remove old diaporama");
          $interval.cancel(changer);
        }
        if (angular.isDefined(scope.list[selected].more_pic) && scope.user_config.diparama == true) {
          console.log("multi pic");
          value = scope.list[scope.play_c].more_pic;
          diap_changer();
        } else {
          console.log("only one pic");
          value = scope.list[scope.play_c].pic;
          element.css({
            'background-image': 'url(' + value + ')',
            'background-size': 'cover',
            'background-repeat': 'no-repeat',
            'background-position': 'center center',
            'transition': 'all 1000ms'
          });
        }
      });
    };
  })
  .config(['cfpLoadingBarProvider', function(cfpLoadingBarProvider) {
    cfpLoadingBarProvider.includeSpinner = false;
    // cfpLoadingBarProvider.parentSelector = '#control-player';
  }])
  .controller('mainctrl', ["$scope", "$timeout", "$q",'$http', "$window", '$interval', '$mdSidenav', '$mdDialog', '$mdToast', function($scope, $timeout, $q, $http, $window, $interval, $mdSidenav, $mdDialog, $mdToast) {
    var window = remote.getCurrentWindow();
    // NOTE: load the data of user_config from the local data base
    $scope.user_config =
    {
      'deafult_folder':'',
      'internet_fetch':true,
      'animation':'draw2',
      'diparama':true
    }
    $scope.current = {
      'view': 'scripts/sub-view/wlc.html',
      'play': 'empty'
    }
    $scope.vals = {
      'volume': '1',
      'pos': '0',
      'ready': false,
      'mute': false,
      'visualizer_height': 50, // visualizer
      'visualizer_width': 0, // visualizer
      'bufferLength': 0,
      'dataArray': '',
      'repeat': false,
      'suffle': false,
      'title_div': '', // to much the title width with the visualizer
      'animation_ready': false,
      'editList':false
    }
    $scope.visualizer;
    $scope.bg_color_list = ['rgba(155,89,182,0.49)', 'rgba(230,28,82,0.49)', 'rgba(149,165,166,0.49)'];
    $scope.bg_image_list = ['url(img/asfalt-light.png)', 'url(img/cartographer.png)', 'url(img/clean-gray-paper.png)', 'url(img/diagmonds.png)'];
    $scope.overlay_bc;
    $scope.overlay_bi;
    $scope.play_c = "";
    $scope.media;
    $scope.max = 0;
    $scope.hidevolume = true;
    $scope.readonly = true;
    $scope.list = {};
    $scope.greeting = 'Welcome!';
    $scope.analyser = "";
    $scope.maxormin = false; // true is fullscreen
    // $scope.list_is_open = false; removed and the side list now use function
    $scope.searchString = "";
    $scope.appInfo = {
      version: 'v 0.0.1',
      versionState: 'beta',
      owner: 'Saadallah Med Amir',
      email: 'amirs-m-s@live.com',
      animation_styles:[{fn:'draw',name:'full line animation'},{fn:'draw1',name:'moderne visualizer'},{fn:'draw2',name:'Electro mode'}]
    }
    $scope.showVolume = function() {
      $scope.hidevolume ? $scope.hidevolume = false : $scope.hidevolume = true;
    }
    $scope.playthis = function(obj) {
      var key = obj.name;
      var path = $scope.list[key].path;
      $scope.play_c = key;
      if ((!angular.isUndefined($scope.media))) {
        if ($scope.media.playing()) {
          $scope.media.unload()
        }
      }
      var watcherseeking ;
      $scope.media = new Howl({
        src: [path],
        onend: function() {
          var index = Object.keys($scope.list).indexOf($scope.play_c);
          var all_keys = Object.keys($scope.list);
          var all_size = all_keys.length;
          console.log('Finished! -- > check the repeat');
          if ($scope.vals.repeat == true) {
            console.log("repeat is true");
            $scope.playmedia();
          } else if ($scope.vals.shuffle == true) {
            // random select
            $scope.playthis($scope.list[all_keys[Math.floor(Math.random() * all_size)]]);
            $scope.playmedia();
          } else {
            console.log("see if next media ready");
            if (all_size > 1) {
              console.log("there is");
              $scope.playNext(index,all_size,all_keys);
            }
            else {
              //  keep playing the same one
              $scope.playthis($scope.list[all_keys[0]]);
              $scope.playmedia();
            }
          }
        },
        onplay: function() {
          console.log("playing now ");
          console.log("setting watcher on progress ");
          watcherseeking = $interval(function() {
            $scope.vals.pos = $scope.media.seek();
          }, 1000);
        },
        onload: function() {
          console.log("loaded");
          $scope.vals.ready = true;
          $scope.$apply();
        },
        onloaderror: function(id, msg) {
          console.log("loading error" + msg);
          alert('loading error');
        },
        onplayerror: function(id, msg) {
          console.log("play error" + msg);
          alert('playing error');
        },
        onpause: function(id) {
          $interval.cancel(watcherseeking);
        }
      });
      $scope.readonly = false;
      if ($scope.current.view != 'scripts/sub-view/player_watcher.html') {
        $scope.current.view = 'scripts/sub-view/player_watcher.html';
      }
      $scope.watcher_view_updater();
      // NOTE: code below commented , changed to play media function to optemise the perfomance and fix the late wake up and the slow with query selector
      var find_title = $interval(function() {
        console.log("find me");
        $scope.vals.title_div = angular.element(document.querySelector('#player_title_id'));
        if ($scope.vals.title_div.length != 0) {
          $scope.vals.visualizer_width = $scope.vals.title_div[0].clientWidth;
          console.log("new width ready ");
          // $scope.visualizer_prepaire();
          $interval.cancel(find_title);
        }
      }, 100);
      // $timeout(function() {
      //   // $scope.vals.visualizer_width = new_w;
      //   // $timeout(function() {
      //   //   var canv_elem = angular.element(document.querySelector('#canv_viz'));
      //   //   $scope.visualizer = canv_elem[0].getContext('2d');
      //   //   $scope.visualizer.imageSmoothingQuality = "medium";
      //   // }, 100);
      // }, 100);
    }
    $scope.playNext = function(index,list_taille,list_keys)
    {
      if ((index + 1) < list_taille) {
        // play next
        console.log("play next one");
        $scope.playthis($scope.list[list_keys[index + 1]]);
        $scope.playmedia();
      } else {
        // reset to 0
        console.log("back to 0");
        $scope.playthis($scope.list[list_keys[0]]);
        $scope.playmedia();
      }
    }
    $scope.visualizer_prepaire = function() {
      var re_check = $interval(function() {
        console.log("----- check for the elem");
        var canv_elem = angular.element(document.querySelector('#canv_viz'));
        console.log(canv_elem);
        if (canv_elem.length != 0) {
          console.log("***** i find it");
          $scope.visualizer = canv_elem[0].getContext('2d');
          $scope.visualizer.imageSmoothingQuality = "medium";
          $scope.vals.animation_ready = true;
          $interval.cancel(re_check);
        }
      }, 100);
      // $timeout(function() {
      //   var canv_elem = angular.element(document.querySelector('#canv_viz'));
      //   $scope.visualizer = canv_elem[0].getContext('2d');
      //   $scope.visualizer.imageSmoothingQuality = "medium";
      // }, 100);
    }
    $scope.draw = function() {
      drawVisual = requestAnimationFrame($scope.draw);
      $scope.analyser.getByteTimeDomainData($scope.vals.dataArray);
      $scope.visualizer.clearRect(0, 0, $scope.vals.visualizer_width, $scope.vals.visualizer_height);
      $scope.visualizer.beginPath();
      $scope.visualizer.moveTo(0, 0);
      var sliceWidth = $scope.vals.visualizer_width * 1.0 / $scope.vals.bufferLength;
      var x = 0;
      for (var i = 0; i < $scope.vals.bufferLength; i++) {
        var v = $scope.vals.dataArray[i] / 128.0;
        var y = v * $scope.vals.visualizer_height / 2;
        $scope.visualizer.lineTo(x, y);
        x += sliceWidth;
      };
      $scope.visualizer.lineTo($scope.vals.visualizer_width, 0);
      $scope.visualizer.closePath();
      $scope.visualizer.lineWidth = 1;
      // NOTE: code bleow is for shadow i gonna make it as option
      // $scope.visualizer.shadowColor = '#4b4b4b';
      // $scope.visualizer.shadowBlur = 5;
      // $scope.visualizer.shadowOffsetX = 2;
      // $scope.visualizer.shadowOffsetY = 2;
      $scope.visualizer.fillStyle = 'rgba(218, 19, 19, 0.56)';
      $scope.visualizer.fill();
      $scope.visualizer.strokeStyle = 'rgba(218, 19, 19, 0.56)';
      $scope.visualizer.stroke();
      // $scope.visualizer.scale(-1, 1)
    };
    $scope.draw1 = function() {
      drawVisual = requestAnimationFrame($scope.draw1);
      $scope.analyser.getByteTimeDomainData($scope.vals.dataArray);
      $scope.visualizer.clearRect(0, 0, $scope.vals.visualizer_width, $scope.vals.visualizer_height);
      $scope.visualizer.beginPath();
      $scope.visualizer.moveTo($scope.vals.visualizer_width, 0);
      var sliceWidth = $scope.vals.visualizer_width / 2 * 1.0 / $scope.vals.bufferLength;
      var x = $scope.vals.visualizer_width;
      for (var i = 0; i < $scope.vals.bufferLength; i++) {
        var v = $scope.vals.dataArray[i] / 128.0;
        var y = v * $scope.vals.visualizer_height / 2;
        $scope.visualizer.lineTo(x, y);
        x -= sliceWidth;
      };
      $scope.visualizer.lineTo(0, 0);
      $scope.visualizer.closePath();
      $scope.visualizer.lineWidth = 1;
      // NOTE: code bleow is for shadow i gonna make it as option
      // $scope.visualizer.shadowColor = '#4b4b4b';
      // $scope.visualizer.shadowBlur = 5;
      // $scope.visualizer.shadowOffsetX = 2;
      // $scope.visualizer.shadowOffsetY = 2;
      $scope.visualizer.fillStyle = 'rgba(218, 19, 19, 0.56)';
      $scope.visualizer.fill();
      $scope.visualizer.strokeStyle = 'rgba(218, 19, 19, 0.56)';
      $scope.visualizer.stroke();
    }
    $scope.draw2 = function() {
      drawVisual = requestAnimationFrame($scope.draw2);
      $scope.analyser.getByteTimeDomainData($scope.vals.dataArray);
      $scope.visualizer.clearRect(0, 0, $scope.vals.visualizer_width, $scope.vals.visualizer_height);
      $scope.visualizer.beginPath();
      $scope.visualizer.moveTo($scope.vals.visualizer_width, 0);
      var sliceWidth = $scope.vals.visualizer_width / 2 * -1.0 / $scope.vals.bufferLength;
      var x = $scope.vals.visualizer_width;
      for (var i = 0; i < $scope.vals.bufferLength; i++) {
        var v = $scope.vals.dataArray[i] / 128.0;
        var y = v * $scope.vals.visualizer_height;
        $scope.visualizer.lineTo(x, y);
        x -= sliceWidth;
      };
      $scope.visualizer.lineTo(0, 0);
      $scope.visualizer.closePath();
      $scope.visualizer.lineWidth = 1;
      // NOTE: code bleow is for shadow i gonna make it as option
      // $scope.visualizer.shadowColor = '#4b4b4b';
      // $scope.visualizer.shadowBlur = 5;
      // $scope.visualizer.shadowOffsetX = 2;
      // $scope.visualizer.shadowOffsetY = 2;
      $scope.visualizer.fillStyle = 'rgba(218, 19, 19, 0.56)';
      $scope.visualizer.fill();
      $scope.visualizer.strokeStyle = 'rgba(218, 19, 19, 0.56)';
      $scope.visualizer.stroke();
    }
    $scope.muteMedia = function() {
      $scope.vals.mute = !$scope.vals.mute;
      $scope.media.mute($scope.vals.mute);
    }
    $scope.playmedia = function() {
      if ($scope.media.playing()) {
        $scope.media.pause();
      } else {
        if ($scope.media.state() === "loaded") {
          $scope.media.play();
          $scope.vals.volume = $scope.media.volume();
          $scope.vals.pos = $scope.media.seek();
          // analyser for hwoler
          // Create analyzer
          $scope.analyser = Howler.ctx.createAnalyser();
          // Connect master gain to analyzer
          Howler.masterGain.connect($scope.analyser);
          // Connect analyzer to destination
          $scope.analyser.connect(Howler.ctx.destination);
          // Creating output array (according to documentation https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Visualizations_with_Web_Audio_API)
          $scope.analyser.fftSize = 2048;
          $scope.vals.bufferLength = $scope.analyser.frequencyBinCount;
          $scope.vals.dataArray = new Uint8Array($scope.vals.bufferLength);
          // Get the Data array
          $scope.analyser.getByteTimeDomainData($scope.vals.dataArray);
          // end analyser
          // start animation
          var check_animation = $interval(function() {
            if ($scope.vals.animation_ready == true) {
              console.log(" i gonna draw ");
              switch ($scope.user_config.animation) {
                case 'draw1':
                  $scope.draw1();
                  break;
                case 'draw':
                  $scope.draw();
                  break;
                case 'draw2':
                  $scope.draw2();
                  break;
              }
              // $scope.draw1();
              $interval.cancel(check_animation);
            }
          }, 100);
        } else {
          console.log("loading the media plz wait me");
          var refresh = $interval(function() {
            console.log("still loading");
            if ($scope.media.state() === "loaded") {
              $scope.media.play();
              $interval.cancel(refresh);
            }
          }, 100);
        }
      }
    };
    $scope.$watch('vals.volume', function(value) {
      if (!angular.isUndefined($scope.media)) {
        $scope.media.volume(value);
      }
    });
    //NOTE get ready when player is on
    $scope.$watch('current.view', function(value) {
      if (value == "scripts/sub-view/player_watcher.html") {
        $scope.visualizer_prepaire();
      }
    });
    $scope.watcher_view_updater = function() {
      $scope.overlay_bc = $scope.bg_color_list[Math.floor(Math.random() * $scope.bg_color_list.length)];
      $scope.overlay_bi = $scope.bg_image_list[Math.floor(Math.random() * $scope.bg_image_list.length)];
    }
    $scope.closeapp = function() {
      console.log("i have to close is now good bye ");
      window.close();
    }
    $scope.seekmedia = function(seeking_value) {
      console.log("seeking the media now plz");
      $scope.media.seek(seeking_value);
    }
    $scope.maxorno = function() {
      console.log("change to the other state ");
      if ($scope.maxormin) {
        window.unmaximize();
        $scope.maxormin = false;
      } else {
        window.maximize();
        $scope.maxormin = true;
      }
    }
    $scope.minimize = function() {
      console.log("i gonna be on the buttom ");
      window.minimize();
    }
    $scope.selectFile = function() {
      console.log("start selecting ");
      dialog.showOpenDialog(mainWindow, {
        title: 'Select some good music or great movie how know',
        filters: [{
            name: 'music',
            extensions: ['mp3', 'wav', 'avi']
          },
          {
            name: 'Movies',
            extensions: ['mkv', 'avi', 'mp4']
          }
        ],
        properties: [
          'openFile',
          'multiSelections',
          'createDirectory'
        ]
      }, function(files) {
        if (files && files.length) {
          console.log(files);
          for (file of files) {
            $scope.$apply(function() {
              var filename = file.replace(/^.*[\\\/]/, '');
              filename = filename.replace(/\.[^/.]+$/, "");
              var pathtofile = file;
              var artist = "unknown";
              var album = "unknown";
              var title = "unknown";
              $scope.list[filename] = {
                'name': filename,
                'path': file,
                "artist": artist,
                'title': title,
                'album': album,
                'fetched': false
              };
              $scope.fetcher($scope.list[filename]);
            });
            console.log($scope.list);
            // call fetcher meta data fn
          }
        } else {
          dialog.showMessageBox(mainWindow,{title:'Hi There',type:'warning',message:'You didnt select any file for now'});
          // alert("no file selected");
        }
      });
    }
    $scope.fetcher = function(obj) {
      console.log("obj have been sended ");
      var res = $scope.getMeta(obj);
      // obj.album = res.album ;
      obj.fetched = true;
    }
    $scope.getMeta = function(obj) {
      var path = obj.path;
      console.log("run meta fetcher");
      if (path.length > 0) {
        // load meta data
        var readableStream = fs.createReadStream(path);
        var parser = mm(readableStream, function(err, metadata) {
          if (err) throw err;
          /* load all other data */
          // console.log(metadata);
          obj.album = metadata.album;
          obj.artist = metadata.artist[0];
          obj.title = metadata.title;
          obj.year = metadata.year;
          obj.genre = metadata.genre[0];
          if (metadata.picture.length > 0) {
            var picture = metadata.picture[0];
            var url = URL.createObjectURL(new Blob([picture.data], {
              'type': 'image/' + picture.format
            }));
            obj.pic = url;
          } else {
            if ($scope.user_config.internet_fetch == true) {
              // no pic in local tags so fetch from api
              var url_req = 'http://ws.audioscrobbler.com/2.0/?method=track.search&limit=1&track=' + metadata.title + '&api_key=f029d67963b77170bafac0ea54648f19&format=json';
              // if (metadata.artist[0].length > 0 && !(metadata.artist[0] == "unknown")) {
              //   url_req = 'http://ws.audioscrobbler.com/2.0/?method=track.search&limit=1&track='+metadata.title+'&artist='+metadata.artist[0]+'&api_key=f029d67963b77170bafac0ea54648f19&format=json';
              // }
              console.log("no pic igonna look on the net ");
              $http.post(url_req).then(function(resapi) {
                // console.log(resapi);
                if (angular.isUndefined(resapi.data.results)) {
                  console.log("no internet");
                  return false;
                }
                var res_ret = resapi.data.results["opensearch:totalResults"];
                if (res_ret > 0) {
                  var track = resapi.data.results.trackmatches.track[0];
                  console.log(track);
                  var large_pic = track.image[3]["#text"];
                  var large_pic_more = large_pic.replace("/300x300/", "/1200x1200/");
                  obj.pic = large_pic_more;
                  if (track.mbid.length > 0) {
                    console.log("i can give u more information about this song -> mbid");
                    console.log(track.mbid);
                    var req_more_data = 'http://ws.audioscrobbler.com/2.0/?method=track.getInfo&mbid=' + track.mbid + '&api_key=f029d67963b77170bafac0ea54648f19&format=json';
                    $http.post(req_more_data).then(function(res_more_data) {
                      // add all new tags to the list media
                      console.log("more result coming");
                      console.log(res_more_data.data.track);
                      var more_data_track = res_more_data.data.track;
                      obj.title = more_data_track.name;
                      obj.artist = more_data_track.artist['name'];
                      obj.album = more_data_track.album['title'];
                      obj.tags = more_data_track.toptags;
                      obj.wiki = more_data_track.wiki['summary'];
                      obj.more_pic = [obj.pic];
                      obj.more_pic_resolution = more_data_track.album.image[3]["#text"].replace("/300x300/", "/1200x1200/");
                      obj.more_pic.push(obj.more_pic_resolution);
                    }, function() {
                      console.log("i cant sorry ");
                    });
                  }
                } else {
                  console.log("no result matchs");
                }
              }, function() {
                console.log("no internet access or server down ");
              });
            }
            else {
              console.log("user don't like the internet search");
            }
          }
          $scope.$apply();
          readableStream.close();
        });
      } else {
        console.log("empty path");
        // deferred.reject({ message: "empty path" });
      }
    }
    // call before i go
    $scope.music_list_show_hide = function() {
      // if ($scope.list_is_open == true) {
      //   $scope.list_is_open = false;
      // }
      // else {
      //   $scope.list_is_open = true;
      // }
      // $mdSidenav('music_list').close()
      $mdSidenav('music_list').isOpen() ? $mdSidenav('music_list').close() : $mdSidenav('music_list').open();
    }
    $scope.aboutInfo = function(event) {
      // console.log(event);
      $mdDialog.show({
          controller: infoManger,
          templateUrl: 'scripts/sub-view/aboutinfo.tmpl.html',
          parent: angular.element(document.body),
          targetEvent: event,
          clickOutsideToClose: true,
          fullscreen: true // Only for -xs, -sm breakpoints.
        })
        .then(function() {
          console.log("end info");
          // $mdDialog.hide();
        }, function() {
          $mdDialog.cancel();
        });
    }
    $scope.config = function(event) {
      // console.log(event);
      $mdDialog.show({
          locals: {
            user_config: $scope.user_config,
            app_conifg: $scope.appInfo
          },
          controller: configManger,
          templateUrl: 'scripts/sub-view/config_view.html',
          parent: angular.element(document.body),
          targetEvent: event,
          clickOutsideToClose: true,
          fullscreen: true // Only for -xs, -sm breakpoints.
        })
        .then(function(new_user_data) {
          console.log("save my data");
          // save the data into main scope
          $scope.user_config = angular.copy(new_user_data);
          // save data into local data base
          console.log("done");
        }, function() {
          console.log("cancel");
        });
    }
    $scope.checkInternet = function()
    {
      // check if there is an internet access
      console.log("there is interneyt ??");
    }
    $scope.showSearch = function()
    {

      var elem = angular.element(document.querySelector('.search'));
      var elem_to_hide = angular.element(document.querySelector('.main-cmd'));
      // console.log(elem[0]);
      elem.addClass('show-search');
      elem_to_hide.addClass('main-cmd-hide');
    }
    $scope.closeSearch = function()
    {

      var elem = angular.element(document.querySelector('.search'));
      var elem_to_show = angular.element(document.querySelector('.main-cmd'));
      // console.log(elem[0]);
      elem.removeClass('show-search');
      elem_to_show.removeClass('main-cmd-hide');
    }
    $scope.openLink = function(link)
    {
      shell.openExternal(link);
    }
    $scope.ListSize = function()
    {
      return Object.keys($scope.list).length;
    }
    $scope.removeFromList = function(index)
    {
      var tmpList = {};
      var all_keys = Object.keys($scope.list);
      // console.log("you want to remove ",$scope.list[all_keys[index]]);
      // if is playing now stop it
      if (all_keys.indexOf($scope.play_c) == index ) {
        console.log("i have to stop it");
        $scope.media.pause();
        if (all_keys.length > 1) {
        $scope.playNext(all_keys.indexOf($scope.play_c),all_keys.length,all_keys);
        }
        else {
          // only one element in the list so set the media to null
          $scope.media = null;
          // clear animation
          $scope.visualizer.clearRect(0, 0, $scope.vals.visualizer_width, $scope.vals.visualizer_height);
          // send back to screen holder
          $scope.current.view = 'scripts/sub-view/holder.html';
        }
      }
      for (var item in $scope.list) {
        if (item != all_keys[index]) {
          tmpList[item] = $scope.list[item];
        }
      }
      $scope.list = angular.copy(tmpList);
    }
    function configManger($scope,$mdDialog,user_config,app_conifg) {
      console.log('run me now');
      $scope.tmp = angular.copy(user_config);
      $scope.appInfotmp = angular.copy(app_conifg);
      $scope.hide = function() {
        $mdDialog.hide();
      }
      $scope.save = function()
      {
        $mdDialog.hide($scope.tmp);
      }
      $scope.cancel = function() {
          $mdDialog.cancel();
      }
      $scope.select_folder = function()
      {
        dialog.showOpenDialog(mainWindow, {
          title: 'Select Your Default folder',
          properties: [
            'openDirectory'
          ]
        }, function(pathe) {
          if (pathe && pathe.length != 0) {
            $scope.tmp.deafult_folder = pathe[0];
            $scope.$apply();
          } else {
            dialog.showMessageBox(mainWindow,{title:'Hi There',type:'warning',message:'You didnt select any folder to be your safe home for now'});
          }
        });
      }
    }
    function infoManger($scope, $mdDialog) {
      console.log('run me now');
      $scope.hide = function() {
        $mdDialog.hide();
      }
      $scope.cancel = function() {
          $mdDialog.cancel();
      }
    }
  }])
