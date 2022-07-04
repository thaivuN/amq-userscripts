// ==UserScript==
// @name        	AMQ Spy Host
// @namespace   	https://github.com/ayyu/
// @version     	0.1
// @description 	Hosts spies mode. Use /host_spies to start it and /end_spies to stop it.
// @author      	ayyu
// @match       	https://animemusicquiz.com/*
// @grant       	none
// @require     	https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqScriptInfo.js
// @downloadURL 	https://raw.githubusercontent.com/ayyu/amq-userscripts/master/userscripts/amqHostSpyMode.user.js
// ==/UserScript==

if (document.getElementById('startPage')) return;
let loadInterval = setInterval(() => {
  if (document.getElementById("loadingScreen").classList.contains("hidden")) {
    setup();
    clearInterval(loadInterval);
  }
}, 500);

class Spy {
  constructor(player, target = null) {
    this.player = player;
    this.target = target;
    this.score = 0;
    this.alive = true;
    this.rig = false;
  }
}

// knuth
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function assignTargets() {
  shuffleArray(spies);
  const numSpies = spies.length;
  for (let i = 0; i < numSpies; i++) {
    spies[i].target = spies[(i + 1) % numSpies].player;
  }
}

function messageTargets() {
  spies.forEach((spy, i) => {
    setTimeout(
      (assassin, target) => {
        socket.sendCommand({
          type: "social",
          command: "chat message",
          data: { target: assassin.name, message: `Your target is ${target.name}.` }
        });
      }, 1000*i, spy.player, spy.target);
  });
}

function startGame() {
  clearInterval(lobbyInterval);
  socket.sendCommand({
    type: 'lobby',
    command: 'start game'
  });
  ongoing = true;
  for (const key in lobby.players) {
    spies.push(new Spy(lobby.players[key]));
  }
  assignTargets();
  messageTargets();
}

function lobbyTick() {
  if (!active || !lobby.isHost ||  (!quiz.inQuiz && !lobby.inLobby)) return;
  if (lobby.numberOfPlayersReady >= minPlayers) {
    if (countdown === 0) {
      startGame();
    } else {
      if (countdown % 10 == 0 || countdown <= 5) {
        sendLobbyMessage(`Spies will be starting in ${countdown} seconds`);
      }
      countdown--;
    }
  }
}

function answerResults(results) {
  if (!active) return;
  
  const pickerIds = results.players
    .filter(player => player.listStatus != null)
    .map(player => player.gamePlayerId);
  const correctIds = results.players
    .filter(player => player.correct)
    .map(player => player.gamePlayerId);
  
  let killCount = 0;
  for (const pickerId of pickerIds) {
    let assassin = spies.find(spy => spy.player.gamePlayerId == pickerId);
    assassin.rig = true;
    let target = spies.find(spy => spy.player.gamePlayerId == assassin.target.gamePlayerId);
    if (correctIds.includes(target.player.gamePlayerId)) {
      target.alive = false;
      killCount++;
      sendLobbyMessage(`${target.player.name} :gun: ${assassin.player.name}`);
    }
  }
  if (killCount === 0) sendLobbyMessage(`Nobody died.`);
  sendLobbyMessage(formatDeadSpies());
}

function quizEndResult(results) {
  if (!active) return;
  spies.forEach(spy => {
    if (!spy.rig) {
      spy.alive = false;
      sendLobbyMessage(`${spy.player.name} has died for not looting a show.`);
    }
  });
  let aliveSpies = spies.filter(spy => spy.alive);
  if (checkWinners(aliveSpies, results)) return;

  const losers = getLosers(aliveSpies, results);
  losers.forEach(loser => {
    loser.alive = false;
    sendLobbyMessage(`${loser.player.name} has died for being in last place.`);
  });

  aliveSpies = spies.filter(spy => spy.alive);
  if (checkWinners(aliveSpies, results)) return;
}

function checkWinners(aliveSpies, quizResults) {
  if (aliveSpies.length < minPlayers) {
    const winners = getWinners(aliveSpies, quizResults);
    sendLobbyMessage(formatWinners(winners));
    ongoing = false;
    return true;
  }
  return false;
}

function quizOver() {
  if (!active) return;
  if (ongoing) {
    sendLobbyMessage(`The game will continue with the remaining players.`);
    countdown = ongoingCountdown;
    spies.forEach(spy => {
      if (!spy.alive) movePlayerToSpec(spy.player.name);
    })
  } else {
    sendLobbyMessage(`A new Spy vs. Spy game is starting. Players may now join.`);
    countdown = startCountdown;
    spies.length = 0;
  }
  lobbyInterval = setInterval(lobbyTick, 1000);
}

