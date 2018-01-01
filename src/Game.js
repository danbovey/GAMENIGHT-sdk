const EventEmitter = require('events');

const Player = require('./Player');
const { PLAYER_ORDER } = require('./constants');
const shuffle = require('./helpers/shuffle');

/**
 * The game class is extended to create the server-side process
 * that handles game state, move logic and win conditions.
 */
class Game extends EventEmitter {
    /**
     * Create a new game
     * @param {object} gameObj The game details representing a Game
     * @param {Room} room The room the game is attached too
     */
    constructor(gameObj, room) {
        super();
        
        this.gameObj = gameObj;
        this.room = room;

        this.name = gameObj.name;
        this.players = [];
        this.settings = {
            readyUp: true,
            resultsTimeout: 10000
        };
        this.started = false;
        this.moves = [];
        this.round = { number: 0 };
        this.turn = { number: 0 };
        this.maxRounds = null;
        this.playerOrder = room.players.map(p => p._id);
    }

    /**
     * Broadcast a complete update to all players
     * @param {string} event
     */
    broadcastUpdate(event = 'game/update') {
        this.room.broadcast_secret(event, socket => ({
            game: this.toJSONForPlayer(socket.user._id.toString())
        }));
    }

    /**
     * Find a player by UUID
     * @param {string} id The UUID of the player
     */
    findPlayer(id) {
        return this.players.find(p => p._id == id);
    }

    /**
     * Create a base game player
     * @param {object} player The player object from the room
     * @returns {Player}
     */
    createPlayer(player) {
        return new Player(player);
    }

    init() {
        // Take players from the room and create our own player list
        this.players = this.room.players.map(p => this.createPlayer(p));

        // Boot the game up!
        if(this.setup) {
            const gameSetup = this.setup();

            const executeSetup = settings => {
                this.settings = Object.assign({}, this.settings, settings);
                // Send initial game object to clients, with
                // settings to change and then ready up
                this.broadcastUpdate('game/init');
                if(settings.readyUp === false) {
                    // If the game does not require players
                    // to ready up, start the game.
                    this.start();
                }
            };

            if(typeof gameSetup.then != 'undefined') {
                gameSetup.then(executeSetup);
            } else {
                executeSetup(gameSetup);
            }
        } else {
            this.start();
        }
    }

    /**
     * Set the order that players take their turns in
     * @param {array|int} order An array of player IDs or a PLAYER_ORDER enum
     */
    setPlayerTurnOrder(order) {
        if(Array.isArray(order)) {
            // The game class has provided the order of player ids
            this.playerOrder = order;
        } else {
            switch(order) {
                case PLAYER_ORDER.RANDOM:
                    // Randomize player order
                    this.playerOrder = shuffle(this.players);
                    break;
                default:
                    // TODO: Should be sorted by p.joined_at
                    this.playerOrder = this.players;
                    // this.playerOrder.sort((a, b) => a.joined_at - b.joined_at);
                    break;
            }

            this.playerOrder = this.playerOrder.map(p => p._id);
        }
    }

    /**
     * Mark a player as ready, handle the setup phase
     * @param {string} player_id
     * @param {object} payload
     * 
     * @returns {boolean} Returns whether readying up was successful
     */
    readyUp(player_id, payload) {
        // TODO: Potentially allow players to "unready"
        if(this.started === true) {
            return false;
        }

        const player = this.findPlayer(player_id);
        if(player.ready) {
            return false;
        }

        const executeReady = () => {
            player.ready = true;

            this.room.broadcast('game/player_ready', { player_id });
            
            // If all the players are ready, start the game
            if(this.players.filter(p => !p.ready).length === 0) {
                this.start();
            }
        }

        if(this.handleReadyUp) {
            const handle = this.handleReadyUp(player_id, payload);
            if(typeof handle.then != 'undefined') {
                return handle.then(payload => {
                    executeReady();

                    return payload;
                });
            } else if(handle) {
                executeReady();
            }

            return handle;
        } else {
            executeReady();

            return true;
        }
    }

    start() {
        this.started = true;

        this.startRound(1);
    }

