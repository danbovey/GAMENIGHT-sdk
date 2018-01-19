# GAMENIGHT SDK

> 🕹 SDK for developing games for the GAMENIGHT platform

This SDK allows game authors to build the server-side of a game that can run on [GAMENIGHT](https://gamenight.gg). You describe the rules of the game in a series of functions, GAMENIGHT and the SDK handles the rest (multiplayer, real-time connections, state management & player secrets, rounds & turns).

## Concepts

The SDK contains classes that can be extended for [Game](/#Game) and [Player](/#Player). It provides interfaces to the containing room and playlist of games with [Room](/#Room) and [Playlist](/#Playlist).

### Game

The `Game` class is extended to create the server-side process that handles game state, move logic and win conditions. Right now, all games are turn-based.

- The game decides the order that players get to take their turns.
- When all players are ready, the game and the first round is started.
    - Each player takes their turn.
    - After their turn, if player has made a winning move, the game ends.
- The round ends if all players have taken their turn.
    - Check if any win conditions have been met or change player order.
- The next round is started.
- The maximum amount of rounds has been met and the game ends.

#### Player Turn Order

The order in which players take their turns can be defined in `setup` or at any point during the game using `setPlayerTurnOrder`. This allows the first round of the game to be set up, for example, as a die roll where the player who gets to go first is determined by the highest die roll. The player turn order is a sorted array of player IDs.

```js
this.setPlayerTurnOrder(['player_1', 'player_2']);
```

#### Readying up

A game can choose to require all players to say they are ready before starting the game. When readying up, players can send an initial action such as choosing their game token, avatar or nickname, or placing their ships in Battleship.

#### Round

A round is a group of turns made by players. In it's most basic form, a round could be a set of turns representing the first four turns made by four players in a game of Ludo. A round can be manipulated and changed by the player turn order to achieve game logic like Uno, where the order can be reversed. A round can have metadata attached to it to send to the client. For example, the first round in Monopoly is a `die_roll`.

```js
this.round = { number: 1, type: 'die_roll' };
```

#### Turn

A turn opens the game up to one player to make their move. After incrementing the turn number, the turn player is determined from the index in player turn order and the `handleMove` function will accept a move payload from only that player. A turn can last for a certain timeframe in games like Poker (the game can choose to check or fold for you if you don't move) or stay open until the player makes a decision in games like Chess.

```js
this.turn = { number: 1, player_id: 'player_1' };
```

## Tutorial

Initialize a new npm project and save `gamenight` as a dependency. Set the `main` entry to `src/index.js`.

```
npm init
npm install gamenight --save
```

*player.js*
```js
import { Player } from 'gamenight';

export default class ChancePlayer extends Player {
  constructor(player) {
    super(player);
    
    this.score = 0;
  }
}
```

*index.js*
```js
import { Game } from 'gamenight';

// Create the game of chance :D
// Each player takes a turn sending a guess of a random number between 1 and
// 10. If they guess correctly 5 times, they are the winner.
export default class Chance extends Game {
  contructor(gameObj, room) {
    super(gameObj, room);
  }
  
  setup() {
    // The player who goes first is randomly chosen
    this.setPlayerTurnOrder('random');
  }
  
  createPlayer(player) {
    // Set up each player's object
    return new ChancePlayer(player);
  }
  
  handleReadyUp(player_id, payload) {
    return new Promise((resolve, reject) => {
      const index = this.players.findIndex(p => p._id == player_id);
      this.players[index].nickname = payload.nickname;

      resolve({ nickname: payload.nickname });
    });
  }
  
  handleMove(payload) {
    return new Promise((resolve, reject) => {
      if(!payload.guess || payload.guess < 0 || payload.guess > 10) {
        return reject('Invalid guess!');
      }
      const player = this.findPlayer(this.turn.player_id);
      
      // If the player guesses my random number
      const rand = Math.floor(Math.random() * 10) + 1;
      if(payload.guess == rand) {
        player.score += 1;
      }
      
      resolve(rand);
    });
  }
  
  handleTurnEnd(player) {
    return new Promise((resolve, reject) => {
      // If a player reaches a score of 5, the game is won!
      if(player.score >= 5) {
        return reject({ winner: player._id });
      }
      
      resolve();
    };
  }
  
  toJSONForPlayer(id) {
    // Define how the game hides secrets from other players
    const object = super.toJSONForPlayer(id);
    object.players = object.players.map(player => this.hidePlayerScore(id, player));

    return object;
  }
  
  hidePlayerScore(id, player) {
    return Object.assign({}, player, {
      score: player._id == id ? player.score : null
    });
  }
}
```