function getWinners(aliveSpies, quizResults) {
  if (aliveSpies.length == 0) return [];
  const aliveResults = filterSortAliveResults(aliveSpies, quizResults);
  const firstPosition = aliveResults[0].endPosition;
  const winningIds = aliveResults
    .filter((result) => result.endPosition == firstPosition)
    .map((result) => result.gamePlayerId);
  return aliveSpies.filter(spy => winningIds.includes(spy.player.gamePlayerId));
}

function getLosers(aliveSpies, quizResults) {
  if (aliveSpies.length == 0) return [];
  const aliveResults = filterSortAliveResults(aliveSpies, quizResults);
  const lastPosition = aliveResults[aliveResults.length - 1].endPosition;
  const losingIds = aliveResults
    .filter((result) => result.endPosition == lastPosition)
    .map((result) => result.gamePlayerId);
    return aliveSpies.filter(spy => losingIds.includes(spy.player.gamePlayerId));
}

function filterSortAliveResults(aliveSpies, quizResults) {
  const aliveIds = aliveSpies.map(spy => spy.player.gamePlayerId);
  const aliveResults = quizResults.resultStates.filter(player => aliveIds.includes(player.gamePlayerId));
  aliveResults.sort((a, b) => a.endPosition - b.endPosition);
  return aliveResults;
}

let active = false;
let ongoing = false;
const spies = [];

const minPlayers = 4;
const startCountdown = 30;
const ongoingCountdown = 10;
let countdown;
let lobbyInterval;

const pastebin = 'https://pastebin.com/Q1Z35czX';

function processChatCommand(payload) {
  if (payload.sender !== selfName
      || !lobby.isHost
      || quiz.gameMode == 'Ranked'
      || (!quiz.inQuiz && !lobby.inLobby)) return;
      
  if (payload.message.startsWith('/host_spies')) {
    active = true;
    ongoing = false;
    spies.length = 0;
    sendLobbyMessage(`Spy vs. Spy: ${pastebin}`);
    countdown = startCountdown;
    lobbyInterval = setInterval(lobbyTick, 1000);
  }

  if (payload.message.startsWith('/end_spies')) {
    active = false;
    ongoing = false;
    spies.length = 0;
    sendLobbyMessage(`Spy vs. Spy hosting ended.`);
    clearInterval(lobbyInterval);
  }
}

function formatWinners(winners) {
  let msg = `The game has ended. `;
  if (winners.length == 0) {
    msg += 'Everyone died.';
  } else {
    msg += ':trophy: ' + winners.map(spy => spy.player.name).join(', ');
  }
  return msg;
}

function formatDeadSpies() {
  let msg = ":skull:: ";
  const deadSpies = spies.filter(spy => !spy.alive);
  if (deadSpies.length == 0) {
    msg += ":egg:";
  } else {
    msg += deadSpies.map(spy => spy.player.name).join(', ');
  }
  return msg;
}

function playerJoined(player) {
  if (ongoing) blockPlayerJoin(player);
  joinMessage(player);
}

function specToPlayer(player) {
  if (ongoing) blockPlayerJoin(player);
}

function blockPlayerJoin(player) {
  sendLobbyMessage(`@${player.name} There is still a game of spies ongoing. Wait for it to finish before joining.`);
  movePlayerToSpec(player.name);
}

function specJoined(player) {
  joinMessage(player);
}

function joinMessage(player) {
  sendLobbyMessage(`@${player.name} Spy vs. Spy: ${pastebin}`);
}

function sendLobbyMessage(message) {
  if (!active || !lobby.isHost) return;
  socket.sendCommand({
    type: 'lobby',
    command: 'game chat message',
    data: { msg: message, teamMessage: false }
  });
}

function movePlayerToSpec(playerName) {
  if (lobby.isHost && !quiz.inQuiz && lobby.inLobby) {
    socket.sendCommand({
      type: 'lobby',
      command: 'change player to spectator',
      data: { playerName: playerName }
    });
  }
}

function setup() {
  new Listener("Game Chat Message", processChatCommand).bindListener();
  new Listener("game chat update", (payload) => {
    payload.messages.forEach(message => processChatCommand(message));
  }).bindListener();
  new Listener("New Player", playerJoined).bindListener();
  new Listener("New Spectator", specJoined).bindListener();
  new Listener("Spectator Change To Player", specToPlayer).bindListener();
  new Listener("answer results", answerResults).bindListener();
  new Listener("quiz end result", quizEndResult).bindListener();
  new Listener("quiz over", quizOver).bindListener();
}
