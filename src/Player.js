/**
 * The player class represents a player in a game
 */
class Player {
    /**
     * Create a new player
     * @param {object} player The player object from the room
     */
    constructor(player) {
        this._id = player._id;
    }
    
    rollDie(numberOfDie = 1) {
        const rolls = [];
        for(let i = 0; i < numberOfDie; i++) {
            rolls.push(Math.floor(Math.random() * 6) + 1);
        }

        return rolls;
    }
}

module.exports = Player;