    startRound(round) {
        // Starts the given round
        this.round = { number: round };
        
        if(this.handleRoundStart) {
            // Allow the game to add custom fields to the round
            return this.handleRoundStart(this.round)
                .then(round => {
                    this.round = round;
                    this.startTurn(1);
                });
        } else {
            return this.startTurn(1);
        }
    }

    nextRound() {
        // Starts a new round, restarts or ends
        const executeNextRound = () => {
            const nextNum = this.round.number + 1;
            if(this.maxRounds && nextNum > this.maxRounds) {
                // The maximum amount of rounds allowed have been completed
                return this.onEnd();
            } else {
                return this.startRound(nextNum);
            }
        };

        if(this.handleRoundEnd) {
            return this.handleRoundEnd(this.round)
                // Start next round
                .then(() => executeNextRound())
                // Restart the round
                .catch(() => this.startRound(this.round.number));
        } else {
            return executeNextRound();
        }
    }

    startTurn(turn) {
        // Starts the given turn
        const player = this.findPlayer(this.playerOrder[turn - 1]);
        if(!player) {
            return this.nextTurn(true);
        }

        this.turn = { number: turn, player_id: player._id };

        if(this.handleTurnStart) {
            this.handleTurnStart(player, this.round, this.turn);
        }
        this.room.broadcast('game/turn', { round: this.round, turn: this.turn });
    }

    nextTurn(restart = false) {
        // Starts a new turn, a new round or ends
        const executeNextTurn = () => {
            const nextNum = this.turn.number + 1;
            if(nextNum > this.playerOrder.length) {
                // Next round
                return this.nextRound();
            } else {
                return this.startTurn(nextNum);
            }
        };

        if(!restart && this.handleTurnEnd) {
            const player = this.findPlayer(this.playerOrder[this.turn.number - 1]);
            return this.handleTurnEnd(player)
                // Next turn
                .then(() => executeNextTurn())
                // Player win conditions after turn is complete, i.e.
                // The board is dominated by a player in Risk
                .catch(payload => {
                    if(!(payload instanceof Error)) {
                        this.onEnd(payload);
                    } else {
                        console.log(payload);
                    }
                });
        } else {
            return executeNextTurn();
        }
    }

    /**
     * Handle a move request from a socket
     * @param {Player} player 
     * @param {Object} payload 
     */
    playerMove(player, move) {
        if(this.endResults) {
            return Promise.reject('Game has ended.');
        }
        if(this.turn.number === 0) {
            return Promise.reject('Game has not started.');
        }
        // The move can only be accepted if it's the player's turn
        // TODO: For some games this will be too restrictive, players may
        // be allowed to send actions at other times in some types of games.
        if(player._id != this.turn.player_id) {
            return Promise.reject('You are not allowed to send that right now.');
        }

        return this.handleMove(move)
            .then(move => {
                // The move was accepted by the game
                const payload = {
                    player_id: player._id,
                    round: this.round.number,
                    turn: this.turn.number,
                    payload: move
                };
                this.moves.push(payload);
                this.room.broadcast('game/move', payload);

                this.nextTurn();

                return payload;
            });
    }

    onEnd(payload) {
        return this.handleEnd(payload)
            .then(results => {
                // Let the clients know the game has ended
                this.endResults = results;
                this.room.broadcast('game/end', results);

                // Let the system know the game has ended
                this.emit('end', results);
            });
    }

    handlePlayerLeave(player) {
        // We are told by the room that a player has left
        if(this.room.players.length < this.gameObj.min_players) {
            this.destroy();
        }
    }

    destroy() {
        // Let the room know that the game has stopped
        this.room.broadcast('game/destroy');
    }
    
    toJSON() {
        return {
            name: this.name,
            players: this.players,
            settings: this.settings,
            started: this.started,
            moves: this.moves,
            round: this.round,
            turn: this.turn,
            maxRounds: this.maxRounds,
            playerOrder: this.playerOrder,
            endResults: this.endResults
        };
    }

    toJSONForPlayer() {
        // When converting the room to JSON, a game should hide
        // private player information from other players.
        return Object.assign({}, this.toJSON());
    }
}

module.exports = Game;
