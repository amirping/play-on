var app = angular.module('myapp', [])
.controller('mainctrl',['$scope','$http','$timeout',function($scope,$http,$timeout){
  $scope.resultreturn="sa7a fererererere";
  $scope.sendreq=function()
  {
    var request = {
        method: 'POST',
        url: 'server_side/loader.php',
        headers: {
            'Content-Type': 'application/json'
        },
        data: {
            msg: $scope.resultreturn
        }
    }
    $http(request).then(function(databack) {
        console.log(databack.data);
        $scope.resultreturn = databack.data;
    }, function() {
        console.log("error");
        return false;
    });
  }
}]);
