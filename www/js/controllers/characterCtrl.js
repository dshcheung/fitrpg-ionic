angular.module('starter.controllers')

.controller('CharacterCtrl', function(
    $rootScope,
    $scope,
    $state,
    $ionicLoading,
    $ionicNavBarDelegate,
    $ionicPopup,
    $ionicPlatform,
    User,
    Shop,
    Refresh,
    localStorageService,
    $window )
{
  // initialize $rootScope.user to eliminate console errors before authentication
  var loading = setTimeout(function(){
    $ionicLoading.show({
      template: '<p>Loading...</p><i class="icon ion-loading-c"></i>'
    });
  }, 500);

  $scope.calculatedData = {};

  var device = {
    isApple: ionic.Platform.isIOS(),
    isGoogle: ionic.Platform.isAndroid(),
  };

  $scope.addAlert = function(status) {
    if (status === 'loss') {
      type = 'danger';
      msg = 'You suck. You lost experience and gold.'
    } else if (status === 'win') {
      type = 'success';
      msg = 'You win. You gained experience and gold.'
    } else if (status === 'request') {
      type = '';
      msg = 'Someone wants to battle you.';
    }
    $scope.alerts.push({type: type, msg: msg});
  };

  $scope.closeAlert = function(index) {
    $scope.alerts.splice(index, 1);
  };

  var calculateData = function(user) {
    $scope.calculatedData.currentXp = Math.floor(util.currentLevelExp(user.attributes.level, user.fitbit.experience + user.attributes.experience));
    $scope.calculatedData.requiredXp = util.nextLevelExp(user.attributes.level);
    $scope.calculatedData.strength = user.attributes.strength + user.fitbit.strength;
    $scope.calculatedData.vitality = user.attributes.vitality + user.fitbit.vitality;
    $scope.calculatedData.dexterity = user.attributes.dexterity + user.fitbit.dexterity;
    $scope.calculatedData.endurance = user.attributes.endurance + user.fitbit.endurance;
    $scope.calculatedData.maxHp = util.vitalityToHp($scope.calculatedData.vitality,'strength'); //change to $scope.user.characterClass
    user.attributes.HP += user.fitbit.HPRecov;
    user.fitbit.HPRecov = 0;
    if (user.attributes.HP > $scope.calculatedData.maxHp) {
      user.attributes.HP = $scope.calculatedData.maxHp;
    }
    if (user.attributes.gold < 0) {
      user.attributes.gold = 0;
    }
  };

  var alertBattleStatus = function() {
    $scope.alerts = [];
    var listOfIndices = [];
    var alertWin = false;
    var alertLoss = false;
    var alertRequest = false;
    for (var i=0; i<$rootScope.user.missionsVersus.length; i++) {
      var mission = $rootScope.user.missionsVersus[i];
      if (mission.type === 'battle') {
        if (mission.status === 'win' && !alertWin) {
          alertWin = true;
          $scope.addAlert(mission.status);
        } else if (mission.status === 'loss' && !alertLoss) {
          alertLoss = true;
          $scope.addAlert(mission.status);
        } else if (mission.status === 'request' && !alertRequest) {
          alertRequest = true;
          $scope.addAlert(mission.status);
        }

        if (mission.status === 'win' || mission.status === 'loss') {
          listOfIndices.push(i);
        }
      }
    }

    var removeMission = function(index,count) {
      if (count < listOfIndices.length) {
        $rootScope.user.missionsVersus.splice(index-count,1);
        removeMission(listOfIndices[count+1],count+1);
      }
    };

    if (listOfIndices.length > 0) {
      removeMission(listOfIndices[0],0);
    }

  };

  var localUserId = localStorageService.get('userId'); //'2Q2TVT'; //

  User.get({id : localUserId}, function (user) {
    $rootScope.user = user;
    calculateData($rootScope.user);

    alertBattleStatus();

    User.update($rootScope.user);
    clearTimeout(loading);
    $ionicLoading.hide();
  });

  $scope.refresh = function() {
    var id = localUserId;
    Refresh.get({id: id}, function() { // this will tell fitbit to get new data
      User.get({id : id}, function (user) { // this will retrieve that new data
        $rootScope.user = user;
        calculateData($rootScope.user);
        alertBattleStatus();
        User.update($rootScope.user);
        // $window.alert("Successfully retrieved data for", id);
        // location.href = location.pathname; //refresh page
        $scope.$broadcast('scroll.refreshComplete');
      });
    });
  };

  $scope.hasSkillPoints = function() {
    if ($rootScope.user && $rootScope.user.attributes.skillPts) {
      return true;
    } else {
      return false;
    }
  };

  $scope.applyAttributes = function(attr) {
    if ($rootScope.user.attributes.skillPts > 0) {
      $rootScope.user.attributes[attr]++;
      $rootScope.user.attributes.skillPts--;
      if (attr === 'vitality') {
        // change char class from warrior to user class
        // $rootScope.user.attributes.hp = util.vitalityToHp($rootScope.user.attributes.vitality,'warrior');
        $scope.calculatedData.maxHp = util.vitalityToHp($rootScope.user.attributes.vitality,'warrior');
      }
      calculateData($rootScope.user);
      // update database
      User.update($rootScope.user);
    }
  };

  $scope.isEquipped = function(slot) {
    var user = $rootScope.user;
    if (user && user.equipped &&userequipped[slot].inventoryId !== null) {
      return true;
    } else {
      return false;
    }
  };

  $scope.unequip = function(slot){
    var inventory = $rootScope.user.inventory;
    var inventoryId = $rootScope.user.equipped[slot].inventoryId;

    var empty = function(location) {
      $rootScope.user.equipped[location].name = '';
      $rootScope.user.equipped[location].inventoryId = null;
    };

    if (slot === 'weapon1' || slot === 'weapon2') {
      if ($rootScope.user.equipped['weapon1'].inventoryId === $rootScope.user.equipped['weapon2'].inventoryId) {
        empty('weapon1');
        empty('weapon2');
      }
    }

    empty(slot);

    var storeId;
    for (var i=0; i<inventory.length; i++) {
      if (inventory[i].id === inventoryId) {
        inventory[i].equipped = false;
        storeId = inventory[i].storeId;
      }
    }

    Shop.get({id: storeId}, function(item) {
      $rootScope.user.attributes.strength -= item.strength;
      $rootScope.user.attributes.vitality -= item.vitality;
      $rootScope.user.attributes.endurance -= item.endurance;
      $rootScope.user.attributes.dexterity -= item.dexterity;
      calculateData($rootScope.user);
      User.update($rootScope.user);
    })

  };

  $scope.equip = function(slot){
  };

  $scope.navTo = function(location) {
    $state.go('app.' + location);
  };

  $scope.rateApp = function() {
    var title = 'Having Fun?';
    var body = 'Let us know what you think and what features you want added!';
    var likeBtn = '<i class="icon ion-thumbsup"></i>';
    var hateBtn = '<i class="icon ion-thumbsdown"></i>';
    var cancelBtn = '<i class="icon ion-close"></i>';
    util.showPopup($ionicPopup,title,body,hateBtn,likeBtn,cancelBtn,
        function() {
          if (device.isApple) {
            $window.open('http://itunes.apple.com/app/id887067605');
          } else if (device.isGoogle) {
            $window.open('http://play.google.com/store/apps/details?id=com.fatchickenstudios.fitrpg');
          }
        },
        function() {
          $scope.navTo('feedback');
        }
      )
  };
})