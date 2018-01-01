const should = require('chai').should();

const Room = require('../Room');

const mockPlayer = (_id, username) => ({ _id, username, rooms: [] });

const mockSocket = { join: () => {}, leave: () => {} };
const mockIO = {
    of: () => ({ in: () => ({ clients: () => {} }) }),
    to: () => ({ emit: () => {} })
};

describe('Room', () => {
    it('should create a room when called', () => {
        const name = 'Mock';
        const room = new Room(name, { _id: '1' }, {});

        room.name.should.equal(name);
        room.players.length.should.equal(0);
    });

    it('should deny a player access if the room is full', () => {
        const player = mockPlayer('1', 'abc');
        const room = new Room('Mock', { _id: '1' }, {
            player_limit: 0
        });

        return room.addPlayer(player, mockSocket)
            .then(() => {
                throw new Error('Game accepted the player into a full room');
            })
            .catch(err => {
                err.should.equal('Room is full.');
            });
    });

    it('should add a player to a public room', () => {
        const name = 'Mock';
        const player = mockPlayer('1', 'abc');
        const room = new Room(name, { _id: '1' }, {});

        return room.addPlayer(player, mockSocket)
            .then(playerRoom => {
                playerRoom.name.should.equal(name);
                room.players[0].username.should.equal(player.username);
            });
    });

    it('should deny access to a player with no password to a private room', () => {
        const player = mockPlayer('1', 'abc');
        const room = new Room('Mock', { _id: '1' }, {
            privacy: 'private',
            password: 'secret'
        });

        return room.addPlayer(player, mockSocket)
            .then(() => {
                throw new Error('Room accepted player without password');
            })
            .catch(err => {
                err.should.equal('Room is private. Password required to enter.');
            });
    });

    it('should deny acces to a player with an incorrect password to a private room', () => {
        const player = mockPlayer('1', 'abc');
        const room = new Room('Mock', { _id: '1' }, {
            privacy: 'private',
            password: 'secret'
        });

        return room.addPlayer(player, mockSocket, 'hunter2')
            .then(() => {
                throw new Error('Room accepted player with incorrect password');
            })
            .catch(err => {
                err.should.equal('Incorrect password.');
            });
    });

    it('should add a player to a private room with the correct password', () => {
        const password = 'secret';
        const player = mockPlayer('1', 'abc');
        const room = new Room('Mock', { _id: '1' }, {
            privacy: 'private',
            password
        });

        return room.addPlayer(player, mockSocket, password)
            .then(() => {
                room.players.length.should.equal(1);
            });
    });

    it('should remove a player from the room', () => {
        const player = mockPlayer('1', 'abc');
        const room = new Room('Mock', { _id: '1' });

        return room.addPlayer(player, mockSocket)
            .then(() => {
                return room.removePlayer(player, mockSocket)
                    .then(() => {
                        room.players.length.should.equal(0);
                    });
            });
    });

    it('should allow it\'s name to be updated', () => {
        const room = new Room('Mock', { _id: '1' }, {}, mockIO);
        const new_name = 'Room 101';

        room.setName(new_name);
        room.name.should.equal(new_name);
    });

    it('should transfer host privileges', () => {
        const new_host = mockPlayer('2', 'def');
        const room = new Room('Mock', { _id: '1' }, {}, mockIO);
        room.addPlayer(mockPlayer('1', 'abc'), mockSocket);
        room.addPlayer(new_host, mockSocket);

        room.changeHost('2');

        room.host.should.equal(new_host._id);
    });

    it('should allow it\'s privacy status to change', () => {
        const room = new Room('Mock', { _id: '1' }, {});

        const privacy = 'private';
        room.updateSettings({ privacy });

        room.settings.privacy.should.equal(privacy);
    });

    it('should allow it\'s join password to change', () => {
        const room = new Room('Mock', { _id: '1' }, {
            privacy: 'private',
            password: 'secret'
        });

        const password = 'hunter2';
        room.updateSettings({ password });

        room.settings.password.should.equal(password);
    });

    it('should update player limit', () => {
        const room = new Room('Mock', { _id: '1' }, {
            player_limit: 8
        });

        const player_limit = 4;
        room.updateSettings({ player_limit });

        room.settings.player_limit.should.equal(player_limit);
    });

    it('should add a game to the playlist', () => {
        const room = new Room('Mock', { _id: '1' }, {}, mockIO);

        room.addGame({ name: 'test' });

        room.playlist.games.length.should.equal(1);
    });

    it('should hide the current game, ID, and password when converting to JSON', () => {
        const room = new Room('Mock', { _id: '1' }, {
            privacy: 'private',
            password: 'secret'
        }, mockIO);

        room.game = { foobar: 'abc' }

        room.toJSON().should.not.have.property('game');
        room.toJSON().should.not.have.property('id');
        room.toJSON().settings.should.not.have.property('password');
    });
});
