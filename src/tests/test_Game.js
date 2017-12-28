const should = require('chai').should();

const Game = require('../Game');

const mockRoom = players => ({
    players,
    broadcast: () => {},
    broadcast_secret: () => {}
});

describe('Game', () => {
    it('should accept details and a room and return a Game with players', () => {
        const player1 = { _id: '1', username: 'abc' };
        const game = new Game({ name: 'test' }, mockRoom([player1]));
        game.init();
        game.name.should.equal('test');
        
        game.players[0]._id.should.equal(player1._id);
    });

    it('should accept a custom player turn order', () => {
        const player1 = { _id: '1', username: 'abc' };
        const player2 = { _id: '2', username: 'def' };
        const game = new Game({ name: 'test' }, mockRoom([player1, player2]));
        game.init();
        game.setPlayerTurnOrder(['2', '1']);
        
        game.playerOrder[0].should.equal('2');
        game.playerOrder[1].should.equal('1');
    });

    it('should find a player by a given id', () => {
        const player1 = { _id: '1', username: 'abc' };
        const player2 = { _id: '2', username: 'def' };
        const game = new Game({ name: 'test' }, mockRoom([player1, player2]));
        game.init();

        game.findPlayer('1')._id.should.equal(player1._id);
    });

    it('should mark a player as ready up', () => {
        const player1 = { _id: '1', username: 'abc' };
        const player2 = { _id: '2', username: 'def' };
        const game = new Game({ name: 'test' }, mockRoom([player1, player2]));
        game.setup = () => ({});
        game.init();

        const ready = game.readyUp('1', {});

        ready.should.equal(true);
        game.toJSON().players[0].ready.should.equal(true);
    });

    it('should start when all players are ready', () => {
        const player1 = { _id: '1', username: 'abc' };
        const player2 = { _id: '2', username: 'def' };
        const game = new Game({ name: 'test' }, mockRoom([player1, player2]));
        game.setup = () => ({});
        game.init();

        game.readyUp('1', {});
        game.readyUp('2', {});

        game.started.should.equal(true);
    });

    it('should accept a move from the player when it is their turn', () => {
        const player1 = { _id: '1', username: 'abc' };
        const game = new Game({ name: 'test' }, mockRoom([player1]));
        game.handleMove = payload => Promise.resolve(payload);
        game.setup = () => ({ readyUp: false });
        game.init();

        const guess = 'hangman';
        return game.playerMove(game.players[0], { guess })
            .then(move => {
                move.payload.guess.should.equal(guess);
            });
    });

    it('should deny a player from moving when it is not their turn', () => {
        const player1 = { _id: '1', username: 'abc' };
        const player2 = { _id: '2', username: 'def' };
        const game = new Game({ name: 'test' }, mockRoom([player1, player2]));
        game.handleMove = payload => Promise.resolve(payload);
        game.setup = () => ({ readyUp: false });
        game.init();
        game.setPlayerTurnOrder(['1', '2']);

        const guess = 'hangman';
        return game.playerMove(game.players[1], { guess })
            .catch(err => {
                err.should.equal('You are not allowed to send that right now.');
            });
    });

    it('should deny a player from moving before the game has started', () => {
        const player1 = { _id: '1', username: 'abc' };
        const game = new Game({ name: 'test' }, mockRoom([player1]));

        const guess = 'hangman';
        return game.playerMove(game.players[0], { guess })
            .then(() => {
                throw new Error('Game accepted a move it shouldn\'t have');
            })
            .catch(err => {
                err.should.equal('Game has not started.');
            });
    });

    it('should deny a player from moving if the game has ended', () => {
        const player1 = { _id: '1', username: 'abc' };
        const game = new Game({ name: 'test' }, mockRoom([player1]));
        game.handleEnd = game.handleMove = payload => Promise.resolve(payload);
        game.setup = () => ({ readyUp: false });
        game.init();
        
        return game.onEnd({})
            .then(() => {
                const guess = 'hangman';
                return game.playerMove(game.players[0], { guess })
                    .then(() => {
                        throw new Error('Game accepted a move it shouldn\'t have');
                    })
                    .catch(err => {
                        err.should.equal('Game has ended.');
                    });
            });
    });
});
