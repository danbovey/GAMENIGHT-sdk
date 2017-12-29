/**
 * The playlist class represents a list of games to be played by a room.
 */
class Playlist {
    constructor() {
        this.games = [];
        this.index = -1;
    }

    /**
     * Add a game to the list
     * @param {object} game The game details representing a Game
     */
    add(game) {
        if(this.games.length == 10) {
            return false;
        }

        this.games.push(game);

        return true;
    }

    next() {
        // Go to the next game
        this.index++;

        if(this.index == this.games.length) {
            return false;
        }

        return this.games[this.index];
    }
}

module.exports = Playlist;
