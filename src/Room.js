const shortid = require('shortid');
const slugify = require('slugify');

const Playlist = require('./Playlist');
const ioHelpers = require('./helpers/io');

/**
 * A room represents a group of players who are connected
 * to each other and are playing the same game.
 */
class Room {
    /**
     * Create a new room
     * @param {string} name The name of the room
     * @param {string} host The UUID of the host player
     * @param {obj} settings Initial settings for the room
     * @param {Server} io The Socket.IO Server
     */
    constructor(name, host, settings, io) {
        this.name = name;
        this.host = host._id;
        this.players = [];
        this.playlist = new Playlist();
        this.settings = Object.assign({
            privacy: 'public',
            mode: 'party',
            player_limit: 16,
            password: null
        }, settings);

        // Generate a private ID for the room and a code to join with
        this.id = shortid.generate();
        this.code = shortid.generate();
        
        // Create interface for emitting to sockets with io helper
        this.ioRoom = `room_${this.id}`;
        this.io = ioHelpers(io, this.ioRoom);
        this.broadcast = this.io.broadcast;
        this.broadcast_secret = this.io.broadcast_secret;
    }

    /**
     * Add a player to the room
     * @param {Player} player
     * @param {Socket} socket
     * @param {string} password
     */
    addPlayer(player, socket, password = null) {
        const exists = this.players.find(p => p._id == player._id);
        if(this.players.length === this.settings.player_limit) {
            return Promise.reject('Room is full.');
        }

        if(this.settings.privacy === 'private') {
            if(!password) {
                return Promise.reject('Room is private. Password required to enter.');
            }
            if(this.settings.password != password) {
                return Promise.reject('Incorrect password.');
            }
        }

        if(!exists) {
            this.players.push(player);
            player.rooms.push(this.id);
        }
        socket.join(this.ioRoom);

        const roomForPlayer = this.toJSON();
        if(this.game) {
            roomForPlayer.game = this.game.toJSONForPlayer(player._id);
        }

        if(this.players.length > 1) {
            // Notify the room that player has joined
            this.broadcast('player_join', { player });
        }

        return Promise.resolve(roomForPlayer);
    }

    /**
     * Remove a player from the room
     * @param {Player} player
     * @param {Socket} socket
     */
    removePlayer(player, socket) {
        const index = this.players.find(p => p._id == player._id);
        if(index === -1) {
            return Promise.reject('Not in room.');
        }

        this.players.splice(index, 1);
        const rIndex = player.rooms.find(r => r.id == this.id);
        if(rIndex > -1) {
            player.rooms.splice(rIndex, 1);
        }

        socket.leave(this.ioRoom);

        // Players can leave freely during room setup but
        // if there is an active game then we notify it.
        if(this.playlist.index > -1 && this.game) {
            this.game.handlePlayerLeave(player);
        }

        if(this.players.length > 0) {
            this.broadcast('player_leave', { player });
        }

        return Promise.resolve(index > -1);
    }

    /**
     * Set the name of the room
     * @param {string} name The new name of the room
     */
    setName(name) {
        this.name = name;
        this.broadcast('room/update_settings', {
            room: this.toJSON(),
            changes: [`Room name changed to ${this.name}.`]
        });
    }

    /**
     * Change the host player of the room
     * @param {string} player_id The UUID of the new host player
     */
    changeHost(player_id) {
        const oldHost = this.players.find(u => u._id.toString() === this.host.toString());
        const newHost = this.players.find(u => u._id.toString() === player_id.toString());
        if(newHost === null) {
            return Promsie.reject('Player is not in room');
        }

        this.host = newHost._id;

        this.broadcast('room/update_settings', {
            room: this.toJSON(),
            changes: [`${oldHost.username} made ${newHost.username} the host.`]
        });

        return Promise.resolve(newHost);
    }

    /**
     * Update the room settings
     * @param {object} settings New settings
     */
    updateSettings(settings) {
        if(settings.privacy && settings.privacy != this.settings.privacy) {
            this.code = shortid.generate();
            this.settings.privacy = settings.privacy;
        }
        if(settings.password && this.settings.privacy === 'private') {
            this.settings.password = settings.password;
        }
        if(settings.player_limit) {
            this.settings.player_limit = settings.player_limit;
        }
    }

    /**
     * Add a game to the room's playlist
     * @param {object} game The game details representing a Game
     */
    addGame(game) {
        this.playlist.add(game);
        
        this.broadcast('room/update_playlist', { playlist: this.playlist });
    }

    /**
     * Start the room's playlist
     * @param {function} gameLoader GAMENIGHT platform provides a function to load a game.
     */
    start(gameLoader) {
        // Start the room's playlist
        const plGame = this.playlist.next();
        if(!plGame) {
            this.broadcast('room/playlist_end');
            return false;
        }

        const gameName = slugify(plGame.name, {
            remove: /[$*_+~.()'"!\-:@]/g,
            lower: true
        });
        const Game = gameLoader(gameName);

        this.game = new Game(plGame, this, this.io);

        this.game.init();

        this.game.on('end', () => {
            setTimeout(() => {
                this.start();
            }, this.game.settings.resultsTimeout);
        });

        this.broadcast('room/update_playlist', { playlist: this.playlist });
    }

    toJSON() {
        // When converting the room to JSON, hide the
        // ID, join password and any active games.
        const settings = Object.assign({}, this.settings);
        delete settings.password;

        return {
            name: this.name,
            code: this.code,
            host: this.host,
            players: this.players,
            playlist: this.playlist,
            settings
        };
    }
}

module.exports = Room;
